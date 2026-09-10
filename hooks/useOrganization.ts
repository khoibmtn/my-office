'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { subscribeDepartments, subscribeDepartmentMembers } from '@/lib/departments'
import { loadPermissionMatrix } from '@/lib/permissions'
import { checkPermissionForRole, getEffectiveRole } from '@/lib/permissions'
import { useRole } from './useRole'
import { useStaff } from './useStaff'
import type { Department } from '@/types/departments'
import type { StaffMember, UserRole } from '@/types'
import type { PermissionAction, PermissionMatrix } from '@/types/permissions'
import { DEFAULT_PERMISSION_MATRIX } from '@/types/permissions'
import { normalizeRole } from '@/types'

/**
 * Hook providing organization-wide context:
 * - departments: all active departments
 * - currentStaff: the currently logged-in staff member
 * - effectiveRole: the effective role considering department context
 * - hasPermission(action): check if current user has a specific permission
 * - departmentMap: id → Department lookup
 */
export function useOrganization(activeDepartmentId?: string | null) {
  const { staffId } = useRole()
  const { staff: staffList } = useStaff()
  const [departments, setDepartments] = useState<Department[]>([])
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrix>(DEFAULT_PERMISSION_MATRIX)
  const [loading, setLoading] = useState(true)

  // Subscribe to departments list
  useEffect(() => {
    const unsub = subscribeDepartments(
      (depts) => {
        setDepartments(depts)
        setLoading(false)
      },
      (err) => {
        console.error('[useOrganization] departments error:', err)
        setLoading(false)
      }
    )
    return unsub
  }, [])

  // Load permission matrix
  useEffect(() => {
    loadPermissionMatrix().then(setPermissionMatrix).catch(console.error)
  }, [])

  // Current staff member
  const currentStaff = useMemo(() => {
    if (!staffId || !staffList.length) return null
    return staffList.find((s: StaffMember) => s.id === staffId) || null
  }, [staffId, staffList])

  // Department lookup map
  const departmentMap = useMemo(() => {
    const map: Record<string, Department> = {}
    departments.forEach(d => { map[d.id] = d })
    return map
  }, [departments])

  // Current department (active context)
  const currentDepartment = useMemo(() => {
    const deptId = activeDepartmentId || currentStaff?.primaryDepartmentId
    return deptId ? departmentMap[deptId] || null : null
  }, [activeDepartmentId, currentStaff, departmentMap])

  // Effective role (considering department context)
  const effectiveRole = useMemo((): UserRole => {
    if (!currentStaff) return 'guest'
    return getEffectiveRole(currentStaff, activeDepartmentId || currentStaff.primaryDepartmentId)
  }, [currentStaff, activeDepartmentId])

  // Permission check function
  const hasPermission = useCallback((action: PermissionAction): boolean => {
    return checkPermissionForRole(permissionMatrix, effectiveRole, action)
  }, [permissionMatrix, effectiveRole])

  return {
    // Data
    departments,
    departmentMap,
    currentStaff,
    currentDepartment,
    effectiveRole,
    permissionMatrix,
    loading,

    // Functions
    hasPermission,
  }
}
