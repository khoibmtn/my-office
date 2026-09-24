'use client'

import { useGlobalData } from '@/contexts/GlobalDataProvider'
import type { StaffMember } from '@/types'

/**
 * useStaff — reads from shared GlobalDataProvider context.
 * Eliminates duplicate Firestore listeners across 20+ consumers.
 */
export function useStaff(): {
  staff: StaffMember[]
  loading: boolean
  getStaffName: (staffId: string | undefined) => string
  getStaffById: (staffId: string | undefined) => StaffMember | undefined
} {
  const global = useGlobalData()
  return {
    staff: global.staff,
    loading: global.staffLoading,
    getStaffName: global.getStaffName,
    getStaffById: global.getStaffById,
  }
}
