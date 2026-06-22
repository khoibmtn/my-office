'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export interface AppSettings {
  warningThreshold: number       // days - orange/warning
  dangerThreshold: number        // days - red/danger
  warningColor: string           // hex color
  dangerColor: string            // hex color
  normalColor: string            // hex color
  completedColor: string         // hex color
}

const DEFAULT_SETTINGS: AppSettings = {
  warningThreshold: 3,
  dangerThreshold: 0,
  warningColor: '#f59e0b',
  dangerColor: '#ef4444',
  normalColor: '#22c55e',
  completedColor: '#10b981',
}

export function useSettings(): AppSettings {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    const ref = doc(db(), 'settings', 'general')
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setSettings({
          warningThreshold: data.warningThreshold ?? DEFAULT_SETTINGS.warningThreshold,
          dangerThreshold: data.dangerThreshold ?? DEFAULT_SETTINGS.dangerThreshold,
          warningColor: data.warningColor ?? DEFAULT_SETTINGS.warningColor,
          dangerColor: data.dangerColor ?? DEFAULT_SETTINGS.dangerColor,
          normalColor: data.normalColor ?? DEFAULT_SETTINGS.normalColor,
          completedColor: data.completedColor ?? DEFAULT_SETTINGS.completedColor,
        })
      }
    })
    return unsub
  }, [])

  return settings
}
