'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Link2, RotateCcw, Loader2, ShieldCheck, ShieldX, RefreshCw, Key, ExternalLink, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  auth,
  resetSession,
  requestGoogleDriveToken,
  getGoogleTokenExpiryInfo,
  hasGoogleToken,
} from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'

export default function DrivePage() {
  const { user } = useAuth()
  const [googleLinked, setGoogleLinked] = useState(false)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [tokenInfo, setTokenInfo] = useState<{
    hasToken: boolean
    isExpired: boolean
    savedAt: number | null
    minutesAgo: number | null
  }>({ hasToken: false, isExpired: true, savedAt: null, minutesAgo: null })

  const [refreshing, setRefreshing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const refreshStatus = useCallback(() => {
    const firebaseAuth = auth()
    const currentUser = firebaseAuth.currentUser || user
    if (currentUser && !currentUser.isAnonymous) {
      setGoogleLinked(true)
      setGoogleEmail(currentUser.email)
    } else {
      setGoogleLinked(false)
      setGoogleEmail(null)
    }
    setTokenInfo(getGoogleTokenExpiryInfo())
  }, [user])

  useEffect(() => {
    refreshStatus()
    // Poll every 30s to update minutes ago / expiration
    const interval = setInterval(refreshStatus, 30000)
    return () => clearInterval(interval)
  }, [refreshStatus])

  async function handleRefreshToken(useRedirect = false) {
    setRefreshing(true)
    setSuccessMessage(null)
    setErrorMessage(null)

    try {
      const res = await requestGoogleDriveToken(useRedirect)
      if (res.success) {
        if (!useRedirect) {
          refreshStatus()
          setSuccessMessage('Đã cấp lại token Google Drive thành công! Bạn có thể tiếp tục tải file và đính kèm.')
          setTimeout(() => setSuccessMessage(null), 5000)
        }
      } else {
        setErrorMessage(res.error || 'Cấp lại token thất bại')
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi cấp lại token Google Drive')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleReset() {
    if (!confirm('Bạn chắc chắn muốn hủy liên kết Google và đặt lại phiên? Bạn sẽ được chuyển về trang đăng nhập.')) return
    setResetting(true)
    try {
      await resetSession()
      window.location.href = '/login'
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || String(err)))
      setResetting(false)
    }
  }

  const isTokenActive = tokenInfo.hasToken && !tokenInfo.isExpired

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 mb-1">Google Drive</h1>
        <p className="text-sm text-gray-500">Quản lý kết nối Google Drive và cấp phát token để tải file và đồng bộ</p>
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Google Account Status */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2">
          {googleLinked ? (
            <ShieldCheck className="h-5 w-5 text-green-600" />
          ) : (
            <ShieldX className="h-5 w-5 text-gray-400" />
          )}
          <h2 className="text-base font-semibold text-gray-800">Tài khoản & Phiên làm việc</h2>
        </div>

        <div className="space-y-4">
          {/* Drive connection */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Tài khoản Google</p>
                {googleLinked ? (
                  <p className="text-sm text-green-600 mt-0.5 font-medium">
                    ✅ Đã liên kết: <span className="text-slate-900">{googleEmail}</span>
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 mt-0.5">Chưa liên kết — cần đăng nhập tài khoản Google quản trị</p>
                )}
              </div>
              {!googleLinked && (
                <Button size="sm" variant="outline" onClick={() => handleRefreshToken(false)} disabled={refreshing}>
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
                  Liên kết Google
                </Button>
              )}
            </div>
          </div>

          {/* Drive OAuth Token Status */}
          <div className={`p-4 rounded-lg border transition-all ${
            isTokenActive ? 'bg-green-50/60 border-green-200' : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-slate-600" />
                  Token truy cập Google Drive (OAuth)
                </p>
                {isTokenActive ? (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-sm text-green-700 font-medium">
                      ✅ Token đang hoạt động
                    </p>
                    <p className="text-xs text-slate-500">
                      {tokenInfo.minutesAgo !== null
                        ? `Đã cấp ${tokenInfo.minutesAgo} phút trước (hết hạn sau ${Math.max(0, 60 - tokenInfo.minutesAgo)} phút nữa)`
                        : 'Token có sẵn'}
                    </p>
                  </div>
                ) : (
                  <div className="mt-1 space-y-0.5">
                    <p className="text-sm text-amber-700 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      {tokenInfo.hasToken && tokenInfo.isExpired
                        ? 'Token đã hết hạn (> 1 giờ) — Cần làm mới'
                        : 'Chưa có token Drive — Cần cấp token'}
                    </p>
                    <p className="text-xs text-amber-600">
                      Google giới hạn token OAuth trong 1 giờ. Hãy bấm nút bên cạnh để cấp lại token mà không cần đăng xuất.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant={isTokenActive ? 'outline' : 'default'}
                  className={!isTokenActive ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm' : ''}
                  onClick={() => handleRefreshToken(false)}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : isTokenActive ? (
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                  ) : (
                    <Key className="h-4 w-4 mr-1.5" />
                  )}
                  {isTokenActive ? 'Làm mới Token' : '🔑 Cấp lại Token Drive'}
                </Button>

                {!isTokenActive && (
                  <button
                    type="button"
                    onClick={() => handleRefreshToken(true)}
                    disabled={refreshing}
                    className="text-xs text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Cấp lại bằng chuyển hướng toàn trang
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Extension token status */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-1">Đồng bộ Extension trình duyệt</p>
            <p className="text-sm text-gray-500">
              {isTokenActive ? (
                <span className="text-green-600 font-medium">✅ Token sẵn sàng — Extension đã được cấp quyền Drive</span>
              ) : (
                <span className="text-amber-600">⚠️ Chưa có token Drive — Hãy bấm cấp lại token ở trên để Extension hoạt động</span>
              )}
            </p>
          </div>

          {/* Reset session */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Đặt lại phiên</p>
              <p className="text-xs text-gray-500 mt-0.5">Hủy liên kết Google, xóa token và đăng xuất. Dữ liệu văn bản vẫn được giữ nguyên.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
              Đặt lại
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
