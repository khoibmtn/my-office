'use client'

import React, { useState, useEffect } from 'react'
import {
  Key,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDriveToken } from '@/hooks/useDriveToken'
import { ADMIN_EMAIL } from '@/lib/firebase'
import { useRole } from '@/hooks/useRole'

export function DriveTokenBanner() {
  const { isAdmin, isGuest } = useRole()
  const { tokenInfo, refreshing, refreshToken, autoRenewIfExpired } = useDriveToken()

  const [modalOpen, setModalOpen] = useState(false)
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  // Auto-OAuth on app open:
  // When app opens, if token is expired, attempt auto-renew.
  // If silent auto-renew succeeds -> great!
  // If not -> prompt user with modal to authorize.
  useEffect(() => {
    // Only trigger for admin or non-guest who needs Drive
    if (isGuest) return

    let isMounted = true

    const runAutoAuth = async () => {
      const res = await autoRenewIfExpired()
      if (!isMounted) return

      // If silent auto-renew succeeds, do not disturb user with toasts or countdowns.
      // If silent refresh failed and user interaction is needed, show prompt modal.
      if (res && !res.success && res.needInteractive) {
        setModalOpen(true)
      }
    }

    runAutoAuth()

    return () => {
      isMounted = false
    }
  }, [autoRenewIfExpired, isGuest])

  const handleQuickRefresh = async (useRedirect = false, selectAccount = false) => {
    setErrorToast(null)
    setSuccessToast(null)

    const res = await refreshToken(useRedirect, {
      selectAccount,
      loginHint: ADMIN_EMAIL,
    })

    if (res.success) {
      if (!useRedirect) {
        setSuccessToast(`Đã làm mới token Google Drive (${ADMIN_EMAIL}) thành công!`)
        setModalOpen(false)
        setBannerDismissed(false)
        setTimeout(() => setSuccessToast(null), 3000)
      }
    } else {
      setErrorToast(res.error || 'Cấp lại token thất bại')
    }
  }

  // If user is guest, don't show Drive token alerts
  if (isGuest) return null

  const isExpired = tokenInfo.isExpired || !tokenInfo.hasToken

  return (
    <>
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
          <span>{successToast}</span>
        </div>
      )}

      {errorToast && (
        <div className="fixed top-4 right-4 z-50 bg-red-600 text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-200" />
          <span>{errorToast}</span>
          <button onClick={() => setErrorToast(null)} className="ml-2 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Top Banner ONLY shown when token is genuinely expired and silent refresh failed */}
      {isExpired && !bannerDismissed && (
        <div className="px-4 py-2 border-b text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2.5 bg-amber-50 border-amber-200 text-amber-900 transition-all">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="truncate">
              <span className="font-semibold">
                Chưa có kết nối Google Drive:
              </span>
              <span className="text-slate-600 ml-1.5">
                Cần cấp quyền để lưu file vào Drive ({ADMIN_EMAIL})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => handleQuickRefresh(false, false)}
              disabled={refreshing}
              className="h-7 px-2.5 text-xs font-medium shadow-xs bg-amber-600 hover:bg-amber-700 text-white"
            >
              {refreshing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              Kết nối Google Drive
            </Button>

            <button
              type="button"
              onClick={() => handleQuickRefresh(true, false)}
              disabled={refreshing}
              title="Chuyển hướng nếu popup bị chặn"
              className="text-[11px] text-blue-600 hover:underline hidden sm:inline-flex items-center gap-0.5"
            >
              <ExternalLink className="w-3 h-3" /> Chuyển hướng
            </button>

            <button
              onClick={() => setBannerDismissed(true)}
              className="p-1 rounded hover:bg-black/5 text-slate-400 hover:text-slate-600"
              title="Đóng thông báo này"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Interactive Modal when silent auto-OAuth fails */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900">
                  Cần cấp lại quyền Google Drive
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Token truy cập Google Drive đã hết hạn. Hệ thống đã tự động cấu hình liên kết với tài khoản quản trị:
                </p>
                <div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{ADMIN_EMAIL}</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-500 bg-amber-50/60 border border-amber-100 p-2.5 rounded-lg space-y-1">
              <p className="font-medium text-amber-800">
                💡 Tự động chọn tài khoản:
              </p>
              <p>
                Khi bấm cấp lại, Google sẽ tự động chọn tài khoản <strong>{ADMIN_EMAIL}</strong> mà không cần bạn phải tìm chọn trong danh sách, tránh bấm nhầm tài khoản khác.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                onClick={() => handleQuickRefresh(false, false)}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Key className="w-4 h-4 mr-2" />
                )}
                🔑 Cấp lại quyền Google Drive ({ADMIN_EMAIL})
              </Button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => handleQuickRefresh(true, false)}
                  disabled={refreshing}
                  className="text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Chuyển hướng toàn trang nếu bị chặn popup
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickRefresh(false, true)}
                  disabled={refreshing}
                  className="text-slate-500 hover:text-slate-700 underline"
                >
                  Chọn tài khoản khác
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-slate-500 hover:text-slate-700"
                onClick={() => setModalOpen(false)}
              >
                Để sau, vào xem văn bản
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
