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

ALLOWED_ORIGINS: list[str] = [
    "https://pulse.koreokorp.com",
    "http://localhost:5173",
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
