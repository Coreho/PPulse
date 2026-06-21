"""
ProjectPulse Push Relay — FastAPI server for Web Push notifications.

Receives requests from the Service Worker (or the app) and forwards them
as Web Push notifications via pywebpush using VAPID authentication.

Subscriptions are stored in memory for the lifetime of the process and
also persisted to subscriptions.json so they survive a restart.

Environment variables (from .env or container env):
    VAPID_PRIVATE_KEY   — VAPID private key (PEM or raw base64-url)
    VAPID_PUBLIC_KEY    — VAPID public key (base64-url, uncompressed)
    VAPID_EMAIL         — Contact email for VAPID claims (mailto:...)
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pywebpush import WebPusher, webpush, WebPushException

load_dotenv()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("push-relay")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

VAPID_PRIVATE_KEY: str = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY: str = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_EMAIL: str = os.environ.get("VAPID_EMAIL", "mailto:admin@example.com")

OPENROUTER_API_KEY: str = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL: str = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-sonnet-4-5")

ALLOWED_ORIGINS: list[str] = [
    "https://pulse.koreokorp.com",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:4173",
]

SUBSCRIPTIONS_FILE = Path("subscriptions.json")

# ---------------------------------------------------------------------------
# In-memory subscription store
# Key: "{project_id}:{endpoint}" → PushSubscription JSON dict
# ---------------------------------------------------------------------------

_subscriptions: dict[str, dict[str, Any]] = {}


def _load_subscriptions() -> None:
    """Load persisted subscriptions from disk on startup."""
    if SUBSCRIPTIONS_FILE.exists():
        try:
            data = json.loads(SUBSCRIPTIONS_FILE.read_text())
            _subscriptions.update(data)
            log.info("Loaded %d subscriptions from disk.", len(_subscriptions))
        except Exception as exc:
            log.warning("Could not load subscriptions.json: %s", exc)


def _save_subscriptions() -> None:
    """Persist subscriptions to disk after any mutation."""
    try:
        SUBSCRIPTIONS_FILE.write_text(json.dumps(_subscriptions, indent=2))
    except Exception as exc:
        log.warning("Could not save subscriptions.json: %s", exc)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class PushSubscriptionKeys(BaseModel):
    p256dh: str
    auth: str


class PushSubscription(BaseModel):
    endpoint: str
    keys: PushSubscriptionKeys
    expiration_time: int | None = Field(default=None, alias="expirationTime")

    model_config = {"populate_by_name": True}


class SendRequest(BaseModel):
    subscription: PushSubscription
    title: str
    body: str
    severity: str = "low"
    card_id: str = ""
    data: dict[str, Any] = Field(default_factory=dict)


class SubscribeRequest(BaseModel):
    project_id: str
    subscription: PushSubscription


# ---------------------------------------------------------------------------
# Chat — Pydantic models
# ---------------------------------------------------------------------------


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ProjectContext(BaseModel):
    id: str
    name: str
    status: str
    classification: str | None = None


class TodoContext(BaseModel):
    id: str
    title: str
    completed: bool


class CardContext(BaseModel):
    id: str
    project_id: str
    title: str
    column: str  # backlog | in_progress | done


class ChatContext(BaseModel):
    projects: list[ProjectContext] = []
    todos: list[TodoContext] = []
    cards: list[CardContext] = []
    active_project_id: str | None = None


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    context: ChatContext = Field(default_factory=ChatContext)


class ToolAction(BaseModel):
    type: str
    args: dict[str, Any]


class ChatResponse(BaseModel):
    text: str
    actions: list[ToolAction] = []


# ---------------------------------------------------------------------------
# Chat — system prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are Pulse, an AI assistant built into ProjectPulse — a project management app for technical creators.

You can help the user:
- Manage projects (create, update status, delete, open)
- Manage their to-do list (add tasks, mark complete, delete)
- Move cards on the Kanban board between Backlog / In Progress / Done
- Add items to the Bill of Materials (BOM) for a project
- Add objectives to a project
- Research topics on the web
- Find how-to videos on YouTube
- Look up component or material prices for BOM items

When the user asks you to perform an action in the app, use the appropriate frontend tool.
When you need real-world information (search, prices, videos), use the search tools.
Always be concise and action-oriented. Confirm what you did after taking action.

Current app context will be provided in the user's first message.
"""

