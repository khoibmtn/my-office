import { Timestamp } from 'firebase/firestore'

// ===== Department Entity =====

export type DepartmentType = 'chức_năng' | 'lâm_sàng' | 'cận_lâm_sàng' | 'ban_giám_đốc'

export interface Department {
  id: string
  name: string                         // "Phòng Kế hoạch Tổng hợp"
  code: string                         // "KHTH"
  type: DepartmentType
  parentId: string | null              // For hierarchy (Phòng > Tổ)
  headStaffId: string | null           // Trưởng khoa/phòng
  deputyStaffIds: string[]             // Phó khoa/phòng
  order: number                        // Display order
  isActive: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
