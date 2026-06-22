import { NextRequest, NextResponse } from 'next/server'
import { initAdmin, getAdminFirestore } from '@/lib/firebase-admin'

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}

/**
 * Check if a document with the same docNumber already exists
 * POST /api/extension/check-duplicate
 * Body: { docNumber: string }
 * Response: { exists: boolean, matches: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const { docNumber } = await request.json()

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
      { exists: false, matches: [], error: e instanceof Error ? e.message : String(e) },
      { status: 500, headers: corsHeaders() }
    )
  }
}
