'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithGoogle } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // If user is already logged in (e.g. after redirect), go to home
  if (user && !authLoading) {
    router.push('/')
    return null
  }

  async function handleLogin() {
    setError(null)
    setLoading(true)
    try {
      const result = await signInWithGoogle()
      // On localhost, popup returns result and we can redirect
      // On production, signInWithRedirect redirects the page, so this won't execute
      if (result) {
        router.push('/')
      }
      // If result is null, redirect is happening — just show loading
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? 'unknown'
      const msg = (err as { message?: string })?.message ?? ''
      console.log('Login:', code, msg)
      setError(code === 'auth/popup-blocked'
        ? 'Popup bị chặn. Cho phép popup trong trình duyệt hoặc thử lại.'
        : code
      )
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Quản lý Văn bản</h1>
        <p className="text-sm text-slate-500 mb-6">Đăng nhập để tiếp tục</p>
        <Button className="w-full" onClick={handleLogin} disabled={loading || authLoading}>
          {loading || authLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Đang xử lý...
            </>
          ) : (
            'Đăng nhập với Google'
          )}
        </Button>
        {error && (
          <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
        )}
      </div>
    </div>
  )
}
