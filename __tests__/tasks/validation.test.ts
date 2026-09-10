import { describe, it, expect } from 'vitest'
import {
  isValidTransition,
  validateStatusChange,
  detectDependencyCycle,
  computeIsClosed,
} from '@/lib/tasks/validation'

describe('isValidTransition', () => {
  // Valid transitions
  it('allows PENDING → IN_PROGRESS', () => {
    expect(isValidTransition('pending', 'in_progress')).toBe(true)
  })
  it('allows PENDING → BLOCKED', () => {
    expect(isValidTransition('pending', 'blocked')).toBe(true)
  })
  it('allows PENDING → CANCELLED', () => {
    expect(isValidTransition('pending', 'cancelled')).toBe(true)
  })
  it('allows IN_PROGRESS → COMPLETED', () => {
    expect(isValidTransition('in_progress', 'completed')).toBe(true)
  })
  it('allows IN_PROGRESS → BLOCKED', () => {
    expect(isValidTransition('in_progress', 'blocked')).toBe(true)
  })
  it('allows BLOCKED → IN_PROGRESS', () => {
    expect(isValidTransition('blocked', 'in_progress')).toBe(true)
  })
  it('allows BLOCKED → PENDING (restore)', () => {
    expect(isValidTransition('blocked', 'pending')).toBe(true)
  })
  it('allows COMPLETED → PENDING (reopen)', () => {
    expect(isValidTransition('completed', 'pending')).toBe(true)
  })
  it('allows CANCELLED → PENDING (reopen)', () => {
    expect(isValidTransition('cancelled', 'pending')).toBe(true)
  })

  // Invalid transitions
  it('blocks PENDING → COMPLETED (must go through IN_PROGRESS)', () => {
    expect(isValidTransition('pending', 'completed')).toBe(false)
  })
  it('blocks IN_PROGRESS → PENDING (no reverse)', () => {
    expect(isValidTransition('in_progress', 'pending')).toBe(false)
  })
  it('blocks COMPLETED → IN_PROGRESS (must reopen to PENDING first)', () => {
    expect(isValidTransition('completed', 'in_progress')).toBe(false)
  })
  it('blocks COMPLETED → CANCELLED', () => {
    expect(isValidTransition('completed', 'cancelled')).toBe(false)
  })

  // Same status
  it('blocks same status transition', () => {
    expect(isValidTransition('pending', 'pending')).toBe(false)
  })
})

describe('computeIsClosed', () => {
  it('returns true for completed', () => {
    expect(computeIsClosed('completed')).toBe(true)
  })
  it('returns true for cancelled', () => {
    expect(computeIsClosed('cancelled')).toBe(true)
  })
  it('returns false for pending', () => {
    expect(computeIsClosed('pending')).toBe(false)
  })
  it('returns false for in_progress', () => {
    expect(computeIsClosed('in_progress')).toBe(false)
  })
  it('returns false for blocked', () => {
    expect(computeIsClosed('blocked')).toBe(false)
  })
})

describe('validateStatusChange', () => {
  it('rejects invalid transition with error message', () => {
    const result = validateStatusChange('pending', 'completed')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('accepts valid transition', () => {
    const result = validateStatusChange('in_progress', 'completed')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('rejects completing task with incomplete subtasks', () => {
    const result = validateStatusChange('in_progress', 'completed', true)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('subtask')
  })

  it('allows completing task with no incomplete subtasks', () => {
    const result = validateStatusChange('in_progress', 'completed', false)
    expect(result.valid).toBe(true)
  })
})

describe('detectDependencyCycle', () => {
  it('detects simple A→B→A cycle', () => {
    // Current: A depends on B. Attempting to add B depends on A.
    const graph: Record<string, string[]> = { A: ['B'], B: [] }
    expect(detectDependencyCycle('B', 'A', graph)).toBe(true)
  })

  it('detects transitive A→B→C→A cycle', () => {
    const graph: Record<string, string[]> = { A: ['B'], B: ['C'], C: [] }
    // Adding C→A would create cycle
    expect(detectDependencyCycle('C', 'A', graph)).toBe(true)
  })

  it('detects long chain cycle', () => {
    const graph: Record<string, string[]> = {
      A: ['B'],
      B: ['C'],
      C: ['D'],
      D: ['E'],
      E: [],
    }
    // Adding E→A would create cycle
    expect(detectDependencyCycle('E', 'A', graph)).toBe(true)
  })

  it('allows non-cyclic dependency', () => {
    const graph: Record<string, string[]> = { A: [], B: ['A'], C: [] }
    // Adding C→A is fine (C → A, B → A, no cycle)
    expect(detectDependencyCycle('C', 'A', graph)).toBe(false)
  })

  it('allows diamond dependency (not a cycle)', () => {
    // A→C, A→D, B→C, B→D — diamond, no cycle
    // Adding E→C is fine since there's no path C→E
    const graph: Record<string, string[]> = {
      A: ['C', 'D'],
      B: ['C', 'D'],
      C: [],
      D: [],
      E: [],
    }
    expect(detectDependencyCycle('E', 'C', graph)).toBe(false)
  })

  it('handles empty graph', () => {
    expect(detectDependencyCycle('A', 'B', {})).toBe(false)
  })

  it('handles self-dependency', () => {
    const graph: Record<string, string[]> = { A: [] }
    expect(detectDependencyCycle('A', 'A', graph)).toBe(true)
  })
})
