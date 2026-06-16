import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

interface PPSchema extends DBSchema {
  sync_queue: {
    key: number
    value: {
      id?: number
      table: string
      operation: 'upsert' | 'delete'
      payload: Record<string, unknown>
      queued_at: number
    }
    indexes: { by_table: string }
  }
  fs_handles: {
    key: string
    value: {
      key: string
      handle: FileSystemDirectoryHandle
    }
  }
  push_subscriptions: {
    key: string
    value: {
      project_id: string
      subscription: PushSubscriptionJSON
    }
  }
}

let _db: IDBPDatabase<PPSchema> | null = null

export async function getDB(): Promise<IDBPDatabase<PPSchema>> {
  if (_db) return _db
  _db = await openDB<PPSchema>('pp-workspace', 1, {
    upgrade(db) {
      const sq = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true })
      sq.createIndex('by_table', 'table')
      db.createObjectStore('fs_handles', { keyPath: 'key' })
      db.createObjectStore('push_subscriptions', { keyPath: 'project_id' })
    },
  })
  return _db
}

export async function enqueueMutation(
  table: string,
  operation: 'upsert' | 'delete',
  payload: Record<string, unknown>,
) {
  const db = await getDB()
  await db.add('sync_queue', { table, operation, payload, queued_at: Date.now() })
}

export async function flushQueue(
  executor: (table: string, op: 'upsert' | 'delete', payload: Record<string, unknown>) => Promise<void>,
) {
  const db = await getDB()
  const all = await db.getAll('sync_queue')
  for (const item of all) {
    await executor(item.table, item.operation, item.payload)
    await db.delete('sync_queue', item.id!)
  }
}
