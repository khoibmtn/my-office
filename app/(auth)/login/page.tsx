'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithGoogle } from '@/lib/firebase'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    setError(null)
    try {
      await signInWithGoogle()
      router.push('/')
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? 'unknown'
      console.error('Login error:', err)
      setError(code)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">Quản lý Văn bản</h1>
        <p className="text-sm text-slate-500 mb-6">Đăng nhập để tiếp tục</p>
        <Button className="w-full" onClick={handleLogin}>
          Đăng nhập với Google
        </Button>
        {error && (
          <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
        )}
      </div>
    </div>
  )
}