# ---------------------------------------------------------------------------
# Chat — tool definitions (OpenAI tool_use format)
# ---------------------------------------------------------------------------

TOOLS: list[dict[str, Any]] = [
    # ── Server-side tools (backend executes) ──
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web for research, articles, documentation, or any information",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query"}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_youtube",
            "description": "Search YouTube for how-to videos, tutorials, or demonstrations",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "What to search for on YouTube"}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_price",
            "description": "Look up the approximate price of a component, material, or product for BOM planning",
            "parameters": {
                "type": "object",
                "properties": {
                    "item": {"type": "string", "description": "The item name to look up prices for"}
                },
                "required": ["item"],
            },
        },
    },
    # ── Frontend tools (backend returns as actions, client executes) ──
    {
        "type": "function",
        "function": {
            "name": "create_project",
            "description": "Create a new project in ProjectPulse",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "classification": {
                        "type": "string",
                        "enum": ["home", "software", "hardware", "mixed", "research", "other"],
                    },
                    "status": {
                        "type": "string",
                        "enum": ["planning", "active", "paused", "completed", "cancelled"],
                    },
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_project",
            "description": "Delete a project by its ID",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "string"}},
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_project",
            "description": "Update a project's name, status, or classification",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "name": {"type": "string"},
                    "status": {
                        "type": "string",
                        "enum": ["planning", "active", "paused", "completed", "cancelled"],
                    },
                    "classification": {
                        "type": "string",
                        "enum": ["home", "software", "hardware", "mixed", "research", "other"],
                    },
                },
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "open_project",
            "description": "Navigate to a specific project in the app",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "string", "description": "Project ID to open"}},
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_todo",
            "description": "Add a new task to the user's to-do list",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "details": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional sub-bullet details",
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "complete_todo",
            "description": "Mark a to-do item as complete",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "string"}},
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_todo",
            "description": "Delete a to-do item",
            "parameters": {
                "type": "object",
                "properties": {"id": {"type": "string"}},
                "required": ["id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "move_kanban_card",
            "description": "Move a Kanban card to a different column",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "description": "Card ID"},
                    "column": {"type": "string", "enum": ["backlog", "in_progress", "done"]},
                },
                "required": ["id", "column"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_kanban_card",
            "description": "Add a new card to the Kanban board",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"},
                    "title": {"type": "string"},
                    "column": {"type": "string", "enum": ["backlog", "in_progress", "done"]},
                    "type": {"type": "string", "enum": ["software", "hardware"]},
                },
                "required": ["project_id", "title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_bom_item",
            "description": "Add an item to the Bill of Materials for a project, optionally with a price",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"},
                    "name": {"type": "string"},
                    "quantity_required": {"type": "number"},
                    "unit": {"type": "string", "description": "e.g. pcs, kg, m"},
                    "estimated_price": {"type": "number", "description": "Price per unit in USD"},
                    "sku": {"type": "string"},
                },
                "required": ["project_id", "name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_objective",
            "description": "Add an objective/goal to a project",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_id": {"type": "string"},
                    "title": {"type": "string"},
                },
                "required": ["project_id", "title"],
            },
        },
    },
]

# Tool names executed server-side; all others are returned to the frontend as actions
SERVER_SIDE_TOOLS: set[str] = {"web_search", "search_youtube", "lookup_price"}

# ---------------------------------------------------------------------------
# Chat — server-side tool execution
# ---------------------------------------------------------------------------


def execute_web_search(query: str) -> str:
    try:
        from duckduckgo_search import DDGS

        results = DDGS().text(query, max_results=5)
        if not results:
            return "No results found."
        lines = []
        for r in results:
            lines.append(f"**{r.get('title', '')}**\n{r.get('body', '')}\nURL: {r.get('href', '')}")
        return "\n\n".join(lines)
    except Exception as e:
        return f"Search error: {e}"


