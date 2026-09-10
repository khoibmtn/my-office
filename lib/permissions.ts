import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { UserRole } from '@/types'
import { normalizeRole } from '@/types'
import type { PermissionAction, PermissionMatrix } from '@/types/permissions'
import { DEFAULT_PERMISSION_MATRIX } from '@/types/permissions'
import type { StaffMember } from '@/types'

const SETTINGS_DOC = 'settings'
const PERMISSIONS_DOC = 'permissionMatrix'

/**
 * Get the effective role of a staff member for a specific department.
 * Considers departmentRoles overrides for concurrent (kiêm nhiệm) positions.
 */
export function getEffectiveRole(
  staff: StaffMember,
  departmentId?: string | null
): UserRole {
  // Admin is always admin regardless of department
  const baseRole = normalizeRole(staff.organizationRole)
  if (baseRole === 'admin') return 'admin'

  // Check for department-specific role override
  if (departmentId && staff.departmentRoles?.[departmentId]) {
    return normalizeRole(staff.departmentRoles[departmentId])
  }

  // If viewing a department they're not primary in, default to nhan_vien
  if (departmentId && staff.primaryDepartmentId !== departmentId) {
    return 'nhan_vien'
  }

  return baseRole
}

/**
 * Check if a role has a specific permission action.
 */
export function checkPermissionForRole(
  matrix: PermissionMatrix,
  role: UserRole,
  action: PermissionAction
): boolean {
  return matrix[role]?.[action] === true
}

/**
 * Check if a staff member has a specific permission.
 * Takes into account the effective role for the current department context.
 */
export function checkPermission(
  matrix: PermissionMatrix,
  staff: StaffMember,
  action: PermissionAction,
  departmentId?: string | null
): boolean {
  const effectiveRole = getEffectiveRole(staff, departmentId)
  return checkPermissionForRole(matrix, effectiveRole, action)
}

/**
 * Load the custom permission matrix from Firestore.
 * Falls back to DEFAULT_PERMISSION_MATRIX if not found.
 */
export async function loadPermissionMatrix(): Promise<PermissionMatrix> {
  try {
    const snap = await getDoc(doc(db(), SETTINGS_DOC, PERMISSIONS_DOC))
    if (snap.exists()) {
      const data = snap.data()
      // Merge with defaults to ensure all roles/actions exist
      const result = { ...DEFAULT_PERMISSION_MATRIX }
      for (const role of Object.keys(result) as UserRole[]) {
        if (data[role]) {
          result[role] = { ...result[role], ...data[role] }
        }
      }
      return result
    }
  } catch (err) {
    console.error('[permissions] Error loading matrix:', err)
  }
  return { ...DEFAULT_PERMISSION_MATRIX }
}

/**
 * Save the permission matrix to Firestore.
 */
export async function savePermissionMatrix(matrix: PermissionMatrix): Promise<void> {
  await setDoc(doc(db(), SETTINGS_DOC, PERMISSIONS_DOC), matrix)
}

/**
 * Get the default permission matrix.
 */
export function getDefaultPermissionMatrix(): PermissionMatrix {
  return { ...DEFAULT_PERMISSION_MATRIX }
}
