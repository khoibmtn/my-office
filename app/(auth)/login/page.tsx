'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, User, Shield, Loader2, Eye, EyeOff } from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import { hashPassword } from '@/lib/staff'
import { linkGoogleAccount } from '@/lib/firebase'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useRole()
  const [mode, setMode] = useState<'staff' | 'admin'>('staff')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nickname.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin')
      return
    }

    setLoading(true)
    setError('')

    try {
      const passwordHash = await hashPassword(password)
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), passwordHash }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Đăng nhập thất bại')
        return
      }

      // Save staff session
      login({
        staffId: data.staffId,
        staffDocId: data.staffDocId,
        shortName: data.shortName,
        fullName: data.fullName,
      })

      router.push('/documents')
    } catch (err) {
      setError('Lỗi kết nối. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  const handleAdminLogin = async () => {
    setLoading(true)
    setError('')
    try {
      await linkGoogleAccount()
      router.push('/')
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        setError('')
      } else {
        setError(err?.message || 'Đăng nhập Google thất bại')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Quản lý Văn bản</h1>
          <p className="text-sm text-slate-500 mt-1">Đăng nhập để sử dụng đầy đủ chức năng</p>
        </div>

        {/* Tab selector */}
        <div className="flex bg-slate-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => { setMode('staff'); setError('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'staff' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <User className="w-4 h-4" />
            Nhân viên
          </button>
          <button
            onClick={() => { setMode('admin'); setError('') }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
              mode === 'admin' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Shield className="w-4 h-4" />
            Quản trị
          </button>
        </div>

        {/* Login forms */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          {mode === 'staff' ? (
            <form onSubmit={handleStaffLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tên đăng nhập
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="Nhập nickname..."
                  autoComplete="username"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    autoComplete="current-password"
                    className="w-full px-3 py-2.5 pr-10 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Đăng nhập
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 text-center">
                Đăng nhập bằng tài khoản Google quản trị viên
              </p>
              <button
                onClick={handleAdminLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium border border-slate-300 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Đăng nhập bằng Google
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 text-center">
              {error}
            </div>
          )}
        </div>

        {/* Skip login */}
        <button
          onClick={() => router.push('/documents')}
          className="w-full mt-4 text-sm text-slate-400 hover:text-slate-600 transition-colors text-center py-2"
        >
          Tiếp tục không đăng nhập (chỉ xem)
        </button>
      </div>
    </div>
  )
}
