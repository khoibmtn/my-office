import { NextRequest, NextResponse } from 'next/server'
import { initAdmin, getAdminFirestore } from '@/lib/firebase-admin'
import { authenticateRequest, corsHeaders as buildCors, preflight } from '@/lib/api-auth'

export async function OPTIONS(request: NextRequest) {
  return preflight(request)
}

/**
 * Check if a document with the same docNumber already exists
 * POST /api/extension/check-duplicate
 * Body: { docNumber: string, firebaseIdToken? | staffSessionToken? | ingestSecret? }
 * Response: { exists: boolean, matches: [...] }
 */
export async function POST(request: NextRequest) {
  const corsHeaders = () => buildCors(request)
  try {
    const body = await request.json()
    const auth = await authenticateRequest(request, { body, allowIngest: true })
    if (!auth.ok) return auth.response
    const { docNumber } = body

    if (!docNumber || typeof docNumber !== 'string') {
      return NextResponse.json(
        { exists: false, matches: [] },
        { headers: corsHeaders() }
      )
    }

    initAdmin()
    const db = getAdminFirestore()

    // Search by exact docNumber match
    const snapshot = await db
      .collection('documents')
      .where('docNumber', '==', docNumber.trim())
      .limit(5)
      .get()

    if (snapshot.empty) {
      return NextResponse.json(
        { exists: false, matches: [] },
        { headers: corsHeaders() }
      )
    }

    const matches = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        title: data.title || '',
        docNumber: data.docNumber || '',
        status: data.status || '',
        assignee: data.assignee || '',
        deadline: data.deadline?.toDate?.()?.toISOString?.() || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || '',
      }
    })

    return NextResponse.json(
      { exists: true, matches },
      { headers: corsHeaders() }
    )
  } catch (e: unknown) {
    console.error('[check-duplicate] Error:', e)
    return NextResponse.json(
      { exists: false, matches: [], error: 'Lỗi kiểm tra trùng văn bản' },
      { status: 500, headers: corsHeaders() }
    )
  }
}
