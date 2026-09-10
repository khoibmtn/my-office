import type { UserRole } from './index'

// ===== Permission System =====

export type PermissionAction =
  // Văn bản
  | 'document:view_all' | 'document:view_department' | 'document:view_assigned'
  | 'document:create' | 'document:edit' | 'document:delete' | 'document:assign'
  // Công việc
  | 'task:view_all' | 'task:view_department' | 'task:view_assigned'
  | 'task:create' | 'task:edit' | 'task:delete' | 'task:assign'
  | 'task:change_status' | 'task:complete_assigned'
  // Hồ sơ
  | 'dossier:create' | 'dossier:edit' | 'dossier:delete' | 'dossier:transfer' | 'dossier:share'
  // Tổ chức
  | 'org:manage_departments' | 'org:manage_staff' | 'org:manage_roles'
  | 'org:view_all_departments' | 'org:view_own_department'
  // Cấu hình
  | 'settings:access' | 'settings:manage_tags' | 'settings:manage_permissions'
  | 'settings:manage_drive' | 'settings:manage_system'
  // Báo cáo
  | 'report:view_all' | 'report:view_department'

export type PermissionMatrix = Record<UserRole, Partial<Record<PermissionAction, boolean>>>

export interface PermissionGroup {
  label: string
  actions: { action: PermissionAction; label: string; description?: string }[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Văn bản',
    actions: [
      { action: 'document:view_all', label: 'Xem tất cả văn bản', description: 'Xem văn bản của mọi phòng ban' },
      { action: 'document:view_department', label: 'Xem văn bản phòng', description: 'Xem văn bản của phòng ban mình' },
      { action: 'document:view_assigned', label: 'Xem văn bản được giao', description: 'Chỉ xem văn bản mình xử lý' },
      { action: 'document:create', label: 'Thêm văn bản' },
      { action: 'document:edit', label: 'Sửa văn bản' },
      { action: 'document:delete', label: 'Xóa văn bản' },
      { action: 'document:assign', label: 'Phân công xử lý' },
    ],
  },
  {
    label: 'Công việc',
    actions: [
      { action: 'task:view_all', label: 'Xem tất cả công việc' },
      { action: 'task:view_department', label: 'Xem công việc phòng' },
      { action: 'task:view_assigned', label: 'Xem công việc được giao' },
      { action: 'task:create', label: 'Tạo công việc' },
      { action: 'task:edit', label: 'Sửa công việc' },
      { action: 'task:delete', label: 'Xóa công việc' },
      { action: 'task:assign', label: 'Giao công việc' },
      { action: 'task:change_status', label: 'Đổi trạng thái', description: 'Thay đổi trạng thái bất kỳ công việc' },
      { action: 'task:complete_assigned', label: 'Hoàn thành việc được giao' },
    ],
  },
  {
    label: 'Hồ sơ',
    actions: [
      { action: 'dossier:create', label: 'Tạo hồ sơ' },
      { action: 'dossier:edit', label: 'Sửa hồ sơ' },
      { action: 'dossier:delete', label: 'Xóa hồ sơ' },
      { action: 'dossier:transfer', label: 'Bàn giao hồ sơ' },
      { action: 'dossier:share', label: 'Chia sẻ hồ sơ' },
    ],
  },
  {
    label: 'Tổ chức',
    actions: [
      { action: 'org:manage_departments', label: 'Quản lý phòng ban', description: 'Thêm/sửa/xóa khoa phòng' },
      { action: 'org:manage_staff', label: 'Quản lý nhân sự', description: 'Gán nhân viên vào phòng ban' },
      { action: 'org:manage_roles', label: 'Quản lý vai trò', description: 'Thay đổi vai trò nhân viên' },
      { action: 'org:view_all_departments', label: 'Xem tất cả phòng ban' },
      { action: 'org:view_own_department', label: 'Xem phòng ban mình' },
    ],
  },
  {
    label: 'Cấu hình',
    actions: [
      { action: 'settings:access', label: 'Truy cập cài đặt' },
      { action: 'settings:manage_tags', label: 'Quản lý nhãn' },
      { action: 'settings:manage_permissions', label: 'Quản lý phân quyền' },
      { action: 'settings:manage_drive', label: 'Cấu hình Google Drive' },
      { action: 'settings:manage_system', label: 'Cấu hình hệ thống' },
    ],
  },
  {
    label: 'Báo cáo',
    actions: [
      { action: 'report:view_all', label: 'Xem báo cáo toàn bộ' },
      { action: 'report:view_department', label: 'Xem báo cáo phòng' },
    ],
  },
]

/**
 * Default permission matrix for all roles.
 * Admin has all permissions, others are restricted based on role hierarchy.
 */
export const DEFAULT_PERMISSION_MATRIX: PermissionMatrix = {
  admin: {
    'document:view_all': true, 'document:view_department': true, 'document:view_assigned': true,
    'document:create': true, 'document:edit': true, 'document:delete': true, 'document:assign': true,
    'task:view_all': true, 'task:view_department': true, 'task:view_assigned': true,
    'task:create': true, 'task:edit': true, 'task:delete': true, 'task:assign': true,
    'task:change_status': true, 'task:complete_assigned': true,
    'dossier:create': true, 'dossier:edit': true, 'dossier:delete': true, 'dossier:transfer': true, 'dossier:share': true,
    'org:manage_departments': true, 'org:manage_staff': true, 'org:manage_roles': true,
    'org:view_all_departments': true, 'org:view_own_department': true,
    'settings:access': true, 'settings:manage_tags': true, 'settings:manage_permissions': true,
    'settings:manage_drive': true, 'settings:manage_system': true,
    'report:view_all': true, 'report:view_department': true,
  },
  truong_phong: {
    'document:view_department': true, 'document:view_assigned': true,
    'document:create': true, 'document:edit': true, 'document:assign': true,
    'task:view_department': true, 'task:view_assigned': true,
    'task:create': true, 'task:edit': true, 'task:assign': true,
    'task:change_status': true, 'task:complete_assigned': true,
    'dossier:create': true, 'dossier:edit': true, 'dossier:delete': true, 'dossier:transfer': true, 'dossier:share': true,
    'org:manage_staff': true, 'org:view_own_department': true,
    'settings:access': true, 'settings:manage_tags': true,
    'report:view_department': true,
  },
  pho_phong: {
    'document:view_department': true, 'document:view_assigned': true,
    'document:create': true, 'document:edit': true, 'document:assign': true,
    'task:view_department': true, 'task:view_assigned': true,
    'task:create': true, 'task:edit': true, 'task:assign': true,
    'task:change_status': true, 'task:complete_assigned': true,
    'dossier:create': true, 'dossier:edit': true, 'dossier:share': true,
    'org:view_own_department': true,
    'settings:access': true,
    'report:view_department': true,
  },
  giao_viec: {
    'document:view_department': true, 'document:view_assigned': true,
    'document:create': true, 'document:edit': true, 'document:assign': true,
    'task:view_department': true, 'task:view_assigned': true,
    'task:create': true, 'task:edit': true, 'task:assign': true,
    'task:change_status': true, 'task:complete_assigned': true,
    'dossier:create': true, 'dossier:edit': true, 'dossier:share': true,
    'org:view_own_department': true,
  },
  nhan_vien: {
    'document:view_assigned': true,
    'task:view_assigned': true,
    'task:complete_assigned': true,
    'dossier:create': true, 'dossier:edit': true,
    'org:view_own_department': true,
  },
  guest: {
    'document:view_all': true,
    'org:view_all_departments': true,
  },
}