def execute_youtube_search(query: str) -> str:
    try:
        from duckduckgo_search import DDGS

        results = DDGS().text(f"site:youtube.com {query}", max_results=5)
        if not results:
            return "No YouTube videos found."
        lines = []
        for r in results:
            lines.append(f"**{r.get('title', '')}**\n{r.get('href', '')}\n{r.get('body', '')}")
        return "\n\n".join(lines)
    except Exception as e:
        return f"YouTube search error: {e}"


def execute_price_lookup(item: str) -> str:
    try:
        from duckduckgo_search import DDGS

        results = DDGS().text(f"{item} price buy online USD", max_results=5)
        if not results:
            return f"Could not find pricing for {item}."
        lines = [f"Price information for **{item}**:"]
        for r in results:
            lines.append(
                f"- {r.get('title', '')}: {r.get('body', '')[:200]}\n  {r.get('href', '')}"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"Price lookup error: {e}"


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="ProjectPulse Push Relay", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.on_event("startup")
async def startup() -> None:
    _load_subscriptions()
    if not VAPID_PRIVATE_KEY:
        log.warning("VAPID_PRIVATE_KEY is not set — push notifications will fail.")
    if not VAPID_PUBLIC_KEY:
        log.warning("VAPID_PUBLIC_KEY is not set — push notifications will fail.")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health", status_code=status.HTTP_200_OK)
async def health() -> JSONResponse:
    """Liveness probe."""
    return JSONResponse({"status": "ok"})


@app.post("/subscribe", status_code=status.HTTP_200_OK)
async def subscribe(req: SubscribeRequest) -> JSONResponse:
    """
    Store a push subscription keyed by project_id + endpoint.
    Idempotent — re-subscribing the same endpoint just updates the record.
    """
    key = f"{req.project_id}:{req.subscription.endpoint}"
    _subscriptions[key] = {
        "project_id": req.project_id,
        "subscription": req.subscription.model_dump(by_alias=True),
    }
    _save_subscriptions()
    log.info("Stored subscription for project %s (endpoint: ...%s)", req.project_id, req.subscription.endpoint[-20:])
    return JSONResponse({"ok": True})


@app.post("/send", status_code=status.HTTP_200_OK)
async def send_push(req: SendRequest) -> JSONResponse:
    """
    Send a Web Push notification to a specific subscription.
    """
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VAPID keys not configured on server.",
        )

    payload = json.dumps(
        {
            "title": req.title,
            "body": req.body,
            "severity": req.severity,
            "cardId": req.card_id,
            **req.data,
        }
    )

    subscription_info = {
        "endpoint": req.subscription.endpoint,
        "keys": {
            "p256dh": req.subscription.keys.p256dh,
            "auth": req.subscription.keys.auth,
        },
    }

    try:
        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_EMAIL},
        )
        log.info("Push sent for card %s to ...%s", req.card_id, req.subscription.endpoint[-20:])
        return JSONResponse({"ok": True})
    except WebPushException as exc:
        log.error("WebPushException: %s", exc)
        # 410 Gone means subscription is no longer valid — remove it
        if exc.response is not None and exc.response.status_code == 410:
            _remove_stale_subscription(req.subscription.endpoint)
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Subscription has expired. Re-subscribe.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Push delivery failed: {exc}",
        )
    except Exception as exc:
        log.exception("Unexpected error sending push: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error.",
        )


