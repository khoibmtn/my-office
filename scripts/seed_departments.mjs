// Seed script: Create 2 departments (KHNV + GMHS) and assign existing staff
// Run with: cd my-office && node --input-type=module scripts/seed_departments.mjs

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, serverTimestamp, writeBatch, query, where, addDoc } from 'firebase/firestore'
import { getAuth, signInAnonymously } from 'firebase/auth'
import crypto from 'crypto'

const app = initializeApp({
  apiKey: 'AIzaSyBi0SkEEwmNpOKvshNhxhUcB_BQO04QsFE',
  authDomain: 'my-office-917c5.firebaseapp.com',
  projectId: 'my-office-917c5',
})
const db = getFirestore(app)
const auth = getAuth(app)

async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function nanoid8() {
  return Math.random().toString(36).substring(2, 10)
}

async function main() {
  // Auth
  await signInAnonymously(auth)
  console.log('✅ Authenticated')

  // ========== 1. Create Departments ==========
  console.log('\n=== Creating Departments ===')

  // Check if departments already exist
  const existingDepts = await getDocs(collection(db, 'departments'))
  if (!existingDepts.empty) {
    console.log(`⚠️  ${existingDepts.size} departments already exist. Skipping department creation.`)
    existingDepts.forEach(d => console.log(`   - ${d.id}: ${d.data().name}`))
  } else {
    // Create KHNV
    const khnvRef = doc(collection(db, 'departments'))
    await setDoc(khnvRef, {
      name: 'Phòng Kế hoạch Nghiệp vụ',
      shortName: 'KHNV',
      code: 'KHNV',
      type: 'chức_năng',
      parentId: null,
      headStaffId: null, // Will update after finding BS Khôi's staff ID
      deputyStaffIds: [],
      memberCount: 0,
      description: 'Phòng Kế hoạch Nghiệp vụ - quản lý kế hoạch, nghiệp vụ chuyên môn',
      phone: '',
      location: '',
      color: '#4986e7',
      order: 0,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    console.log(`✅ Created KHNV: ${khnvRef.id}`)

    // Create GMHS
    const gmhsRef = doc(collection(db, 'departments'))
    await setDoc(gmhsRef, {
      name: 'Khoa Gây mê Hồi sức',
      shortName: 'GMHS',
      code: 'GMHS',
      type: 'lâm_sàng',
      parentId: null,
      headStaffId: null,
      deputyStaffIds: [],
      memberCount: 0,
      description: 'Khoa Gây mê Hồi sức - gây mê phẫu thuật và hồi sức tích cực',
      phone: '',
      location: '',
      color: '#16a765',
      order: 1,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    console.log(`✅ Created GMHS: ${gmhsRef.id}`)
  }

  // Re-fetch departments to get IDs
  const deptSnap = await getDocs(collection(db, 'departments'))
  const depts = {}
  deptSnap.forEach(d => {
    const data = d.data()
    depts[data.code] = { id: d.id, ...data }
  })
  const khnvId = depts['KHNV']?.id
  const gmhsId = depts['GMHS']?.id
  console.log(`\nKHNV ID: ${khnvId}`)
  console.log(`GMHS ID: ${gmhsId}`)

  // ========== 2. Assign existing staff to KHNV ==========
  console.log('\n=== Assigning existing staff to KHNV ===')
  const staffSnap = await getDocs(collection(db, 'staff'))
  let bsKhoiDocId = null
  let bsKhoiStaffId = null

  for (const staffDoc of staffSnap.docs) {
    const data = staffDoc.data()
    const docId = staffDoc.id

    // Determine role based on position
    let orgRole = 'nhan_vien'
    if (data.nickname === 'khoi') {
      orgRole = 'admin'
      bsKhoiDocId = docId
      bsKhoiStaffId = data.id
    } else if (data.position?.includes('Trưởng phòng')) {
      orgRole = 'truong_phong'
    } else if (data.position?.includes('Phó') || data.position?.includes('phó')) {
      orgRole = 'pho_phong'
    }

    // BS Khôi gets both departments
    const deptIds = data.nickname === 'khoi' ? [khnvId, gmhsId] : [khnvId]

    await updateDoc(doc(db, 'staff', docId), {
      primaryDepartmentId: khnvId,
      departmentIds: deptIds,
      organizationRole: orgRole,
      updatedAt: serverTimestamp(),
    })
    console.log(`  ✅ ${data.shortName || data.fullName} → ${orgRole} (${deptIds.map(id => id === khnvId ? 'KHNV' : 'GMHS').join(', ')})`)
  }

  // Set KHNV head to BS Khôi
  if (bsKhoiStaffId && khnvId) {
    await updateDoc(doc(db, 'departments', khnvId), {
      headStaffId: bsKhoiStaffId,
      memberCount: staffSnap.size,
      updatedAt: serverTimestamp(),
    })
    console.log(`  ✅ KHNV head → BS Khôi (${bsKhoiStaffId})`)
  }

  // ========== 3. Import GMHS staff from Taskapp data ==========
  console.log('\n=== Importing GMHS staff ===')

  const gmhsStaff = [
    {
      fullName: 'Nguyễn Thị Thu Hương',
      shortName: 'Hương',
      nickname: 'xmhuong',
      position: 'Trưởng khoa',
      title: '',
      role: 'truong_phong',
    },
    {
      fullName: 'Hoàng Đắc Hà',
      shortName: 'Hà',
      nickname: 'hdha',
      position: 'Điều dưỡng trưởng',
      title: '',
      role: 'pho_phong',
    },
    {
      fullName: 'Nhân viên GMHS 1',
      shortName: 'NV1',
      nickname: 'nv_gmhs1',
      position: 'Nhân viên',
      title: '',
      role: 'giao_viec',
    },
  ]

  const passwordHash = await hashPassword('123456')

  for (const s of gmhsStaff) {
    // Check if nickname already exists
    const existCheck = await getDocs(query(collection(db, 'staff'), where('nickname', '==', s.nickname)))
    if (!existCheck.empty) {
      console.log(`  ⚠️  ${s.nickname} already exists, skipping`)
      continue
    }

    const staffId = nanoid8()
    const staffRef = await addDoc(collection(db, 'staff'), {
      id: staffId,
      fullName: s.fullName,
      shortName: s.shortName,
      nickname: s.nickname,
      passwordHash: passwordHash,
      title: s.title,
      position: s.position,
      isActive: true,
      organizationRole: s.role,
      primaryDepartmentId: gmhsId,
      departmentIds: [gmhsId],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    console.log(`  ✅ Created ${s.fullName} (@${s.nickname}) → ${s.role} [GMHS]`)

    // If Trưởng khoa, set as GMHS head
    if (s.role === 'truong_phong' && gmhsId) {
      await updateDoc(doc(db, 'departments', gmhsId), {
        headStaffId: staffId,
        updatedAt: serverTimestamp(),
      })
      console.log(`  ✅ GMHS head → ${s.fullName}`)
    }
  }

  // Update GMHS member count
  const gmhsMembersSnap = await getDocs(query(collection(db, 'staff'), where('departmentIds', 'array-contains', gmhsId)))
  await updateDoc(doc(db, 'departments', gmhsId), {
    memberCount: gmhsMembersSnap.size,
    updatedAt: serverTimestamp(),
  })
  console.log(`\n✅ GMHS member count: ${gmhsMembersSnap.size}`)

  console.log('\n🎉 Seed complete!')
  process.exit(0)
}

main().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})
