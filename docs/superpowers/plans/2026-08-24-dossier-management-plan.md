# Implementation Plan: Quản lý Hồ sơ, Người phối hợp & Hệ thống Tag Finder

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống Quản lý Hồ sơ công việc 3 cấp phong cách macOS Finder, bổ sung Người phối hợp (Co-assignees) và Hệ thống Nhãn (Smart Tags) tích hợp Sidebar & Quick Picker.

**Architecture:** Sử dụng mô hình N-Tier với Business Service Layer (`lib/dossiers.ts`, `lib/tags.ts`, `lib/audit.ts`) chịu trách nhiệm thực thi các thao tác nguyên tử (Atomic WriteBatch/Transaction) kết hợp Audit Log. Tách biệt hoàn toàn `Dossier.ownerId` và `Document.assigneeId`.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui, Firebase Firestore (Web SDK v10), Lucide Icons.

---

## File Structure Map

```
my-office/
├── types/
│   └── index.ts                               # [MODIFY] Bổ sung Dossier, Tag, AuditLog, RolePermissions, Co-assignees
├── lib/
│   ├── audit.ts                               # [NEW] Business Service cho Audit Logging
│   ├── dossiers.ts                            # [NEW] Business Service cho Dossier CRUD, Transfer, Document mapping
│   ├── tags.ts                                # [NEW] Business Service cho Tag CRUD & Batch Caching resolver
│   └── firestore.ts                           # [MODIFY] Thêm helper update Co-assignees & dossierIds
├── hooks/
│   ├── usePermissions.ts                      # [MODIFY] Thêm 4 permission switches cho Dossier
│   ├── useDossiers.ts                         # [NEW] Hook realtime listener cho dossiers
│   ├── useTags.ts                             # [NEW] Hook realtime listener cho tags
│   └── useAuditLogs.ts                        # [NEW] Hook realtime query audit logs
├── app/(app)/
│   ├── layout.tsx                             # [MODIFY] Thêm menu /dossiers (ẩn với Guest) + Tag Sidebar Finder Panel
│   ├── dossiers/
│   │   └── page.tsx                           # [NEW] Trang Quản lý Hồ sơ Finder View
│   └── settings/
│       └── page.tsx                           # [MODIFY] Bổ sung UI switches phân quyền Dossier cho Staff
├── components/
│   ├── dossiers/
│   │   ├── DossierBreadcrumb.tsx              # [NEW] Thanh đường dẫn thư mục cấp 1 > 2 > 3
│   │   ├── DossierFolderGrid.tsx              # [NEW] Lưới/danh sách thẻ Thư mục con
│   │   ├── DossierPanel.tsx                   # [NEW] Panel bên phải: Ghi chú mục đích & Checklist tiến độ
│   │   ├── DossierModal.tsx                   # [NEW] Modal Tạo/Sửa Hồ sơ
│   │   ├── TransferDossierModal.tsx           # [NEW] Modal Chuyển giao Hồ sơ kèm tùy chọn
│   │   └── DeleteDossierModal.tsx             # [NEW] Modal Xóa Hồ sơ kèm kiểm tra child
│   ├── tags/
│   │   ├── TagSidebarPanel.tsx                # [NEW] Component 5 nhãn phổ biến + Nút Xem tất cả
│   │   └── TagSearchModal.tsx                 # [NEW] Modal Tìm kiếm & Xem toàn bộ nhãn
│   └── documents/
│       ├── DocumentModal.tsx                  # [MODIFY] Bổ sung Multi-select Người phối hợp (coAssigneeIds)
│       ├── DocumentTable.tsx                  # [MODIFY] Khóa nút Hoàn thành với Co-assignees + Hiển thị location path
│       └── DocumentViewer.tsx                 # [MODIFY] Bổ sung Quick Picker Hồ sơ & Tag ở cột trái
```

---

## Task List

### Phase 1: Core Engine, Business Services & RBAC

#### Task 1: Type Definitions Update
**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Định nghĩa các interface `Dossier`, `DossierChecklistItem`, `Tag`, `AuditLog`, `RolePermissions` và cập nhật `Document`**

