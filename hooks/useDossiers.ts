'use client'

import { useGlobalData } from '@/contexts/GlobalDataProvider'
import type { Dossier } from '@/types'

/**
 * useDossiers — reads from shared GlobalDataProvider context.
 * Eliminates duplicate Firestore listeners across 10+ consumers.
 */
export function useDossiers(): { dossiers: Dossier[]; loading: boolean } {
  const global = useGlobalData()
  return { dossiers: global.dossiers, loading: global.dossiersLoading }
}
