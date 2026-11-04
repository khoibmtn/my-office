'use client'

/**
 * Global Data Store — shares ONE Firestore listener per collection across
 * all components that need the data. Eliminates duplicate onSnapshot calls.
 *
 * Before: 10 components using useDocuments() = 10 Firestore listeners
 * After:  10 components using useDocuments() = 1 Firestore listener (via context)
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { collection, getDocsFromServer, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import { useRole } from '@/hooks/useRole'
import type { Document, StaffMember, Dossier } from '@/types'

// ─── Context shape ───
interface GlobalData {
  // Documents
  documents: Document[]
  documentsLoading: boolean
  /** Re-fetch documents from the server and restart the live listener */
  refreshDocuments: () => Promise<void>
  documentsRefreshing: boolean
  documentsUpdatedAt: number | null

  // Staff
  staff: StaffMember[]
  staffLoading: boolean
  getStaffName: (staffId: string | undefined) => string
  getStaffById: (staffId: string | undefined) => StaffMember | undefined

  // Dossiers
  dossiers: Dossier[]
  dossiersLoading: boolean
}

const GlobalDataContext = createContext<GlobalData | null>(null)

// ─── Provider ───
export function GlobalDataProvider({ children }: { children: React.ReactNode }) {
  const { role, staffId, isAdmin } = useRole()

  // === Documents ===
  const [documents, setDocuments] = useState<Document[]>([])
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [documentsRefreshing, setDocumentsRefreshing] = useState(false)
  const [documentsUpdatedAt, setDocumentsUpdatedAt] = useState<number | null>(null)
  // Bumping the epoch tears down and re-creates the onSnapshot listener
  const [documentsEpoch, setDocumentsEpoch] = useState(0)
  const documentsRef = useRef<Document[]>([])
  documentsRef.current = documents

  useEffect(() => {
    let unsub: (() => void) | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    ensureAuth().then(() => {
      if (cancelled) return
      const q = query(collection(db(), 'documents'), orderBy('createdAt', 'desc'))
      unsub = onSnapshot(
        q,
        (snapshot) => {
          setDocuments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Document)))
          setDocumentsLoading(false)
          if (!snapshot.metadata.fromCache) setDocumentsUpdatedAt(Date.now())
        },
        (error) => {
          // A failed listener never recovers on its own — restart it after a short delay
          console.error('[GlobalData:documents] error:', error.code, error.message)
          setDocumentsLoading(false)
          retryTimer = setTimeout(() => setDocumentsEpoch((e) => e + 1), 5000)
        }
      )
    }).catch((err) => {
      console.error('[GlobalData:documents] ensureAuth failed:', err)
      setDocumentsLoading(false)
    })
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      if (unsub) unsub()
    }
  }, [documentsEpoch])

  const refreshingRef = useRef(false)
  const refreshDocuments = useCallback(async () => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    setDocumentsRefreshing(true)
    try {
      await ensureAuth()
      const snap = await getDocsFromServer(query(collection(db(), 'documents'), orderBy('createdAt', 'desc')))
      setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Document)))
      setDocumentsUpdatedAt(Date.now())
      setDocumentsEpoch((e) => e + 1) // the old stream may be stalled — start a fresh one
    } catch (err) {
      console.error('[GlobalData:documents] refresh failed:', err)
    } finally {
      refreshingRef.current = false
      setDocumentsRefreshing(false)
    }
  }, [])

  // Safety net for a silently stalled stream (sleep, tab hidden, flaky network):
  //  - refresh when the tab becomes visible after ≥30s hidden, or the network comes back
  //  - every 60s while visible, read the newest created + newest updated document from the
  //    server (2 reads) and refresh if the live list doesn't have that version yet
  useEffect(() => {
    let hiddenAt: number | null = null
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
      } else if (hiddenAt && Date.now() - hiddenAt >= 30_000) {
        hiddenAt = null
        void refreshDocuments()
      }
    }
    const onOnline = () => void refreshDocuments()

    const millis = (v: unknown) =>
      v && typeof (v as { toMillis?: () => number }).toMillis === 'function'
        ? (v as { toMillis: () => number }).toMillis()
        : 0
    const probe = async () => {
      if (document.visibilityState !== 'visible' || refreshingRef.current) return
      try {
        await ensureAuth()
        const col = collection(db(), 'documents')
        const [newest, lastUpdated] = await Promise.all([
          getDocsFromServer(query(col, orderBy('createdAt', 'desc'), limit(1))),
          getDocsFromServer(query(col, orderBy('updatedAt', 'desc'), limit(1))),
        ])
        const current = new Map(documentsRef.current.map((d) => [d.id, d]))
        const stale = [...newest.docs, ...lastUpdated.docs].some((snap) => {
          const local = current.get(snap.id)
          return !local || millis(snap.data().updatedAt) > millis(local.updatedAt)
        })
        if (stale) {
          console.info('[GlobalData:documents] live list is behind the server — refreshing')
          void refreshDocuments()
        }
      } catch {
        // offline or transient — the next tick will try again
      }
    }
    const interval = setInterval(probe, 60_000)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
    }
  }, [refreshDocuments])

  // === Staff ===
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [staffLoading, setStaffLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null
    ensureAuth().then(() => {
      const q = query(collection(db(), 'staff'), orderBy('shortName', 'asc'))
      unsub = onSnapshot(
        q,
        (snap) => {
          setStaff(snap.docs.map(d => {
            const data = d.data() as StaffMember
            return { ...data, _docId: d.id } as StaffMember & { _docId: string }
          }))
          setStaffLoading(false)
        },
        (error) => {
          console.error('[GlobalData:staff] error:', error.code, error.message)
          setStaffLoading(false)
        }
      )
    })
    return () => { if (unsub) unsub() }
  }, [])

  const staffMap = useMemo(() => {
    const map = new Map<string, StaffMember>()
    staff.forEach(s => {
      if (s.id) map.set(s.id, s)
      if (s.shortName) map.set(s.shortName, s)
    })
    return map
  }, [staff])

  const getStaffName = useCallback((id: string | undefined): string => {
    if (!id) return ''
    return staffMap.get(id)?.shortName || id
  }, [staffMap])

  const getStaffById = useCallback((id: string | undefined): StaffMember | undefined => {
    if (!id) return undefined
    return staffMap.get(id)
  }, [staffMap])

  // === Dossiers ===
  const [allDossiers, setAllDossiers] = useState<Dossier[]>([])
  const [dossiersLoading, setDossiersLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null
    ensureAuth().then(() => {
      unsub = onSnapshot(
        collection(db(), 'dossiers'),
        (snap) => {
          setAllDossiers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Dossier)))
          setDossiersLoading(false)
        },
        (err) => {
          console.error('[GlobalData:dossiers] error:', err)
          setDossiersLoading(false)
        }
      )
    }).catch(err => {
      console.error('[GlobalData:dossiers] ensureAuth failed:', err)
      setDossiersLoading(false)
    })
    return () => { if (unsub) unsub() }
  }, [])

  // Client-side filter (same logic as useDossiers)
  const dossiers = useMemo(() => {
    const active = allDossiers.filter(d => !d.deletedAt)
    const userDossiers = isAdmin
      ? active
      : active.filter(d => !d.ownerId || d.ownerId === staffId || d.ownerId === 'admin' || d.ownerId === 'unknown')
    userDossiers.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    return userDossiers
  }, [allDossiers, isAdmin, staffId])

  // === Memoized value to prevent unnecessary re-renders ===
  const value = useMemo<GlobalData>(() => ({
    documents,
    documentsLoading,
    refreshDocuments,
    documentsRefreshing,
    documentsUpdatedAt,
    staff,
    staffLoading,
    getStaffName,
    getStaffById,
    dossiers,
    dossiersLoading,
  }), [documents, documentsLoading, refreshDocuments, documentsRefreshing, documentsUpdatedAt, staff, staffLoading, getStaffName, getStaffById, dossiers, dossiersLoading])

  return (
    <GlobalDataContext.Provider value={value}>
      {children}
    </GlobalDataContext.Provider>
  )
}

// ─── Consumer hooks — drop-in replacements ───

export function useGlobalData() {
  const ctx = useContext(GlobalDataContext)
  if (!ctx) throw new Error('useGlobalData must be inside GlobalDataProvider')
  return ctx
}
