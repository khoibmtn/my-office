'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { useStaff } from '@/hooks/useStaff'
import { useOrganization } from '@/hooks/useOrganization'
import { checkPermissionForRole, loadPermissionMatrix } from '@/lib/permissions'

export default function HomePage() {
  const router = useRouter()
  const { role, isAdmin, staffId, loading: roleLoading } = useRole()
  const { loading: staffLoading } = useStaff()
  const {
    effectiveRole,
    hasPermission,
    permissionMatrix,
    loading: orgLoading,
  } = useOrganization()
  const [matrixReady, setMatrixReady] = useState(false)

  useEffect(() => {
    let active = true
    loadPermissionMatrix()
      .catch(() => {})
      .finally(() => {
        if (active) setMatrixReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  // Wait until auth/role, staff list (needed by useOrganization to resolve effectiveRole),
  // departments, and permission matrix have all finished loading.
  const isRoleResolved =
    !roleLoading &&
    !orgLoading &&
    !staffLoading &&
    matrixReady &&
    // If a non-admin staffId is present in session, wait until staffLoading is false
    (!staffId || isAdmin || !staffLoading)

  useEffect(() => {
    if (!isRoleResolved) return

    const resolvedRole = effectiveRole !== 'guest' ? effectiveRole : role

    const canViewReport =
      isAdmin ||
      hasPermission('report:view_all') ||
      hasPermission('report:view_department') ||
      checkPermissionForRole(permissionMatrix, resolvedRole, 'report:view_all') ||
      checkPermissionForRole(permissionMatrix, resolvedRole, 'report:view_department')

    router.replace(canViewReport ? '/dashboard' : '/tasks')
  }, [
    router,
    isRoleResolved,
    role,
    effectiveRole,
    isAdmin,
    hasPermission,
    permissionMatrix,
  ])

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
    </div>
  )
}
