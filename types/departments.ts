import { Timestamp } from 'firebase/firestore'

// ===== Department Entity =====

export type DepartmentType = 'chức_năng' | 'lâm_sàng' | 'cận_lâm_sàng' | 'ban_giám_đốc' | 'khác'

export interface Department {
  id: string
  name: string                         // "Phòng Kế hoạch Nghiệp vụ"
  shortName?: string                   // "KHNV" — tên viết tắt
  code: string                         // "KHNV"
  type: DepartmentType
  parentId: string | null              // For hierarchy (Phòng > Tổ)
  headStaffId: string | null           // Trưởng khoa/phòng
  deputyStaffIds: string[]             // Phó khoa/phòng
  memberCount?: number                 // Denormalized: số nhân viên
  description?: string                 // Mô tả chức năng, nhiệm vụ
  phone?: string                       // Số điện thoại phòng
  location?: string                    // Vị trí (VD: "Tầng 3, Nhà A")
  order: number                        // Display order
  isActive: boolean
  color?: string                       // Màu badge phòng ban
  createdAt: Timestamp
  updatedAt: Timestamp
}

