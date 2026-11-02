'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef, Suspense } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Loader2, FileText, LogIn, LogOut, Settings, Menu, X, User, Folder, ChevronDown, ChevronRight, CheckSquare, LayoutDashboard, Kanban, CalendarDays, RefreshCw, PlusCircle, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { resetSession } from '@/lib/firebase'
import { TagSidebarPanel } from '@/components/tags/TagSidebarPanel'
import { DossierNavItem } from '@/components/dossiers/DossierTreeNav'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useRecurringScheduler } from '@/hooks/useRecurringScheduler'
import { GlobalDataProvider } from '@/contexts/GlobalDataProvider'
import { DriveTokenBanner } from '@/components/drive/DriveTokenBanner'
import { MobileTabBar } from '@/components/layout/MobileTabBar'

function InnerAppLayout({ children }: { children: React.ReactNode }) {
  useRecurringScheduler()
  const { user, loading } = useAuth()
  const { role, isAdmin, isGuest, isStaff, staffName, logout: roleLogout } = useRole()
  const perms = usePermissions()
  const router = useRouter()
  const pathname = usePathname()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)

  // Resizable sidebar width (min 200px, default 260px, max 480px)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [isDesktop, setIsDesktop] = useState(false)
  const isResizingRef = useRef(false)
  const sidebarWidthRef = useRef(sidebarWidth)
  sidebarWidthRef.current = sidebarWidth

  // Track lg breakpoint (>= 1024px) so inline sidebarWidth only applies on desktop
  useEffect(() => {
    const mql = window.matchMedia('(min-width:1024px)')
    const handleChange = () => setIsDesktop(mql.matches)
    handleChange()
    if (mql.addEventListener) {
      mql.addEventListener('change', handleChange)
      return () => mql.removeEventListener('change', handleChange)
    } else {
      mql.addListener(handleChange)
      return () => mql.removeListener(handleChange)
    }
  }, [])

  // Restore saved width from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_width')
    if (saved) {
      const w = parseInt(saved, 10)
      if (!isNaN(w) && w >= 200 && w <= 480) {
        setSidebarWidth(w)
      }
    }
  }, [])

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return
      const newWidth = Math.min(Math.max(moveEvent.clientX, 200), 480)
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        localStorage.setItem('sidebar_width', `${sidebarWidthRef.current}`)
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [])

  const handleSelectTag = (tagId: string | null) => {
    setSelectedTagId(tagId)
    setSidebarOpen(false)
    if (tagId) {
      router.push(`/documents?tagId=${encodeURIComponent(tagId)}`)
    } else {
      router.push('/documents')
    }
  }

  const headerInfo = useMemo(() => {
    if (pathname.startsWith('/tasks/kanban')) {
      return { title: 'Kanban', Icon: Kanban }
    }
    if (pathname.startsWith('/tasks/calendar')) {
      return { title: 'Lịch', Icon: CalendarDays }
    }
    if (pathname.startsWith('/tasks/recurring')) {
      return { title: 'Định kỳ', Icon: RefreshCw }
    }
    if (pathname.startsWith('/tasks')) {
      return { title: 'Công việc', Icon: CheckSquare }
    }
    if (pathname.startsWith('/dossiers')) {
      return { title: 'Hồ sơ', Icon: Folder }
    }
    if (pathname.startsWith('/dashboard') || pathname === '/') {
      return { title: 'Dashboard', Icon: LayoutDashboard }
    }
    if (pathname.startsWith('/settings')) {
      return { title: 'Cài đặt', Icon: Settings }
    }
    if (pathname.startsWith('/search')) {
      return { title: 'Tìm kiếm', Icon: Search }
    }
    return { title: 'Văn bản', Icon: FileText }
  }, [pathname])

  const NAV = useMemo(() => {
    const items = [
      { href: '/documents', icon: FileText, label: 'Văn bản' },
    ]
    if (!isGuest) {
      items.push({ href: '/dossiers', icon: Folder, label: 'Quản lý Hồ sơ' })
      items.push({ href: '/tasks', icon: CheckSquare, label: 'Công việc' })
      items.push({ href: '/tasks/kanban', icon: Kanban, label: 'Kanban' })
      items.push({ href: '/tasks/calendar', icon: CalendarDays, label: 'Lịch' })
      items.push({ href: '/tasks/recurring', icon: RefreshCw, label: 'Định kỳ' })
      items.push({ href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' })
    }
    if (perms.canAccessSettings) {
      items.push({ href: '/settings', icon: Settings, label: 'Cài đặt' })
    }
    return items
  }, [isGuest, perms.canAccessSettings])

  // Close sidebar + add menu on route change
  useEffect(() => {
    setSidebarOpen(false)
    setAddMenuOpen(false)
  }, [pathname])

  // Show loading spinner while auto-authenticating (usually < 1s)
  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="h-dvh w-full max-w-full flex bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixed height, resizable width on desktop */}
      <aside
        style={isDesktop ? { width: `${sidebarWidth}px` } : undefined}
        className={`
          fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px] lg:w-[260px] lg:max-w-none bg-white border-r border-slate-200
          flex flex-col h-dvh group/sidebar
          transform transition-transform duration-200 ease-out
          lg:translate-x-0 lg:relative lg:shrink-0 lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Resize handle bar on right border */}
        <div
          onMouseDown={startResizing}
          className="hidden lg:block absolute top-0 -right-1 w-2.5 h-full cursor-col-resize z-30 group/handle"
          title="Kéo để thay đổi độ rộng thanh bên"
        >
          <div className="w-1 h-full bg-transparent group-hover/handle:bg-blue-500/50 group-active/handle:bg-blue-600 transition-colors mx-auto" />
        </div>
        {/* Top: Brand & Notification */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <span className="text-lg font-semibold text-slate-900">Văn bản</span>
          <div className="flex items-center gap-1">
            {!isGuest && <NotificationBell userId={user?.uid || null} />}
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Đóng menu"
              className="tap lg:hidden -mr-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Middle: Nav — takes remaining space */}
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const isDossiersItem = href === '/dossiers'
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))

            return (
              <React.Fragment key={href}>
                {isDossiersItem ? (
                  <Suspense
                    fallback={
                      <div
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium shrink-0 ${
                          active
                            ? 'bg-slate-100 text-slate-900 font-semibold'
                            : 'text-slate-600'
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0 text-blue-600" />
                        <span className="flex-1">{label}</span>
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      </div>
                    }
                  >
                    <DossierNavItem active={active} />
                  </Suspense>
                ) : (
                  <Link
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                      active
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0 text-blue-600" />
                    <span className="flex-1">{label}</span>
                  </Link>
                )}
              </React.Fragment>
            )
          })}
        </nav>

        {/* Finder Sidebar Tag Panel */}
        {!isGuest && (
          <TagSidebarPanel
            selectedTagId={selectedTagId}
            onSelectTag={handleSelectTag}
          />
        )}

        {/* Bottom: Add menu + User info — always pinned at bottom */}
        <div className="p-3 border-t border-slate-200 shrink-0">
          {/* Add new button with upward popup menu */}
          {perms.canAddDocument && (
            <div className="relative mb-2" ref={addMenuRef}>
              <Button
                className="w-full"
                size="sm"
                onClick={() => setAddMenuOpen(!addMenuOpen)}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Thêm mới
              </Button>
              {addMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAddMenuOpen(false)} />
                  <div className="absolute bottom-full left-0 right-0 mb-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    <button
                      onClick={() => { setAddMenuOpen(false); setSidebarOpen(false); router.push('/tasks/new') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <CheckSquare className="h-4 w-4 text-emerald-500" />
                      <span>Thêm công việc</span>
                    </button>
                    <div className="border-t border-slate-100" />
                    <button
                      onClick={() => { setAddMenuOpen(false); setSidebarOpen(false); router.push('/documents/new') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span>Thêm văn bản</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

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
                window.location.href = '/login'
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Đăng xuất
            </Button>
          )}
        </div>
      </aside>

      {/* Main content — scrolls independently */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full h-dvh overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center h-14 px-4 bg-white border-b border-slate-200 shrink-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở menu"
            className="tap -ml-2 w-11 h-11 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2 ml-2 min-w-0">
            <headerInfo.Icon className="w-5 h-5 text-blue-600 shrink-0" />
            <span className="font-semibold text-slate-900 truncate">{headerInfo.title}</span>
          </div>
          <div className="flex-1" />
          {!isGuest && (
            <div className="mr-1 flex items-center shrink-0">
              <NotificationBell userId={user?.uid || null} />
            </div>
          )}
          {perms.canAddDocument && (
            <Button
              size="sm"
              className="tap min-h-[44px] min-w-[44px] h-11 px-3 text-xs shrink-0"
              onClick={() => router.push(pathname.startsWith('/tasks') ? '/tasks/new' : '/documents/new')}
            >
              + Thêm
            </Button>
          )}
        </header>

        {/* Drive OAuth Token Status & Auto-Renew Bar */}
        <DriveTokenBanner />

        <main className="flex-1 w-full max-w-full overflow-y-auto overflow-x-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          <Suspense fallback={
            <div className="h-full flex items-center justify-center bg-slate-50">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          }>
            {children}
          </Suspense>
        </main>

        <MobileTabBar items={NAV} canAddDocument={perms.canAddDocument} />
      </div>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalDataProvider>
      <InnerAppLayout>{children}</InnerAppLayout>
    </GlobalDataProvider>
  )
}
