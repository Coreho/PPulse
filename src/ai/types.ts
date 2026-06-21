export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  actions?: ToolAction[]
  actionResults?: string[]
  loading?: boolean
  error?: boolean
}

export type ToolAction =
  | { type: 'create_project'; args: { name: string; classification?: string; status?: string } }
  | { type: 'delete_project'; args: { id: string } }
  | { type: 'update_project'; args: { id: string; status?: string; classification?: string; name?: string } }
  | { type: 'open_project'; args: { id: string } }
  | { type: 'add_todo'; args: { title: string; details?: string[] } }
  | { type: 'complete_todo'; args: { id: string } }
  | { type: 'delete_todo'; args: { id: string } }
  | { type: 'move_kanban_card'; args: { id: string; column: string } }
  | { type: 'add_kanban_card'; args: { project_id: string; title: string; column?: string; type?: string } }
  | { type: 'add_bom_item'; args: { project_id: string; name: string; quantity_required?: number; unit?: string; estimated_price?: number; sku?: string } }
  | { type: 'add_objective'; args: { project_id: string; title: string } }
