'use client'

import React from 'react'
import Link from 'next/link'
import {
  BellRing,
  Building2,
  ClipboardList,
  FolderSync,
  Loader2,
  Settings,
  Shield,
  Tag,
  Users,
} from 'lucide-react'
import { useRole } from '@/hooks/useRole'

interface SettingCardItem {
  id: string
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const SETTING_ITEMS: SettingCardItem[] = [
  {
    id: 'organization',
    title: 'Tổ chức',
    description: 'Cây phòng ban, khoa phòng và cơ cấu đơn vị.',
    href: '/settings/organization',
    icon: Building2,
  },
  {
    id: 'staff',
    title: 'Nhân sự',
    description: 'Danh bạ cán bộ, tài khoản và chức vụ.',
    href: '/settings/staff',
    icon: Users,
  },
  {
    id: 'tags',
    title: 'Nhãn',
    description: 'Danh mục nhãn phân loại văn bản và công việc.',
    href: '/settings/tags',
    icon: Tag,
  },
  {
    id: 'weekly-report',
    title: 'Giao ban tuần & Văn bản tham mưu',
    description: 'Danh mục loại văn bản tham mưu, tiêu đề báo cáo và nhãn mục.',
    href: '/settings/weekly-report',
    icon: ClipboardList,
    adminOnly: true,
  },
  {
    id: 'permissions',
    title: 'Phân quyền',
    description: 'Ma trận quyền truy cập theo vai trò.',
    href: '/settings/permissions',
    icon: Shield,
    adminOnly: true,
  },
  {
    id: 'general',
    title: 'Chung',
    description: 'Màu sắc trạng thái hạn xử lý và tuỳ chỉnh chung.',
    href: '/settings/general',
    icon: Settings,
    adminOnly: true,
  },
  {
    id: 'drive',
    title: 'Drive',
    description: 'Kết nối và gia hạn token Google Drive.',
    href: '/settings/drive',
    icon: FolderSync,
    adminOnly: true,
  },
  {
    id: 'qlvb-watcher',
    title: 'QLVB Watcher',
    description: 'Theo dõi và đồng bộ văn bản từ cổng QLVB.',
    href: '/settings/qlvb-watcher',
    icon: BellRing,
    adminOnly: true,
  },
]

export default function SettingsPage() {
  const { isAdmin, loading } = useRole()

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center gap-2 text-base text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span>Đang tải danh mục cài đặt...</span>
      </div>
    )
  }

  const visibleItems = SETTING_ITEMS.filter((item) => !item.adminOnly || isAdmin)

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Danh mục cài đặt</h1>
        <p className="mt-1 text-base text-slate-600">
          Chọn mục cấu hình bạn muốn quản lý.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {visibleItems.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              href={item.href}
              className="min-h-[44px] flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-slate-900">{item.title}</h2>
                <p className="text-sm text-slate-600 mt-0.5 leading-snug">{item.description}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
