import { useProjectStore } from '@/store/projectStore'
import { useTodoStore } from '@/store/todoStore'
import { useCardStore } from '@/store/cardStore'
import { useObjectivesStore } from '@/store/objectivesStore'
import type { ToolAction } from './types'
import type { ProjectClassification, ProjectStatus, CardColumn } from '@/db/types'

export async function executeToolAction(
  action: ToolAction,
  callbacks: {
    onOpenProject?: (id: string) => void
  } = {}
): Promise<string> {
  const projectStore = useProjectStore.getState()
  const todoStore = useTodoStore.getState()
  const cardStore = useCardStore.getState()
  const objectivesStore = useObjectivesStore.getState()

  switch (action.type) {
    case 'create_project': {
      const p = await projectStore.createProject(
        action.args.name,
        (action.args.classification as ProjectClassification) ?? null,
        (action.args.status as ProjectStatus) ?? 'planning'
      )
      return `Created project "${p.name}"`
    }
    case 'delete_project': {
      const p = projectStore.projects.find(x => x.id === action.args.id)
      await projectStore.deleteProject(action.args.id)
      return `Deleted project "${p?.name ?? action.args.id}"`
    }
    case 'update_project': {
      await projectStore.updateProject(action.args.id, {
        ...(action.args.name && { name: action.args.name }),
        ...(action.args.status && { status: action.args.status as ProjectStatus }),
        ...(action.args.classification && { classification: action.args.classification as ProjectClassification }),
      })
      return `Updated project`
    }
    case 'open_project': {
      const p = projectStore.projects.find(x => x.id === action.args.id)
      if (p) {
        callbacks.onOpenProject?.(action.args.id)
        projectStore.setActiveProject(p)
      }
      return `Opened project "${p?.name ?? action.args.id}"`
    }
    case 'add_todo': {
      await todoStore.addTodo(action.args.title, action.args.details ?? [])
      return `Added todo: "${action.args.title}"`
    }
    case 'complete_todo': {
      await todoStore.toggleTodo(action.args.id)
      return `Marked todo complete`
    }
    case 'delete_todo': {
      await todoStore.deleteTodo(action.args.id)
      return `Deleted todo`
    }
    case 'move_kanban_card': {
      const card = cardStore.cards.find(c => c.id === action.args.id)
      const col = action.args.column as CardColumn
      const pos = cardStore.cards.filter(c => c.column === col).length
      await cardStore.moveCard(action.args.id, col, pos)
      return `Moved card "${card?.title ?? action.args.id}" to ${action.args.column}`
    }
    case 'add_kanban_card': {
      const activeProject = projectStore.activeProject
      const projectId = action.args.project_id || activeProject?.id || ''
      if (!projectId) return 'No project specified for card'
      await cardStore.addCard({
        project_id: projectId,
        sub_project_id: null,
        title: action.args.title,
        column: (action.args.column as CardColumn) ?? 'backlog',
        type: (action.args.type as 'software' | 'hardware') ?? 'software',
        description: null,
        position: cardStore.cards.length,
        scratchpad_tag: null,
        meta: null,
        blocked_by: [],
        bom_item_id: null,
        machine_id: null,
        target_timestamp: null,
        status_flags: [],
      })
      return `Added card "${action.args.title}" to ${action.args.column ?? 'backlog'}`
    }
    case 'add_bom_item': {
      const { useBomStore } = await import('@/bom/bomStore')
      const bomStore = useBomStore.getState()
      const activeProject = projectStore.activeProject
      const projectId = action.args.project_id || activeProject?.id || ''
      if (!projectId) return 'No project specified for BOM item'
      await bomStore.addItem({
        project_id: projectId,
        name: action.args.name,
        quantity_required: action.args.quantity_required ?? 1,
        quantity_stock: 0,
        unit: action.args.unit ?? 'pcs',
        sku: action.args.sku ?? null,
        bin_location: null,
        linked_card_id: null,
      })
      return `Added "${action.args.name}" to BOM${action.args.estimated_price ? ` (~$${action.args.estimated_price}/unit)` : ''}`
    }
    case 'add_objective': {
      const activeProject = projectStore.activeProject
      const projectId = action.args.project_id || activeProject?.id || ''
      if (!projectId) return 'No project specified for objective'
      await objectivesStore.addObjective(projectId, action.args.title)
      return `Added objective: "${action.args.title}"`
    }
    default:
      return 'Unknown action'
  }
}
