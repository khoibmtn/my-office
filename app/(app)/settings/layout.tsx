'use client'

import React, { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, Users, Shield, Tag, Settings, FolderSync } from 'lucide-react'
import { useRole } from '@/hooks/useRole'

const SETTINGS_TABS = [
  { id: 'organization', label: 'Tổ chức', icon: Building2, href: '/settings/organization' },
  { id: 'staff', label: 'Nhân sự', icon: Users, href: '/settings/staff' },
  { id: 'permissions', label: 'Phân quyền', icon: Shield, href: '/settings/permissions' },
  { id: 'tags', label: 'Nhãn', icon: Tag, href: '/settings/tags' },
  { id: 'general', label: 'Chung', icon: Settings, href: '/settings/general' },
  { id: 'drive', label: 'Drive', icon: FolderSync, href: '/settings/drive' },
] as const

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAdmin, isStaff } = useRole()

  // Determine active tab from pathname
  const activeTab = SETTINGS_TABS.find(t => pathname?.includes(t.id))?.id || 'organization'

  // Redirect non-admin/non-staff away
  if (!isAdmin && !isStaff) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Bạn không có quyền truy cập trang này.
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Sidebar tabs */}
      <div className="w-48 shrink-0 border-r border-gray-200 bg-gray-50/50 py-4">
        <h2 className="px-4 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Cấu hình
        </h2>
        <nav className="space-y-0.5 px-2">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            // Admin sees all tabs; staff sees only certain tabs
            if (!isAdmin && ['permissions', 'general', 'drive'].includes(tab.id)) {
              return null
            }
            return (
              <button
                key={tab.id}
                onClick={() => router.push(tab.href)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium
                  transition-colors duration-150
                  ${isActive
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        {children}
      </div>
    </div>
  )
}
