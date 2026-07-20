'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Loader2, LayoutDashboard, FileText, Search, LogOut, Settings, Menu, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { resetSession, isGoogleUser } from '@/lib/firebase'

const NAV = [
  { href: '/',            icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/documents',   icon: FileText,         label: 'Văn bản' },
  { href: '/search',      icon: Search,           label: 'Tìm kiếm' },
  { href: '/settings',    icon: Settings,         label: 'Cài đặt' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

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

  // If auth completely failed (very rare), still show the app
  // The Firestore hooks will handle their own errors

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200
          flex flex-col
          transform transition-transform duration-200 ease-out
          lg:translate-x-0 lg:static lg:w-52 lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <span className="text-lg font-semibold text-slate-900">Văn bản</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
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
        <div className="p-3 border-t border-slate-200">
          <Button className="w-full" size="sm" onClick={() => { setSidebarOpen(false); router.push('/documents/new') }}>
            + Thêm văn bản
          </Button>
          <Button
            className="w-full mt-2"
            size="sm"
            variant="ghost"
            onClick={async () => {
              await resetSession()
              // After reset, reload to get fresh anonymous auth
              window.location.reload()
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center h-14 px-4 bg-white border-b border-slate-200 sticky top-0 z-30">
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
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => router.push('/documents/new')}
          >
            + Thêm
          </Button>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
