import { describe, it, expect } from 'vitest'
import { calculateSubtaskProgress, computeDerivedStates } from '@/lib/tasks/progress'

describe('calculateSubtaskProgress', () => {
  it('returns 0 for no subtasks', () => {
    expect(calculateSubtaskProgress([])).toBe(0)
  })

  it('returns 0 when no subtask is closed', () => {
    const subtasks = [
      { isClosed: false },
      { isClosed: false },
      { isClosed: false },
    ]
    expect(calculateSubtaskProgress(subtasks)).toBe(0)
  })

  it('returns 100 when all subtasks are closed', () => {
    const subtasks = [
      { isClosed: true },
      { isClosed: true },
    ]
    expect(calculateSubtaskProgress(subtasks)).toBe(100)
  })

  it('calculates correct percentage (rounded)', () => {
    const subtasks = [
      { isClosed: true },
      { isClosed: true },
      { isClosed: false },
    ]
    expect(calculateSubtaskProgress(subtasks)).toBe(67)
  })

  it('calculates 50% for 1/2', () => {
    const subtasks = [
      { isClosed: true },
      { isClosed: false },
    ]
    expect(calculateSubtaskProgress(subtasks)).toBe(50)
  })

  it('calculates 20% for 1/5', () => {
    const subtasks = Array.from({ length: 5 }, (_, i) => ({ isClosed: i === 0 }))
    expect(calculateSubtaskProgress(subtasks)).toBe(20)
  })
})

describe('computeDerivedStates', () => {
  const now = Date.now()

  it('returns empty array for task with no dueDate and no visibleFrom', () => {
    const states = computeDerivedStates({
      dueDate: null,
      isClosed: false,
      progress: 0,
      visibleFrom: null,
    })
    expect(states).toEqual([])
  })

  it('detects OVERDUE when past due and not closed', () => {
    const yesterday = new Date(now - 86400000)
    const states = computeDerivedStates({
      dueDate: yesterday,
      isClosed: false,
      progress: 50,
      visibleFrom: null,
    })
    expect(states).toContain('OVERDUE')
  })

  it('does NOT flag OVERDUE when closed', () => {
    const yesterday = new Date(now - 86400000)
    const states = computeDerivedStates({
      dueDate: yesterday,
      isClosed: true,
      progress: 100,
      visibleFrom: null,
    })
    expect(states).not.toContain('OVERDUE')
  })

  it('detects AT_RISK when due within 2 days and progress < 80%', () => {
    const tomorrow = new Date(now + 86400000)
    const states = computeDerivedStates({
      dueDate: tomorrow,
      isClosed: false,
      progress: 30,
      visibleFrom: null,
    })
    expect(states).toContain('AT_RISK')
  })

  it('does NOT flag AT_RISK when progress >= 80%', () => {
    const tomorrow = new Date(now + 86400000)
    const states = computeDerivedStates({
      dueDate: tomorrow,
      isClosed: false,
      progress: 85,
      visibleFrom: null,
    })
    expect(states).not.toContain('AT_RISK')
  })

  it('does NOT flag AT_RISK when more than 2 days away', () => {
    const nextWeek = new Date(now + 7 * 86400000)
    const states = computeDerivedStates({
      dueDate: nextWeek,
      isClosed: false,
      progress: 10,
      visibleFrom: null,
    })
    expect(states).not.toContain('AT_RISK')
  })

  it('detects UPCOMING when visibleFrom is in the future', () => {
    const nextWeek = new Date(now + 7 * 86400000)
    const states = computeDerivedStates({
      dueDate: null,
      isClosed: false,
      progress: 0,
      visibleFrom: nextWeek,
    })
    expect(states).toContain('UPCOMING')
  })

  it('does NOT flag UPCOMING when visibleFrom is past', () => {
    const yesterday = new Date(now - 86400000)
    const states = computeDerivedStates({
      dueDate: null,
      isClosed: false,
      progress: 0,
      visibleFrom: yesterday,
    })
    expect(states).not.toContain('UPCOMING')
  })

  it('can have both OVERDUE and not AT_RISK', () => {
    const twoDaysAgo = new Date(now - 2 * 86400000)
    const states = computeDerivedStates({
      dueDate: twoDaysAgo,
      isClosed: false,
      progress: 50,
      visibleFrom: null,
    })
    expect(states).toContain('OVERDUE')
    expect(states).not.toContain('AT_RISK')
  })
})
