import { NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase-admin'
import { signStaffSession } from '@/lib/server/staff-session'

export async function POST(req: Request) {
  try {
    const { nickname, passwordHash } = await req.json()

    if (!nickname || !passwordHash) {
      return NextResponse.json({ error: 'Thiếu thông tin đăng nhập' }, { status: 400 })
    }

    const firestore = getAdminFirestore()
    const staffRef = firestore.collection('staff')
    const snapshot = await staffRef
      .where('nickname', '==', nickname.toLowerCase().trim())
      .where('isActive', '==', true)
      .limit(1)
      .get()

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Tài khoản không tồn tại' }, { status: 401 })
    }

    const staffDoc = snapshot.docs[0]
    const staffData = staffDoc.data()

    if (staffData.passwordHash !== passwordHash) {
      return NextResponse.json({ error: 'Sai mật khẩu' }, { status: 401 })
    }

    const sessionToken = signStaffSession(staffDoc.id, staffData.id)
    if (!sessionToken) {
      console.error('[/api/auth/login] Cannot sign staff session: missing STAFF_SESSION_SECRET / FIREBASE_ADMIN_SDK_KEY')
      return NextResponse.json({ error: 'Server chưa cấu hình phiên đăng nhập. Liên hệ quản trị viên.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sessionToken,
      staffId: staffData.id,
      staffDocId: staffDoc.id,
      shortName: staffData.shortName,
      fullName: staffData.fullName,
    })
  } catch (err) {
    console.error('[/api/auth/login] Error:', err)
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 })
  }
}
