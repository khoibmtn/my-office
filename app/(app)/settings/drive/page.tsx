'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Link2, RotateCcw, Loader2, ShieldCheck, ShieldX, RefreshCw } from 'lucide-react'
import { auth, linkGoogleAccount, resetSession, isGoogleUser, hasGoogleToken } from '@/lib/firebase'

export default function DrivePage() {
  const [googleLinked, setGoogleLinked] = useState(false)
  const [googleEmail, setGoogleEmail] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    checkGoogleStatus()
  }, [])

  function checkGoogleStatus() {
    const firebaseAuth = auth()
    const user = firebaseAuth.currentUser
    if (user && !user.isAnonymous) {
      setGoogleLinked(true)
      setGoogleEmail(user.email)
    } else {
      setGoogleLinked(false)
      setGoogleEmail(null)
    }
  }

  async function handleLinkGoogle() {
    setLinking(true)
    try {
      const user = await linkGoogleAccount()
      if (user) {
        setGoogleLinked(true)
        setGoogleEmail(user.email)
      }
    } catch (err: any) {
      alert('Lỗi liên kết Google: ' + (err?.message || String(err)))
    }
    setLinking(false)
  }

  async function handleReset() {
    if (!confirm('Bạn chắc chắn muốn hủy liên kết Google? Token sẽ bị xóa.')) return
    setResetting(true)
    try {
      await resetSession()
      setGoogleLinked(false)
      setGoogleEmail(null)
    } catch (err: any) {
      alert('Lỗi: ' + (err?.message || String(err)))
    }
    setResetting(false)
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-2">Google Drive</h1>
      <p className="text-sm text-gray-500 mb-6">Quản lý kết nối Google Drive cho tải file và đính kèm</p>

      {/* Google Account Status */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          {googleLinked
            ? <ShieldCheck className="h-5 w-5 text-green-600" />
            : <ShieldX className="h-5 w-5 text-gray-400" />
          }
          <h2 className="text-base font-semibold text-gray-800">Tài khoản & Phiên</h2>
        </div>

        <div className="space-y-4">
          {/* Drive connection */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Google Drive</p>
                {googleLinked ? (
                  <p className="text-sm text-green-600 mt-0.5">✅ Đã liên kết: <span className="font-medium">{googleEmail}</span></p>
                ) : (
                  <p className="text-sm text-gray-500 mt-0.5">Chưa liên kết — cần liên kết để tải file lên Google Drive</p>
                )}
              </div>
              {!googleLinked && (
                <Button size="sm" variant="outline" onClick={handleLinkGoogle} disabled={linking}>
                  {linking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
                  Liên kết Google
                </Button>
              )}
            </div>
          </div>

          {/* Extension token status */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-1">Phiên Extension</p>
            <p className="text-sm text-gray-500">
              {hasGoogleToken() ? (
                <span className="text-green-600">✅ Token có sẵn — Extension sẵn sàng</span>
              ) : (
                <span className="text-amber-600">⚠️ Chưa có token Drive — Hãy liên kết Google ở trên</span>
              )}
            </p>
          </div>

          {/* Reset session */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Đặt lại phiên</p>
              <p className="text-xs text-gray-500 mt-0.5">Hủy liên kết Google, xóa token. Dữ liệu văn bản vẫn được giữ nguyên.</p>
            </div>
            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={handleReset} disabled={resetting}>
              {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
              Đặt lại
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