@app.post("/broadcast/{project_id}", status_code=status.HTTP_200_OK)
async def broadcast(project_id: str, request: Request) -> JSONResponse:
    """
    Send a Web Push to all subscriptions stored for a project.
    Body: { title, body, severity, card_id, data }
    """
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VAPID keys not configured on server.",
        )

    body = await request.json()
    payload = json.dumps(
        {
            "title": body.get("title", "ProjectPulse"),
            "body": body.get("body", ""),
            "severity": body.get("severity", "low"),
            "cardId": body.get("card_id", ""),
        }
    )

    sent = 0
    failed = 0
    stale: list[str] = []

    for key, record in list(_subscriptions.items()):
        if record["project_id"] != project_id:
            continue

        sub = record["subscription"]
        subscription_info = {
            "endpoint": sub["endpoint"],
            "keys": sub["keys"],
        }

        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_EMAIL},
            )
            sent += 1
        except WebPushException as exc:
            failed += 1
            if exc.response is not None and exc.response.status_code == 410:
                stale.append(sub["endpoint"])
        except Exception:
            failed += 1

    for endpoint in stale:
        _remove_stale_subscription(endpoint)

    return JSONResponse({"sent": sent, "failed": failed})


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    """
    AI chat endpoint. Calls OpenRouter with tool use, runs server-side tools
    in a loop, and returns the final text plus any frontend actions to execute.
    """
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OPENROUTER_API_KEY not configured")

    import json as _json

    from openai import OpenAI

    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=OPENROUTER_API_KEY,
    )

    # Build context summary appended to the system prompt
    ctx = req.context
    context_lines = [
        "Projects ({count}): {items}".format(
            count=len(ctx.projects),
            items=", ".join(
                f'"{p.name}" (id:{p.id}, status:{p.status})' for p in ctx.projects
            ) or "none",
        ),
        "Todos ({count}): {items}".format(
            count=len(ctx.todos),
            items=", ".join(
                f'"{t.title}" (id:{t.id}, done:{t.completed})' for t in ctx.todos
            ) or "none",
        ),
        "Kanban cards ({count}): {items}".format(
            count=len(ctx.cards),
            items=", ".join(
                f'"{c.title}" (id:{c.id}, col:{c.column}, proj:{c.project_id})'
                for c in ctx.cards
            ) or "none",
        ),
    ]
    if ctx.active_project_id:
        context_lines.append(f"Currently viewing project ID: {ctx.active_project_id}")

    system_with_context = SYSTEM_PROMPT + "\n\n## Current App State\n" + "\n".join(context_lines)

    messages: list[dict[str, Any]] = [{"role": "system", "content": system_with_context}]
    for h in req.history[-20:]:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": req.message})

    frontend_actions: list[ToolAction] = []

    # Tool loop — max 10 rounds to prevent runaway chains
    for _ in range(10):
        response = client.chat.completions.create(
            model=OPENROUTER_MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            extra_headers={
                "HTTP-Referer": "https://pulse.koreokorp.com",
                "X-Title": "ProjectPulse",
            },
        )

        msg = response.choices[0].message

        if not msg.tool_calls:
            return ChatResponse(text=msg.content or "", actions=frontend_actions)

        # Append assistant turn with tool calls
        messages.append({
            "role": "assistant",
            "content": msg.content,
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in msg.tool_calls
            ],
        })

        for tc in msg.tool_calls:
            fn_name = tc.function.name
            try:
                fn_args = _json.loads(tc.function.arguments)
            except Exception:
                fn_args = {}

            if fn_name in SERVER_SIDE_TOOLS:
                if fn_name == "web_search":
                    result = execute_web_search(fn_args.get("query", ""))
                elif fn_name == "search_youtube":
                    result = execute_youtube_search(fn_args.get("query", ""))
                elif fn_name == "lookup_price":
                    result = execute_price_lookup(fn_args.get("item", ""))
                else:
                    result = "Unknown server-side tool."
                messages.append({"role": "tool", "tool_call_id": tc.id, "content": result})
            else:
                # Frontend tool — queue as action, acknowledge to the model
                frontend_actions.append(ToolAction(type=fn_name, args=fn_args))
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": f"Action '{fn_name}' queued for execution in the app.",
                })

    return ChatResponse(text="I processed your request.", actions=frontend_actions)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _remove_stale_subscription(endpoint: str) -> None:
    """Remove all subscription records that match the given endpoint."""
    to_delete = [k for k, v in _subscriptions.items() if v["subscription"]["endpoint"] == endpoint]
    for k in to_delete:
        del _subscriptions[k]
        log.info("Removed stale subscription: ...%s", endpoint[-20:])
    if to_delete:
        _save_subscriptions()
