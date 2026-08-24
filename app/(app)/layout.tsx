'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef, Suspense } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Loader2, FileText, LogIn, LogOut, Settings, Menu, X, User, Folder, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth, AuthProvider } from '@/hooks/useAuth'
import { useRole } from '@/hooks/useRole'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { resetSession } from '@/lib/firebase'
import { TagSidebarPanel } from '@/components/tags/TagSidebarPanel'
import { DossierTreeNav } from '@/components/dossiers/DossierTreeNav'

function InnerAppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { role, isAdmin, isGuest, isStaff, staffName, logout: roleLogout } = useRole()
  const perms = usePermissions()
  const router = useRouter()
  const pathname = usePathname()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [dossiersTreeOpen, setDossiersTreeOpen] = useState(pathname.startsWith('/dossiers'))

  // Resizable sidebar width (min 200px, default 260px, max 480px)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const isResizingRef = useRef(false)
  const sidebarWidthRef = useRef(sidebarWidth)
  sidebarWidthRef.current = sidebarWidth

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
    if (tagId) {
      router.push(`/documents?tagId=${encodeURIComponent(tagId)}`)
    } else {
      router.push('/documents')
    }
  }

  const NAV = useMemo(() => {
    const items = [
      { href: '/documents', icon: FileText, label: 'Văn bản' },
    ]
    if (!isGuest) {
      items.push({ href: '/dossiers', icon: Folder, label: 'Quản lý Hồ sơ' })
    }
    if (perms.canAccessSettings) {
      items.push({ href: '/settings', icon: Settings, label: 'Cài đặt' })
    }
    return items
  }, [isGuest, perms.canAccessSettings])

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

      {/* Sidebar — fixed height, resizable width on desktop */}
      <aside
        style={{ width: `${sidebarWidth}px` }}
        className={`
          fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200
          flex flex-col h-screen relative group/sidebar
          transform transition-transform duration-200 ease-out
          lg:translate-x-0 lg:static lg:shrink-0 lg:z-auto
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
        <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
          {NAV.map(({ href, icon: Icon, label }) => {
            const isDossiersItem = href === '/dossiers'
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))

            return (
              <React.Fragment key={href}>
                {isDossiersItem ? (
                  <button
                    type="button"
                    onClick={() => {
                      router.push('/dossiers')
                      setDossiersTreeOpen(prev => !prev)
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 text-left w-full select-none cursor-pointer ${
                      active
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0 text-blue-600" />
                    <span className="flex-1">{label}</span>
                    {dossiersTreeOpen ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                ) : (
                  <Link
                    href={href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                      active
                        ? 'bg-slate-100 text-slate-900 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0 text-blue-600" />
                    <span className="flex-1">{label}</span>
                  </Link>
                )}

                {!isGuest && isDossiersItem && (
                  <div className="pl-1 pr-0.5 -mt-0.5">
                    <Suspense fallback={null}>
                      <DossierTreeNav isOpen={dossiersTreeOpen} />
                    </Suspense>
                  </div>
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

        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="h-full flex items-center justify-center bg-slate-50">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          }>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <InnerAppLayout>{children}</InnerAppLayout>
    </AuthProvider>
  )
}
