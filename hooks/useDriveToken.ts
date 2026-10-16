'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getGoogleTokenExpiryInfo,
  requestGoogleDriveToken,
  type GoogleTokenExpiryInfo,
  ADMIN_EMAIL,
} from '@/lib/firebase'

export function useDriveToken() {
  const [tokenInfo, setTokenInfo] = useState<GoogleTokenExpiryInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        hasToken: false,
        isExpired: true,
        savedAt: null,
        minutesAgo: null,
        expiresInMinutes: 0,
        remainingMs: 0,
        remainingFormatted: 'Chưa có token',
      }
    }
    return getGoogleTokenExpiryInfo()
  })

  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null)
  const autoAttemptedRef = useRef(false)

  const updateStatus = useCallback(() => {
    const info = getGoogleTokenExpiryInfo()
    setTokenInfo(info)
    return info
  }, [])

  // Listen to token update events & poll every 20 seconds
  useEffect(() => {
    updateStatus()

    const handleTokenUpdated = () => {
      updateStatus()
      setLastRefreshedAt(Date.now())
    }

    window.addEventListener('google_token_updated', handleTokenUpdated)
    const interval = setInterval(updateStatus, 20000)

    return () => {
      window.removeEventListener('google_token_updated', handleTokenUpdated)
      clearInterval(interval)
    }
  }, [updateStatus])

  /**
   * Refresh or re-acquire token.
   * By default, passes loginHint: ADMIN_EMAIL to avoid accidental selection of other Google accounts!
   */
  const refreshToken = useCallback(async (
    useRedirect = false,
    options?: { selectAccount?: boolean; loginHint?: string }
  ) => {
    setRefreshing(true)
    try {
      const res = await requestGoogleDriveToken(useRedirect, {
        loginHint: options?.loginHint || ADMIN_EMAIL,
        selectAccount: options?.selectAccount,
      })
      updateStatus()
      if (res.success) {
        setLastRefreshedAt(Date.now())
      }
      return res
    } catch (err: any) {
      return { success: false, error: err?.message || 'Lỗi cấp lại token' }
    } finally {
      setRefreshing(false)
    }
  }, [updateStatus])

  /**
   * Auto-check on application mount:
   * If token is expired, attempts silent renewal first via server refresh token.
   * If silent renewal succeeds, user seamlessly enters main interface.
   * If not, indicates that user interaction (OAuth prompt) is required.
   */
  const autoRenewIfExpired = useCallback(async () => {
    if (autoAttemptedRef.current) return { alreadyAttempted: true }
    autoAttemptedRef.current = true

    const currentInfo = updateStatus()
    if (!currentInfo.isExpired && currentInfo.hasToken) {
      return { success: true, alreadyActive: true }
    }

    // Attempt silent refresh
    setRefreshing(true)
    try {
      const res = await requestGoogleDriveToken(false, {
        loginHint: ADMIN_EMAIL,
        skipSilent: false,
      })
      updateStatus()
      if (res.success && res.method === 'silent') {
        setLastRefreshedAt(Date.now())
        return { success: true, autoSilent: true }
      }
      return { success: false, needInteractive: true }
    } catch (err) {
      return { success: false, needInteractive: true }
    } finally {
      setRefreshing(false)
    }
  }, [updateStatus])

  return {
    tokenInfo,
    refreshing,
    lastRefreshedAt,
    refreshToken,
    autoRenewIfExpired,
    updateStatus,
  }
}
