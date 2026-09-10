import { describe, it, expect } from 'vitest'
import {
  canViewTask,
  canEditTask,
  canDeleteTask,
  canChangeStatus,
  canAddComment,
  canAssignTask,
} from '@/lib/tasks/permissions'

// Helper to create minimal staff/task objects
const staff = (id: string, overrides: Record<string, any> = {}) => ({
  id,
  role: 'staff' as const,
  departmentIds: [] as string[],
  ...overrides,
})

const task = (overrides: Record<string, any> = {}) => ({
  createdBy: 'creator_01',
  assigneeId: 'assignee_01',
  collaboratorIds: ['collab_01'],
  followerIds: ['follower_01'],
  departmentId: 'dept_01',
  cooperatingDepartmentIds: ['dept_02'],
  ...overrides,
})

// ===== canViewTask =====
describe('canViewTask', () => {
  it('allows admin to view any task', () => {
    expect(canViewTask(staff('anyone', { role: 'admin' }), task())).toBe(true)
  })

  it('allows task creator to view', () => {
    expect(canViewTask(staff('creator_01'), task())).toBe(true)
  })

  it('allows assignee to view', () => {
    expect(canViewTask(staff('assignee_01'), task())).toBe(true)
  })

  it('allows collaborator to view', () => {
    expect(canViewTask(staff('collab_01'), task())).toBe(true)
  })

  it('allows follower to view', () => {
    expect(canViewTask(staff('follower_01'), task())).toBe(true)
  })

  it('allows same department member to view', () => {
    expect(canViewTask(staff('other', { departmentIds: ['dept_01'] }), task())).toBe(true)
  })

  it('allows cooperating department member to view', () => {
    expect(canViewTask(staff('other', { departmentIds: ['dept_02'] }), task())).toBe(true)
  })

  it('blocks unrelated staff from viewing', () => {
    expect(canViewTask(staff('stranger', { departmentIds: ['dept_99'] }), task())).toBe(false)
  })

  it('blocks guest from viewing', () => {
    expect(canViewTask(staff('guest_01', { role: 'guest' }), task())).toBe(false)
  })
})

// ===== canEditTask =====
describe('canEditTask', () => {
  it('allows admin', () => {
    expect(canEditTask(staff('anyone', { role: 'admin' }), task())).toBe(true)
  })

  it('allows creator', () => {
    expect(canEditTask(staff('creator_01'), task())).toBe(true)
  })

  it('allows assignee', () => {
    expect(canEditTask(staff('assignee_01'), task())).toBe(true)
  })

  it('blocks collaborator from editing', () => {
    expect(canEditTask(staff('collab_01'), task())).toBe(false)
  })

  it('blocks follower from editing', () => {
    expect(canEditTask(staff('follower_01'), task())).toBe(false)
  })

  it('blocks unrelated staff', () => {
    expect(canEditTask(staff('stranger'), task())).toBe(false)
  })
})

// ===== canDeleteTask =====
describe('canDeleteTask', () => {
  it('allows admin', () => {
    expect(canDeleteTask(staff('anyone', { role: 'admin' }), task())).toBe(true)
  })

  it('allows creator', () => {
    expect(canDeleteTask(staff('creator_01'), task())).toBe(true)
  })

  it('blocks assignee from deleting', () => {
    expect(canDeleteTask(staff('assignee_01'), task())).toBe(false)
  })

  it('blocks collaborator from deleting', () => {
    expect(canDeleteTask(staff('collab_01'), task())).toBe(false)
  })
})

// ===== canChangeStatus =====
describe('canChangeStatus', () => {
  it('allows admin', () => {
    expect(canChangeStatus(staff('anyone', { role: 'admin' }), task())).toBe(true)
  })

  it('allows creator', () => {
    expect(canChangeStatus(staff('creator_01'), task())).toBe(true)
  })

  it('allows assignee', () => {
    expect(canChangeStatus(staff('assignee_01'), task())).toBe(true)
  })

  it('blocks collaborator from changing status', () => {
    expect(canChangeStatus(staff('collab_01'), task())).toBe(false)
  })

  it('blocks follower from changing status', () => {
    expect(canChangeStatus(staff('follower_01'), task())).toBe(false)
  })
})

// ===== canAssignTask =====
describe('canAssignTask', () => {
  it('allows admin', () => {
    expect(canAssignTask(staff('anyone', { role: 'admin' }), task())).toBe(true)
  })

  it('allows creator to reassign', () => {
    expect(canAssignTask(staff('creator_01'), task())).toBe(true)
  })

  it('blocks assignee from reassigning', () => {
    expect(canAssignTask(staff('assignee_01'), task())).toBe(false)
  })

  it('blocks collaborator from assigning', () => {
    expect(canAssignTask(staff('collab_01'), task())).toBe(false)
  })
})

// ===== canAddComment =====
describe('canAddComment', () => {
  it('allows admin', () => {
    expect(canAddComment(staff('anyone', { role: 'admin' }), task())).toBe(true)
  })

  it('allows creator', () => {
    expect(canAddComment(staff('creator_01'), task())).toBe(true)
  })

  it('allows assignee', () => {
    expect(canAddComment(staff('assignee_01'), task())).toBe(true)
  })

  it('allows collaborator', () => {
    expect(canAddComment(staff('collab_01'), task())).toBe(true)
  })

  it('blocks follower from commenting', () => {
    expect(canAddComment(staff('follower_01'), task())).toBe(false)
  })

  it('blocks unrelated staff from commenting', () => {
    expect(canAddComment(staff('stranger'), task())).toBe(false)
  })
})
