'use client'

/**
 * Global Data Store — shares ONE Firestore listener per collection across
 * all components that need the data. Eliminates duplicate onSnapshot calls.
 *
 * Before: 10 components using useDocuments() = 10 Firestore listeners
 * After:  10 components using useDocuments() = 1 Firestore listener (via context)
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import { useRole } from '@/hooks/useRole'
import type { Document, StaffMember, Dossier } from '@/types'

// ─── Context shape ───
interface GlobalData {
  // Documents
  documents: Document[]
  documentsLoading: boolean

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

  useEffect(() => {
    let unsub: (() => void) | null = null
    ensureAuth().then(() => {
      const q = query(collection(db(), 'documents'), orderBy('createdAt', 'desc'))
      unsub = onSnapshot(
        q,
        (snapshot) => {
          setDocuments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Document)))
          setDocumentsLoading(false)
        },
        (error) => {
          console.error('[GlobalData:documents] error:', error.code, error.message)
          setDocumentsLoading(false)
        }
      )
    }).catch((err) => {
      console.error('[GlobalData:documents] ensureAuth failed:', err)
      setDocumentsLoading(false)
    })
    return () => { if (unsub) unsub() }
  }, [])

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
    staff,
    staffLoading,
    getStaffName,
    getStaffById,
    dossiers,
    dossiersLoading,
  }), [documents, documentsLoading, staff, staffLoading, getStaffName, getStaffById, dossiers, dossiersLoading])

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
