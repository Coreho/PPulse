import { create } from 'zustand'
import { supabase } from '@/db/supabase'
import { enqueueMutation } from '@/db/idb'
import type { Database } from '@/db/types'

type Todo = Database['public']['Tables']['todos']['Row']

/** Max free-text detail lines shown per todo (matches the design mockup). */
export const MAX_TODO_DETAILS = 3

interface TodoStore {
  todos: Todo[]
  loading: boolean
  loadTodos: () => Promise<void>
  addTodo: (title: string, details?: string[]) => Promise<void>
  updateTodo: (id: string, updates: { title?: string; details?: string[] }) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
}

export const useTodoStore = create<TodoStore>((set, get) => ({
  todos: [],
  loading: false,

  loadTodos: async () => {
    set({ loading: true })
    const { data } = await supabase
      .from('todos')
      .select('*')
      .order('completed', { ascending: true })
      .order('position', { ascending: true })
    set({ todos: data ?? [], loading: false })
  },

  addTodo: async (title, details = []) => {
    const now = new Date().toISOString()
    const position = get().todos.length
    const cleanDetails = details.map(d => d.trim()).filter(Boolean).slice(0, MAX_TODO_DETAILS)
    const optimistic: Todo = {
      id: crypto.randomUUID(),
      owner_id: null,
      title,
      details: cleanDetails,
      completed: false,
      position,
      created_at: now,
      updated_at: now,
    }
    set(s => ({ todos: [...s.todos, optimistic] }))
    try {
      const { data, error } = await supabase
        .from('todos')
        .insert({ title, details: cleanDetails, completed: false, position, owner_id: null })
        .select()
        .single()
      if (error) throw error
      set(s => ({ todos: s.todos.map(t => t.id === optimistic.id ? data : t) }))
    } catch {
      await enqueueMutation('todos', 'upsert', optimistic)
    }
  },

  updateTodo: async (id, updates) => {
    const cleaned = updates.details
      ? { ...updates, details: updates.details.map(d => d.trim()).filter(Boolean).slice(0, MAX_TODO_DETAILS) }
      : updates
    set(s => ({ todos: s.todos.map(t => t.id === id ? { ...t, ...cleaned } : t) }))
    try {
      const { error } = await supabase.from('todos').update(cleaned).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('todos', 'upsert', { id, ...cleaned })
    }
  },

  toggleTodo: async (id) => {
    const todo = get().todos.find(t => t.id === id)
    if (!todo) return
    const completed = !todo.completed
    set(s => ({ todos: s.todos.map(t => t.id === id ? { ...t, completed } : t) }))
    try {
      const { error } = await supabase.from('todos').update({ completed }).eq('id', id)
      if (error) throw error
    } catch {
      await enqueueMutation('todos', 'upsert', { id, completed })
    }
  },

  deleteTodo: async (id) => {
    set(s => ({ todos: s.todos.filter(t => t.id !== id) }))
    try {
      await supabase.from('todos').delete().eq('id', id)
    } catch {
      await enqueueMutation('todos', 'delete', { id })
    }
  },
}))
