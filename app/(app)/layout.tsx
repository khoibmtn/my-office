'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Loader2, FileText, LogIn, LogOut, Settings, Menu, X, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { resetSession } from '@/lib/firebase'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { role, isAdmin, isGuest, isStaff, staffName, logout: roleLogout } = useRole()
  const perms = usePermissions()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const NAV = useMemo(() => {
    const items = [
      { href: '/documents', icon: FileText, label: 'Văn bản' },
    ]
    if (perms.canAccessSettings) {
      items.push({ href: '/settings', icon: Settings, label: 'Cài đặt' })
    }
    return items
  }, [perms.canAccessSettings])

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Show loading spinner while auto-authenticating (usually < 1s)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed height, never scrolls */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-56 bg-white border-r border-slate-200
          flex flex-col h-screen
          transform transition-transform duration-200 ease-out
          lg:translate-x-0 lg:static lg:shrink-0 lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Top: Brand */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <span className="text-lg font-semibold text-slate-900">Văn bản</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Middle: Nav — takes remaining space */}
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-hidden">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                  active
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom: User info + actions — always pinned at bottom */}
        <div className="p-3 border-t border-slate-200 shrink-0">
          {/* Role badge */}
          {!isGuest && (
            <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-slate-50 text-xs">
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span className="font-medium text-slate-700 truncate">
                {isAdmin ? 'Admin' : staffName || 'Nhân viên'}
              </span>
              <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold ${
                isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              }`}>
                {isAdmin ? 'Admin' : 'Staff'}
              </span>
            </div>
          )}

          {/* Add document button - only for users with permission */}
          {perms.canAddDocument && (
            <Button className="w-full" size="sm" onClick={() => { setSidebarOpen(false); router.push('/documents/new') }}>
              + Thêm văn bản
            </Button>
          )}

          {/* Login/Logout button */}
          {isGuest ? (
            <Button
              className="w-full mt-2"
              size="sm"
              variant="outline"
              onClick={() => { setSidebarOpen(false); router.push('/login') }}
            >
              <LogIn className="h-4 w-4 mr-2" />
              Đăng nhập
            </Button>
          ) : (
            <Button
              className="w-full mt-2"
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (isStaff) {
                  roleLogout()
                } else {
                  await resetSession()
                }
                window.location.reload()
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Đăng xuất
            </Button>
          )}
        </div>
      </aside>

      {/* Main content — scrolls independently */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center h-14 px-4 bg-white border-b border-slate-200 shrink-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2 ml-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-slate-900">Văn bản</span>
          </div>
          <div className="flex-1" />
          {perms.canAddDocument && (
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => router.push('/documents/new')}
            >
              + Thêm
            </Button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