```typescript
// Thêm vào types/index.ts:
export interface DossierChecklistItem {
  id: string
  title: string
  completed: boolean
  completedAt?: Timestamp | null
  completedBy?: string | null
  order: number
}

export interface Dossier {
  id: string
  name: string
  parentId: string | null
  level: 1 | 2 | 3
  createdBy: string
  ownerId: string
  description: string
  checklist: DossierChecklistItem[]
  tagIds: string[]
  deletedAt?: Timestamp
  deletedBy?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface Tag {
  id: string
  name: string
  color: string
  createdBy: string
  deletedAt?: Timestamp
  deletedBy?: string
  createdAt: Timestamp
}

export interface AuditLogMetadata {
  fromOwnerId?: string
  toOwnerId?: string
  transferredChildIds?: string[]
  reassignedDocumentIds?: string[]
  field?: string
  operation?: string
  [key: string]: any
}

export interface AuditLog {
  id: string
  entityType: 'dossier' | 'document' | 'tag'
  entityId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSFER' | 'ASSIGN'
  actorId: string
  metadata: AuditLogMetadata
  createdAt: Timestamp
}
```

- [ ] **Step 2: Kiểm tra TypeScript build**
Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**
```bash
git add types/index.ts
git commit -m "feat(types): add Dossier, Tag, AuditLog, and coAssigneeIds interfaces"
```

---

#### Task 2: Business Service Layer — Audit Logging & Tags Service
**Files:**
- Create: `lib/audit.ts`
- Create: `lib/tags.ts`

- [ ] **Step 1: Tạo `lib/audit.ts` để ghi AuditLog tập trung trong WriteBatch**
```typescript
import { doc, serverTimestamp, writeBatch, WriteBatch } from 'firebase/firestore'
import { db } from './firebase'
import type { AuditLogMetadata } from '@/types'

export function appendAuditLogToBatch(
  batch: WriteBatch,
  entityType: 'dossier' | 'document' | 'tag',
  entityId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSFER' | 'ASSIGN',
  actorId: string,
  metadata: AuditLogMetadata = {}
): void {
  const logRef = doc(db(), 'auditLogs', `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`)
  batch.set(logRef, {
    entityType,
    entityId,
    action,
    actorId,
    metadata,
    createdAt: serverTimestamp(),
  })
}
```

- [ ] **Step 2: Tạo `lib/tags.ts` với helper `createTag`, `resolveTagIds` có batch caching**
```typescript
import { collection, doc, getDocs, query, where, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { appendAuditLogToBatch } from './audit'
import type { Tag } from '@/types'

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#64748B', '#14B8A6'
]

const tagCache = new Map<string, Tag>()

export async function createTag(name: string, actorId: string): Promise<string> {
  const normalized = name.trim().toLowerCase()
  const q = query(collection(db(), 'tags'), where('deletedAt', '==', null))
  const snap = await getDocs(q)
  const existing = snap.docs.find(d => (d.data() as Tag).name.trim().toLowerCase() === normalized)
  if (existing) return existing.id

  const tagRef = doc(collection(db(), 'tags'))
  const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
  const batch = writeBatch(db())
  batch.set(tagRef, {
    name: name.trim(),
    color,
    createdBy: actorId,
    createdAt: serverTimestamp(),
  })
  appendAuditLogToBatch(batch, 'tag', tagRef.id, 'CREATE', actorId, { name: name.trim() })
  await batch.commit()
  return tagRef.id
}

export async function resolveTagIds(tagIds: string[]): Promise<Tag[]> {
  if (!tagIds || tagIds.length === 0) return []
  const missing = tagIds.filter(id => !tagCache.has(id))
  if (missing.length > 0) {
    const q = query(collection(db(), 'tags'), where('deletedAt', '==', null))
    const snap = await getDocs(q)
    snap.docs.forEach(d => tagCache.set(d.id, { id: d.id, ...d.data() } as Tag))
  }
  return tagIds.map(id => tagCache.get(id)).filter(Boolean) as Tag[]
}
```

- [ ] **Step 3: Kiểm tra TypeScript build**
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add lib/audit.ts lib/tags.ts
git commit -m "feat(services): implement audit logging service and tags service with batch caching"
```

---

#### Task 3: Business Service Layer — Dossiers Service
**Files:**
- Create: `lib/dossiers.ts`

- [ ] **Step 1: Tạo `lib/dossiers.ts` quản lý CRUD, Transfer atomic, Delete prompt logic**
```typescript
import {
  collection, doc, getDoc, getDocs, query, where,
  serverTimestamp, writeBatch
} from 'firebase/firestore'
import { db } from './firebase'
import { appendAuditLogToBatch } from './audit'
import type { Dossier, DossierChecklistItem } from '@/types'

