export type Health = 'green' | 'amber' | 'red'

export interface ProjectRollup {
  completion: number
  openIssues: number
  subProjectCount: number
  health: Health
}

export function completion(objectivesCompleted: number, objectivesTotal: number): number {
  if (objectivesTotal <= 0) return 0
  return objectivesCompleted / objectivesTotal
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function projectHealth(input: {
  estimatedCompletionDate: string | null
  openIssues: number
  hasHighSeverityOpenIssue: boolean
  now?: Date
}): Health {
  const now = input.now ?? new Date()
  const due = input.estimatedCompletionDate ? new Date(input.estimatedCompletionDate) : null

  if (input.hasHighSeverityOpenIssue) return 'red'
  if (due && due.getTime() < now.getTime()) return 'red'
  if (due && due.getTime() - now.getTime() <= WEEK_MS) return 'amber'
  if (input.openIssues > 0) return 'amber'
  return 'green'
}
