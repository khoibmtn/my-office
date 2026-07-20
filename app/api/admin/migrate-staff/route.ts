import { NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'

// POST /api/admin/migrate-staff
// Migrates from settings/general.staff (name-only) to staff collection (ID-based)
// Also updates all documents with assigneeId based on name matching
export async function POST() {
  try {
    const firestore = getAdminFirestore()

    // 1. Read existing staff from settings
    const settingsDoc = await firestore.collection('settings').doc('general').get()
    if (!settingsDoc.exists) {
      return NextResponse.json({ error: 'No settings/general found' }, { status: 404 })
    }
    const settingsData = settingsDoc.data()
    const oldStaff: { name: string }[] = settingsData?.staff || []

    if (oldStaff.length === 0) {
      return NextResponse.json({ message: 'No staff to migrate' })
    }

    // 2. Check if staff collection already has data
    const existingStaff = await firestore.collection('staff').limit(1).get()
    if (!existingStaff.empty) {
      return NextResponse.json({ error: 'Staff collection already has data. Aborting to prevent duplicates.' }, { status: 409 })
    }

    // 3. Create staff documents
    const nameToId: Record<string, string> = {}
    const batch = firestore.batch()

    for (const s of oldStaff) {
      const name = s.name.trim()
      if (!name) continue

      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
      let staffId = ''
      for (let i = 0; i < 8; i++) {
        staffId += chars[Math.floor(Math.random() * chars.length)]
      }

      const staffRef = firestore.collection('staff').doc()
      const nickname = name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .replace(/\s+/g, '')
        .substring(0, 20)

      batch.set(staffRef, {
        id: staffId,
        fullName: name,
        shortName: name,
        nickname,
        passwordHash: '', // Admin needs to set passwords later
        title: '',
        position: '',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      nameToId[name] = staffId
    }

    await batch.commit()

    // 4. Update documents with assigneeId
    const docsSnapshot = await firestore.collection('documents').get()
    let updatedCount = 0

    // Process in batches of 500 (Firestore limit)
    const updateBatches: ReturnType<typeof firestore.batch>[] = []
    let currentBatch = firestore.batch()
    let batchCount = 0

    for (const docSnap of docsSnapshot.docs) {
      const data = docSnap.data()
      const assigneeName = data.assignee

      if (assigneeName && nameToId[assigneeName]) {
        currentBatch.update(docSnap.ref, { assigneeId: nameToId[assigneeName] })
        updatedCount++
        batchCount++

        if (batchCount >= 450) {
          updateBatches.push(currentBatch)
          currentBatch = firestore.batch()
          batchCount = 0
        }
      }
    }

    if (batchCount > 0) {
      updateBatches.push(currentBatch)
    }

    for (const b of updateBatches) {
      await b.commit()
    }

    return NextResponse.json({
      success: true,
      staffCreated: Object.keys(nameToId).length,
      documentsUpdated: updatedCount,
      nameToIdMapping: nameToId,
    })
  } catch (err) {
    console.error('[migrate-staff] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