export async function createDossier(input: {
  name: string
  parentId: string | null
  description?: string
  actorId: string
}): Promise<string> {
  const dossierRef = doc(collection(db(), 'dossiers'))
  let level: 1 | 2 | 3 = 1

  if (input.parentId) {
    const parentSnap = await getDoc(doc(db(), 'dossiers', input.parentId))
    if (!parentSnap.exists()) throw new Error('Thư mục cha không tồn tại')
    const parentData = parentSnap.data() as Dossier
    if (parentData.level >= 3) throw new Error('Hệ thống chỉ hỗ trợ tối đa 3 cấp hồ sơ')
    level = (parentData.level + 1) as 2 | 3
  }

  const batch = writeBatch(db())
  batch.set(dossierRef, {
    name: input.name.trim(),
    parentId: input.parentId || null,
    level,
    createdBy: input.actorId,
    ownerId: input.actorId,
    description: input.description || '',
    checklist: [],
    tagIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  appendAuditLogToBatch(batch, 'dossier', dossierRef.id, 'CREATE', input.actorId, {
    name: input.name.trim(),
    level,
    parentId: input.parentId,
  })

  await batch.commit()
  return dossierRef.id
}

export async function deleteDossier(
  dossierId: string,
  option: 'move_to_parent' | 'release',
  actorId: string
): Promise<void> {
  // Check child dossiers
  const childQ = query(
    collection(db(), 'dossiers'),
    where('parentId', '==', dossierId),
    where('deletedAt', '==', null)
  )
  const childSnap = await getDocs(childQ)
  if (!childSnap.empty) {
    throw new Error(`Hồ sơ này đang có ${childSnap.size} hồ sơ con. Vui lòng xử lý các hồ sơ con trước khi xóa!`)
  }

  const dossierSnap = await getDoc(doc(db(), 'dossiers', dossierId))
  if (!dossierSnap.exists()) return
  const dossier = dossierSnap.data() as Dossier

  // Query documents containing this dossierId
  const docsQ = query(
    collection(db(), 'documents'),
    where('dossierIds', 'array-contains', dossierId)
  )
  const docsSnap = await getDocs(docsQ)

  const batch = writeBatch(db())

  // Soft delete dossier
  batch.update(doc(db(), 'dossiers', dossierId), {
    deletedAt: serverTimestamp(),
    deletedBy: actorId,
    updatedAt: serverTimestamp(),
  })

  // Update documents while preserving unrelated dossierIds
  docsSnap.docs.forEach((dDoc) => {
    const data = dDoc.data()
    const currentDossierIds: string[] = data.dossierIds || []
    let updatedDossierIds = currentDossierIds.filter((id) => id !== dossierId)

    if (option === 'move_to_parent' && dossier.parentId) {
      if (!updatedDossierIds.includes(dossier.parentId)) {
        updatedDossierIds.push(dossier.parentId)
      }
    }

    batch.update(doc(db(), 'documents', dDoc.id), {
      dossierIds: updatedDossierIds,
      updatedAt: serverTimestamp(),
    })
  })

  appendAuditLogToBatch(batch, 'dossier', dossierId, 'DELETE', actorId, { option })
  await batch.commit()
}

export async function transferDossier(params: {
  dossierId: string
  targetOwnerId: string
  targetOwnerName: string
  selectedChildIds: string[]
  reassignUncompletedDocs: boolean
  actorId: string
}): Promise<void> {
  const { dossierId, targetOwnerId, selectedChildIds, reassignUncompletedDocs, actorId } = params

  const dossierSnap = await getDoc(doc(db(), 'dossiers', dossierId))
  if (!dossierSnap.exists()) throw new Error('Hồ sơ không tồn tại')
  const dossier = dossierSnap.data() as Dossier

  // Fetch all child dossiers
  const allChildrenQ = query(
    collection(db(), 'dossiers'),
    where('ownerId', '==', dossier.ownerId),
    where('deletedAt', '==', null)
  )
  const allChildrenSnap = await getDocs(allChildrenQ)
  const allChildren = allChildrenSnap.docs.map(d => ({ id: d.id, ...d.data() } as Dossier))

  // Find all descendants of dossierId
  const descendantIds = new Set<string>()
  function collect(pid: string) {
    allChildren.filter(c => c.parentId === pid).forEach(c => {
      descendantIds.add(c.id)
      collect(c.id)
    })
  }
  collect(dossierId)

  const batch = writeBatch(db())

  // Update main dossier
  batch.update(doc(db(), 'dossiers', dossierId), {
    ownerId: targetOwnerId,
    updatedAt: serverTimestamp(),
  })

  // Process sub-dossiers
  descendantIds.forEach(cid => {
    if (selectedChildIds.includes(cid)) {
      batch.update(doc(db(), 'dossiers', cid), {
        ownerId: targetOwnerId,
        updatedAt: serverTimestamp(),
      })
    } else {
      // Deterministic hierarchy rule: set parentId = null for unselected child
      batch.update(doc(db(), 'dossiers', cid), {
        parentId: null,
        level: 1,
        updatedAt: serverTimestamp(),
      })
    }
  })

  // Reassign uncompleted documents if requested
  const allTransferredDossierIds = [dossierId, ...Array.from(descendantIds).filter(id => selectedChildIds.includes(id))]
  for (const did of allTransferredDossierIds) {
    const docsQ = query(collection(db(), 'documents'), where('dossierIds', 'array-contains', did))
    const docsSnap = await getDocs(docsQ)
    docsSnap.docs.forEach(dDoc => {
      const data = dDoc.data()
      if (reassignUncompletedDocs && data.status !== 'completed') {
        batch.update(doc(db(), 'documents', dDoc.id), {
          assigneeId: targetOwnerId,
          updatedAt: serverTimestamp(),
        })
      }
    })
  }

  appendAuditLogToBatch(batch, 'dossier', dossierId, 'TRANSFER', actorId, {
    fromOwnerId: dossier.ownerId,
    toOwnerId: targetOwnerId,
    selectedChildIds,
    reassignUncompletedDocs,
  })

  await batch.commit()
}
```

- [ ] **Step 2: Kiểm tra TypeScript build**
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add lib/dossiers.ts
git commit -m "feat(services): implement dossiers business service with atomic transfer and deletion invariants"
```

---

#### Task 4: Realtime Custom Hooks (`useDossiers.ts`, `useTags.ts`)
**Files:**
- Create: `hooks/useDossiers.ts`
- Create: `hooks/useTags.ts`

- [ ] **Step 1: Tạo `hooks/useDossiers.ts`**
```typescript
'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import { useRole } from './useRole'
import type { Dossier } from '@/types'

export function useDossiers() {
  const { role, staffId, isAdmin } = useRole()
  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null

    ensureAuth().then(() => {
      if (role === 'guest') {
        setDossiers([])
        setLoading(false)
        return
      }

      const col = collection(db(), 'dossiers')
      const q = isAdmin
        ? query(col, where('deletedAt', '==', null), orderBy('name', 'asc'))
        : query(col, where('ownerId', '==', staffId), where('deletedAt', '==', null), orderBy('name', 'asc'))

      unsub = onSnapshot(
        q,
        (snap) => {
          setDossiers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Dossier)))
          setLoading(false)
        },
        (err) => {
          console.error('[useDossiers] error:', err)
          setLoading(false)
        }
      )
    })

    return () => { if (unsub) unsub() }
  }, [role, staffId, isAdmin])

  return { dossiers, loading }
}
```

- [ ] **Step 2: Tạo `hooks/useTags.ts`**
```typescript
'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore'
import { db, ensureAuth } from '@/lib/firebase'
import type { Tag } from '@/types'

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsub: (() => void) | null = null

    ensureAuth().then(() => {
      const q = query(collection(db(), 'tags'), where('deletedAt', '==', null), orderBy('createdAt', 'desc'))
      unsub = onSnapshot(
        q,
        (snap) => {
          setTags(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tag)))
          setLoading(false)
        },
        (err) => {
          console.error('[useTags] error:', err)
          setLoading(false)
        }
      )
    })

    return () => { if (unsub) unsub() }
  }, [])

  return { tags, loading }
}
```

- [ ] **Step 3: Commit**
```bash
git add hooks/useDossiers.ts hooks/useTags.ts
git commit -m "feat(hooks): add useDossiers and useTags realtime Firestore listeners"
```

---

#### Task 5: Phân quyền RBAC Updates (`usePermissions.ts` & Settings Page)
**Files:**
- Modify: `types/index.ts` (RolePermissions)
- Modify: `hooks/usePermissions.ts`
- Modify: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Cập nhật `RolePermissions` trong `hooks/usePermissions.ts`**
Thêm 4 switches: `canCreateDossier`, `canEditDossier`, `canDeleteDossier`, `canTransferDossier`.

- [ ] **Step 2: Cập nhật UI Switches trong `/settings/page.tsx`**
Hiển thị 4 công tắc cấu hình cho vai trò Staff.

- [ ] **Step 3: Verify TypeScript build**
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add hooks/usePermissions.ts app/\(app\)/settings/page.tsx
git commit -m "feat(rbac): add dossier permission switches for staff and settings UI"
```

---

### Phase 2: Workflow & Transfer Components

#### Task 6: Page `/dossiers` UI & Navigation Component
**Files:**
- Create: `app/(app)/dossiers/page.tsx`
- Create: `components/dossiers/DossierBreadcrumb.tsx`
- Create: `components/dossiers/DossierFolderGrid.tsx`
- Create: `components/dossiers/DossierPanel.tsx`
- Modify: `app/(app)/layout.tsx` (Add `/dossiers` nav item, hidden for Guest)

- [ ] **Step 1: Tạo `DossierBreadcrumb.tsx`**
Hiển thị `🏠 Hồ sơ của tôi / 📂 Kế hoạch (Cấp 1) / 📂 Chỉ đạo tuyến (Cấp 2)`.

- [ ] **Step 2: Tạo `DossierFolderGrid.tsx`**
Hiển thị các thẻ Thư mục con dạng Finder card (Icon folder, Tên, Số văn bản, % Tiến độ).

- [ ] **Step 3: Tạo `DossierPanel.tsx`**
Panel bên phải chứa Textarea Ghi chú mục đích (tự động lưu debounce 1000ms) + Checklist tiến độ công việc.

- [ ] **Step 4: Tạo `app/(app)/dossiers/page.tsx` tích hợp `DocumentTable`**
Trang Quản lý Hồ sơ hoàn chỉnh với Finder view.

- [ ] **Step 5: Cập nhật Sidebar Navigation trong `app/(app)/layout.tsx`**
Thêm link `/dossiers` với icon Folder bên dưới `Văn bản` (Ẩn hoàn toàn khi `isGuest == true`).

- [ ] **Step 6: Commit**
```bash
git add app/\(app\)/dossiers/page.tsx components/dossiers/ app/\(app\)/layout.tsx
git commit -m "feat(ui): implement Dossiers page, breadcrumb navigation, folder grid and right panel"
```

---

#### Task 7: Modal Tạo/Sửa/Xóa/Chuyển giao Hồ sơ
**Files:**
- Create: `components/dossiers/DossierModal.tsx`
- Create: `components/dossiers/DeleteDossierModal.tsx`
- Create: `components/dossiers/TransferDossierModal.tsx`

- [ ] **Step 1: Tạo `DossierModal.tsx`**
Form Tạo/Sửa Hồ sơ (Chọn Tên, Thư mục cha - tối đa 3 cấp, Ghi chú).

- [ ] **Step 2: Tạo `DeleteDossierModal.tsx`**
Modal xóa hồ sơ có kiểm tra child dossier (chặn nếu còn child) + Prompt chọn Tùy chọn A (chuyển lên cha) hoặc B (giải phóng).

- [ ] **Step 3: Tạo `TransferDossierModal.tsx`**
Modal chuyển giao hồ sơ chọn Target User + Tree Checkbox danh sách hồ sơ con + Checkbox gán văn bản chưa hoàn thành.

- [ ] **Step 4: Commit**
```bash
git add components/dossiers/
git commit -m "feat(dossiers): add DossierModal, DeleteDossierModal, and TransferDossierModal components"
```

---

#### Task 8: Chức năng Người phối hợp (Co-assignees)
**Files:**
- Modify: `components/documents/DocumentModal.tsx`
- Modify: `components/documents/DocumentTable.tsx`

- [ ] **Step 1: Bổ sung Multi-select `coAssigneeIds` trong `DocumentModal.tsx`**
Chọn nhiều Người phối hợp; tự động loại bỏ Người chính khỏi danh sách chọn.

- [ ] **Step 2: Cập nhật Quyền thao tác trong `DocumentTable.tsx`**
Người phối hợp chỉ được XEM văn bản. Nút Hoàn thành và ô chọn ngày hoàn thành bị disabled kèm tooltip thông báo.

- [ ] **Step 3: Commit**
```bash
git add components/documents/DocumentModal.tsx components/documents/DocumentTable.tsx
git commit -m "feat(workflow): implement Co-assignees multi-select and view-only permission enforcement"
```

---

### Phase 3: Tags & Finder Polish

#### Task 9: Finder Sidebar Tag Panel & Search Modal
**Files:**
- Create: `components/tags/TagSidebarPanel.tsx`
- Create: `components/tags/TagSearchModal.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Tạo `TagSidebarPanel.tsx`**
Hiển thị 5 nhãn phổ biến nhất ở Sidebar bên trái với chấm màu macOS + nút "Hiển thị tất cả".

- [ ] **Step 2: Tạo `TagSearchModal.tsx`**
Modal hiển thị danh sách đầy đủ các nhãn kèm ô Tìm kiếm tag.

- [ ] **Step 3: Nhúng `TagSidebarPanel` vào `app/(app)/layout.tsx`**

- [ ] **Step 4: Commit**
```bash
git add components/tags/ app/\(app\)/layout.tsx
git commit -m "feat(tags): implement Finder Sidebar Tag Panel and Tag Search Modal"
```

---

#### Task 10: DocumentViewer Quick Picker Integration & Location Search
**Files:**
- Modify: `components/documents/DocumentViewer.tsx`
- Modify: `app/(app)/dossiers/page.tsx`

- [ ] **Step 1: Cập nhật `DocumentViewer.tsx`**
Bổ sung 2 khối "Hồ sơ chứa văn bản" và "Nhãn (Tags)" cho phép thêm/bớt trực tiếp ở cột thông tin bên trái.

- [ ] **Step 2: Thêm tính năng Tìm kiếm Vị trí (Location Pathing)**
Bổ sung công tắc `[ ] Tìm trong thư mục này` / `[x] Tìm toàn bộ` trên trang `/dossiers`. Khi tìm toàn bộ, hiển thị đường dẫn `Kế hoạch > Chỉ đạo tuyến`.

- [ ] **Step 3: Verification & Build Check**
Run: `npx tsc --noEmit && npm run build`
Expected: PASS with 0 build errors.

- [ ] **Step 4: Commit**
```bash
git add components/documents/DocumentViewer.tsx app/\(app\)/dossiers/page.tsx
git commit -m "feat(polish): integrate Quick Dossier/Tag Pickers in DocumentViewer and path-aware search"
```

---

## Verification Plan

### Automated Tests / Type Checking
- Run `npx tsc --noEmit` to verify type safety across all created services and components.
- Run `npm run build` to ensure Next.js production bundle succeeds without dynamic server errors.

### Manual Verification Checklist
1. **RBAC & Guest Visibility:**
   - Log in as Guest -> Verify `/dossiers` link is completely hidden from Sidebar and navigating directly to `/dossiers` shows access denied.
2. **Dossier Hierarchy & Navigation:**
   - Create Level 1 Dossier "Kế hoạch" -> Create Level 2 "Chỉ đạo tuyến" -> Create Level 3 "Chỉ tiêu chuyên môn".
   - Verify Breadcrumb navigation correctly navigates up/down the hierarchy tree.
3. **Delete Invariants Check:**
   - Try deleting Level 1 Dossier with children -> Verify system blocks deletion with alert.
   - Delete Level 3 Dossier containing a document with `dossierIds: [D1, D2, D3]` -> Verify document keeps `[D1, D3]` and does not lose unrelated dossiers.
4. **Deterministic Transfer Check:**
   - Transfer Level 2 Dossier to Staff B, unchecking Level 3 child -> Verify Level 3 child becomes Level 1 root dossier owned by original Staff A.
5. **Co-assignees Restrictions:**
   - Log in as Co-assignee -> Verify document is visible in table and Viewer modal, but completion toggle button is disabled.
6. **Sidebar Tag Finder Panel:**
   - Click a tag dot on Sidebar -> Verify active document/dossier list automatically filters by selected tag.
