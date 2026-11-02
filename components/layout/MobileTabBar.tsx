'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FileText, CheckSquare, Folder, LayoutDashboard, PlusCircle } from 'lucide-react'

export interface MobileNavItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

interface MobileTabBarProps {
  items: MobileNavItem[]
  canAddDocument: boolean
}

const BOTTOM_TABS: MobileNavItem[] = [
  { href: '/documents', icon: FileText, label: 'Văn bản' },
  { href: '/tasks', icon: CheckSquare, label: 'Công việc' },
  { href: '/dossiers', icon: Folder, label: 'Hồ sơ' },
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
]

export function MobileTabBar({ items, canAddDocument }: MobileTabBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  useEffect(() => {
    setAddMenuOpen(false)
  }, [pathname])

  const visibleTabs = BOTTOM_TABS.filter((tab) =>
    items.some((item) => item.href === tab.href)
  )

  return (
    <nav
      aria-label="Thanh điều hướng di động"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 safe-bottom"
    >
      {addMenuOpen && canAddDocument && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setAddMenuOpen(false)}
          />
          <div className="absolute bottom-full right-3 mb-2 z-50 w-52 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <Link
              href="/tasks/new"
              onClick={(e) => {
                e.preventDefault()
                setAddMenuOpen(false)
                router.push('/tasks/new')
              }}
              className="w-full min-h-[44px] flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Thêm công việc</span>
            </Link>
            <div className="border-t border-slate-100" />
            <Link
              href="/documents/new"
              onClick={(e) => {
                e.preventDefault()
                setAddMenuOpen(false)
                router.push('/documents/new')
              }}
              className="w-full min-h-[44px] flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileText className="h-4 w-4 text-blue-500 shrink-0" />
              <span>Thêm văn bản</span>
            </Link>
          </div>
        </>
      )}

      <div className="flex items-stretch justify-around h-14 px-1">
        {visibleTabs.map(({ href, icon: Icon, label }) => {
          const active =
            pathname === href ||
            (href !== '/' && pathname.startsWith(`${href}/`)) ||
            (href === '/dashboard' && pathname === '/')

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`tap flex-1 flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] transition-colors relative ${
                active
                  ? 'text-blue-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              {active && (
                <span className="absolute top-0 inset-x-3 h-0.5 bg-blue-600 rounded-full" />
              )}
              <Icon
                className={`h-5 w-5 shrink-0 ${
                  active ? 'text-blue-600' : 'text-slate-500'
                }`}
              />
              <span className="truncate max-w-full px-1">{label}</span>
            </Link>
          )
        })}

        {canAddDocument && (
          <button
            type="button"
            onClick={() => setAddMenuOpen((prev) => !prev)}
            aria-expanded={addMenuOpen}
            className={`tap flex-1 flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] transition-colors relative ${
              addMenuOpen
                ? 'text-blue-600 font-semibold'
                : 'text-slate-500 hover:text-slate-900 font-medium'
            }`}
          >
            <PlusCircle
              className={`h-5 w-5 shrink-0 ${
                addMenuOpen ? 'text-blue-600' : 'text-slate-500'
              }`}
            />
            <span className="truncate max-w-full px-1">Thêm</span>
          </button>
        )}
      </div>
    </nav>
  )
}
