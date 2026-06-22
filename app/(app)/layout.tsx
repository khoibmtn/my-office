'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Loader2, LayoutDashboard, FileText, Search, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { signOutUser } from '@/lib/firebase'

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

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200">
          <span className="text-lg font-semibold text-slate-900">Văn bản</span>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <Button className="w-full" size="sm" onClick={() => router.push('/documents/new')}>
            + Thêm văn bản
          </Button>
          <Button
            className="w-full mt-2"
            size="sm"
            variant="ghost"
            onClick={() => { signOutUser(); router.push('/login') }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Đăng xuất
          </Button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <main>{children}</main>
      </div>
    </div>
  )
}
