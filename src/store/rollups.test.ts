import { describe, it, expect } from 'vitest'
import { completion, projectHealth } from './rollups'

describe('completion', () => {
  it('is 0 when there are no objectives', () => {
    expect(completion(0, 0)).toBe(0)
  })
  it('is the ratio of completed to total', () => {
    expect(completion(3, 4)).toBe(0.75)
  })
})

describe('projectHealth', () => {
  const now = new Date('2026-06-20T00:00:00Z')
  it('is red when overdue', () => {
    expect(projectHealth({ estimatedCompletionDate: '2026-06-10', openIssues: 0, hasHighSeverityOpenIssue: false, now })).toBe('red')
  })
  it('is red when a high-severity issue is open even if on time', () => {
    expect(projectHealth({ estimatedCompletionDate: '2026-12-01', openIssues: 1, hasHighSeverityOpenIssue: true, now })).toBe('red')
  })
  it('is amber when due within 7 days', () => {
    expect(projectHealth({ estimatedCompletionDate: '2026-06-25', openIssues: 0, hasHighSeverityOpenIssue: false, now })).toBe('amber')
  })
  it('is amber when there are open issues', () => {
    expect(projectHealth({ estimatedCompletionDate: null, openIssues: 2, hasHighSeverityOpenIssue: false, now })).toBe('amber')
  })
  it('is green when on track with no issues', () => {
    expect(projectHealth({ estimatedCompletionDate: '2026-12-01', openIssues: 0, hasHighSeverityOpenIssue: false, now })).toBe('green')
  })
})
