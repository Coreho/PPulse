export type NavFilter = 'all' | 'active' | 'completed' | 'notes'

export type CardColumn = 'backlog' | 'in_progress' | 'done'
export type CardType = 'software' | 'hardware'
export type StatusFlag = 'blocked' | 'outdated' | 'low_stock' | 'needs_maintenance'
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'
export type ProjectClassification = 'home' | 'software' | 'hardware' | 'mixed' | 'research' | 'other'
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled'
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IssueStatus = 'open' | 'in_progress' | 'closed'

export interface SoftwareMeta {
  repo?: string
  branch?: string
  targetMCU?: string
  language?: string
}

export interface HardwareMeta {
  material?: string
  dimensions?: string
  slicerProfile?: string
  estimatedWeight_g?: number
  binLocation?: string
  printTime_minutes?: number
}

export type CardMeta = SoftwareMeta | HardwareMeta

export interface TimerPhase {
  name: string
  duration_minutes: number
  alert_severity: AlertSeverity
}

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          owner_id: string | null
          name: string
          description: string | null
          classification: ProjectClassification | null
          status: ProjectStatus
          estimated_completion_date: string | null
          scratchpad_content: string | null
          is_pinned: boolean
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      objectives: {
        Row: {
          id: string
          project_id: string
          sub_project_id: string | null
          title: string
          completed: boolean
          position: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['objectives']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['objectives']['Insert']>
      }
      issues: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string | null
          severity: IssueSeverity
          status: IssueStatus
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['issues']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['issues']['Insert']>
      }
      cards: {
        Row: {
          id: string
          project_id: string
          sub_project_id: string | null
          type: CardType
          title: string
          description: string | null
          column: CardColumn
          position: number
          scratchpad_tag: string | null
          meta: CardMeta | null
          blocked_by: string[]
          bom_item_id: string | null
          machine_id: string | null
          target_timestamp: string | null
          status_flags: StatusFlag[]
          machine_session_start: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['cards']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['cards']['Insert']>
      }
      bom_items: {
        Row: {
          id: string
          project_id: string
          name: string
          sku: string | null
          quantity_required: number
          quantity_stock: number
          unit: string
          bin_location: string | null
          linked_card_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['bom_items']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['bom_items']['Insert']>
      }
      machines: {
        Row: {
          id: string
          project_id: string
          name: string
          type: string
          total_hours_logged: number
          maintenance_threshold_hours: number
          hours_at_last_maintenance: number
          last_maintenance_at: string | null
          is_locked: boolean
        }
        Insert: Omit<Database['public']['Tables']['machines']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['machines']['Insert']>
      }
      pinouts: {
        Row: {
          id: string
          project_id: string
          mcu_type: string
          variable_name: string
          pin_number: string
          pin_function: string | null
          description: string | null
        }
        Insert: Omit<Database['public']['Tables']['pinouts']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['pinouts']['Insert']>
      }
      file_vault_entries: {
        Row: {
          id: string
          project_id: string
          file_path: string
          file_name: string
          last_seen_mtime: number
          status: 'current' | 'outdated'
          linked_card_id: string | null
        }
        Insert: Omit<Database['public']['Tables']['file_vault_entries']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['file_vault_entries']['Insert']>
      }
      timers: {
        Row: {
          id: string
          card_id: string
          phases: TimerPhase[]
          started_at: string
          current_phase_index: number
          completed: boolean
        }
        Insert: Omit<Database['public']['Tables']['timers']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['timers']['Insert']>
      }
      todos: {
        Row: {
          id: string
          owner_id: string | null
          title: string
          details: string[]
          completed: boolean
          position: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['todos']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['todos']['Insert']>
      }
      sub_projects: {
        Row: {
          id: string
          owner_id: string | null
          project_id: string
          name: string
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id?: string | null
          project_id: string
          name: string
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          position?: number
          updated_at?: string
        }
      }
    }
  }
}
