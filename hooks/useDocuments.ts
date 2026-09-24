'use client'

import { useEffect, useState, useContext, createContext } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db, ensureAuth } from '../lib/firebase'
import type { Document } from '../types'

// Import the context directly to avoid circular dependency issues
// The GlobalDataContext is exported from the provider
import { useGlobalData } from '@/contexts/GlobalDataProvider'

/**
 * useDocuments — reads from shared GlobalDataProvider context.
 * This eliminates duplicate Firestore listeners across all components.
 */
export function useDocuments(): { documents: Document[]; loading: boolean } {
  const global = useGlobalData()
  return { documents: global.documents, loading: global.documentsLoading }
}
