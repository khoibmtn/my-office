# Design Specification: Quản lý Hồ sơ, Người phối hợp & Hệ thống Tag Finder

**Ngày cập nhật:** 2026-08-24  
**Dự án:** `my-office` — Ứng dụng Quản lý Văn bản Hành chính  
**Trạng thái:** ĐÃ PHÊ DUYỆT HOÀN TOÀN (APPROVED FOR IMPLEMENTATION)  

---

## 1. Tổng quan & Mục tiêu

Tính năng mới mở rộng hệ thống `my-office` với 3 trụ cột chính:
1. **Trang Quản lý Hồ sơ (`/dossiers`):** Quản lý hồ sơ công việc theo dạng cây thư mục tối đa 3 cấp, giao diện Finder macOS, kèm Ghi chú mục đích và Checklist tiến độ hoàn thành. Hỗ trợ chuyển giao hồ sơ giữa các nhân viên.
2. **Người phối hợp (Co-assignees):** Bổ sung danh sách người phối hợp (nhiều người) song song với Người thực hiện chính (1 người). Người phối hợp có quyền xem văn bản và đính kèm trong Modal nhưng không được tích hoàn thành hay chỉnh sửa ngày hoàn thành.
3. **Hệ thống Tag / Nhãn thông minh (macOS Finder style):** Gán tag màu cho Văn bản và Hồ sơ (`tagIds`); tích hợp bộ lọc Tag ở Sidebar bên trái với chế độ "5 nhãn phổ biến + Hiển thị tất cả + Tìm kiếm nhãn".
4. **Tích hợp Quick Picker:** Cho phép thêm/bớt Hồ sơ chứa và Tag ngay trong Modal xem văn bản (`DocumentViewer`).
5. **Nhật ký Hệ thống Atomic (Audit Log):** Ghi vết tất cả hành động thêm/sửa/xóa/chuyển giao hồ sơ nằm **bên trong cùng WriteBatch/Transaction** với thao tác dữ liệu.

---

## 2. Phân quyền & Vai trò (RBAC 3 Tầng & Access Matrix)

### 2.1. Kiến trúc Bảo mật 3 Tầng
- **Tầng 1 (UI Permission):** Ẩn/hiện menu `/dossiers`, các nút thao tác trên giao diện.
- **Tầng 2 (Application Authorization):** Kiểm tra vai trò và điều kiện trong Business Service Layer trước khi gọi Firestore API.
- **Tầng 3 (Firestore Security Rules):** Chặn trực tiếp từ database server dựa trên `request.auth`, `resource.data` và `request.resource.data`.

### 2.2. Ma trận Quyền Hạn (Access Matrix)

| Vai trò (Role) | Thư mục Hồ sơ (Dossier) | Văn bản (Document) |
|---|---|---|
| **Admin** | Full CRUD tất cả Hồ sơ toàn hệ thống | Full CRUD tất cả Văn bản |
| **Staff (Owner)** | Full CRUD Hồ sơ do mình sở hữu (`ownerId == staffId`) | Phụ thuộc phân công (Chính / Phối hợp) |
| **Staff (Assignee)** | Xem tiêu đề & vị trí cây hồ sơ chứa văn bản (Read context) | Full workflow (Hoàn thành, sửa ngày) |
| **Staff (Co-assignee)** | Xem tiêu đề & vị trí cây hồ sơ chứa văn bản (Read context) | Xem metadata, đính kèm, viewer modal (Read-only) |
| **Guest** | Không xem được (Ẩn menu `/dossiers`) | Chỉ xem theo quyền guest hiện tại |

Các công tắc cấu hình trong `/settings/permissions`:
- `canCreateDossier`: Cho phép tạo hồ sơ
- `canEditDossier`: Cho phép sửa tên/mô tả/checklist hồ sơ
- `canDeleteDossier`: Cho phép xóa hồ sơ
- `canTransferDossier`: Cho phép chuyển giao hồ sơ

---

## 3. Schema Dữ liệu Chuẩn hóa (Normalized Data Schema)

### 3.1. Collection `/dossiers/{dossierId}`
```typescript
export interface DossierChecklistItem {
  id: string              // nanoid (8 chars)
  title: string           // Tên công việc/hạng mục
  completed: boolean      // Trạng thái hoàn thành (true/false)
  completedAt?: Timestamp | null // Thời điểm tích hoàn thành (null khi completed == false)
  completedBy?: string | null    // staffId người tích (null khi completed == false)
  order: number           // Thứ tự sắp xếp
}

export interface Dossier {
  id: string              // Firestore docId
  name: string            // Tên hồ sơ
  parentId: string | null // ID hồ sơ cha (null nếu Cấp 1)
  level: 1 | 2 | 3        // Cấp hồ sơ (Server tự tính toán dựa trên parent.level + 1)
  createdBy: string       // staffId người tạo ban đầu (Audit log)
  ownerId: string         // staffId người sở hữu/quản lý hiện tại (Source of Truth)
  description: string     // Ghi chú cấu trúc, mục đích hồ sơ
  checklist: DossierChecklistItem[] // Danh sách tiến độ
  tagIds: string[]        // Mảng ID các nhãn/tag (Tham chiếu `/tags`)
  deletedAt?: Timestamp   // Thời điểm xóa mềm (Soft delete)
  deletedBy?: string      // staffId người xóa
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 3.2. Collection `/tags/{tagId}` (Dùng chung toàn hệ thống - Soft Delete)
```typescript
export interface Tag {
  id: string              // Firestore docId
  name: string            // Tên nhãn (unique global, normalized lowercase check)
  color: string           // Mã màu (vd: #EF4444, #3B82F6...)
  createdBy: string       // staffId người tạo
  deletedAt?: Timestamp   // Thời điểm xóa mềm (Soft delete)
  deletedBy?: string      // staffId người xóa
  createdAt: Timestamp
}
```

### 3.3. Collection `/auditLogs/{logId}` (Nhật ký Hệ thống)
```typescript
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
  id: string              // Firestore docId
  entityType: 'dossier' | 'document' | 'tag'
  entityId: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSFER' | 'ASSIGN'
  actorId: string         // staffId người thực hiện
  metadata: AuditLogMetadata // Đã chuẩn hóa chi tiết
  createdAt: Timestamp
}
```

### 3.4. Cập nhật Document (`/documents/{docId}`)
```typescript
export interface Document {
  // ... các trường hiện tại giữ nguyên
  assigneeId?: string        // Người thực hiện chính (1 staffId)
  coAssigneeIds?: string[]   // Người phối hợp (mảng staffId)
  dossierIds?: string[]      // Mảng ID các hồ sơ chứa văn bản này (Giữ nguyên khi Dossier soft-delete)
  tagIds?: string[]          // Mảng ID các nhãn/tag (Tham chiếu `/tags`)
}
```

---

## 4. Các Invariants Kỹ thuật & Logic Nghiệp vụ Chi tiết

### 4.1. Audit Log Atomicity Invariant (P1-1)
Tất cả câu lệnh ghi `AuditLog` **phải nằm bên trong cùng Firestore WriteBatch hoặc runTransaction** với thao tác dữ liệu chính (Dossier / Document / Tag).
- Nếu Mutation thành công -> AuditLog tự động commit.
- Nếu Mutation thất bại -> AuditLog tự động rollback. Không có AuditLog rác nào tồn tại nếu thao tác thất bại.

### 4.2. Invariants Xóa Hồ sơ & Soft Delete Lifecycle (P1-2 & P1-3)
1. **Ràng buộc Hồ sơ con (Child Invariant):** Không cho phép xóa trực tiếp Hồ sơ cha nếu vẫn còn Hồ sơ con chưa xóa. Bắt buộc xử lý các hồ sơ con trước.
2. **Ràng buộc Mảng `dossierIds` của Văn bản:** Khi xóa Hồ sơ $D_2$ của Văn bản có `dossierIds = [D_1, D_2, D_3]`, hệ thống chỉ xóa duy nhất $D_2$, mảng giữ nguyên `[D_1, D_3]`. Tuyệt đối không xóa hay ghi đè $D_1, D_3$.
3. **Soft Delete Lifecycle:** 
   - Khi xóa Hồ sơ $D_1$ hoặc Tag $T_1$, hệ thống gán `deletedAt = serverTimestamp()`.
   - Văn bản chứa `dossierIds` và `tagIds` **giữ nguyên tham chiếu lịch sử**. UI lọc chỉ hiển thị các Hồ sơ và Tag active (`deletedAt == null`). Khi Admin phục hồi (Restore), mối quan hệ hiển thị lại tự động.

### 4.3. Invariants Chuyển giao Hồ sơ (Dossier Transfer Invariants)
1. **Ràng buộc Cây Hồ sơ con không được chọn (Deterministic Hierarchy Rule):** Khi chuyển giao Hồ sơ $B$ sang Target User, bất kỳ Hồ sơ con $C$ nào không được chọn chuyển giao sẽ được set `C.parentId = null` (trở thành Hồ sơ Cấp 1 độc lập thuộc sở hữu của Owner cũ). Đảm bảo 100% không bị lỗi Cross-owner hierarchy.
2. **Phân công Văn bản Chưa Hoàn Thành:** Tùy chọn gán `assigneeId = targetUser` đối với các văn bản chưa hoàn thành. Văn bản đã hoàn thành **giữ nguyên `assigneeId` cũ**.
3. **Xử lý Trùng tên:** Tự động nối đuôi ` (Khôi chuyển)` nếu người nhận bị trùng tên hồ sơ.

### 4.4. Cấu trúc Business Service Layer & Batch Caching
Các React UI Component tuyệt đối không gọi trực tiếp Firestore CRUD mà phải qua Business Service:
- `lib/dossiers.ts`: `createDossier()`, `updateDossier()`, `deleteDossier()`, `transferDossier()`, `addDocumentToDossier()`, `removeDocumentFromDossier()`.
- `lib/tags.ts`: `createTag()`, `updateTag()`, `deleteTag()`, `resolveTagIds()`.
  - `resolveTagIds()` thu thập danh sách unique `tagIds` trên trang và batch fetch 1 lần (`where(documentId(), 'in', uniqueIds)`) kèm client-side cache để tránh lỗi N+1 Firestore reads.
- `lib/audit.ts`: `logAuditAction()`.

---

## 5. Lộ trình Triển khai (3 Phase Implementation Roadmap)

```mermaid
graph TD
    A[Phase 1: Core Engine, Service Layer & Audit] --> B[Phase 2: Workflow & Transfer]
    B --> C[Phase 3: Tags & Finder Polish]
    
    subgraph Phase 1: Core Engine, Service Layer & Audit
    A1[Schema & Types: Dossier, Tag, AuditLog, Document]
    A2[Business Service Layer: lib/dossiers.ts, lib/audit.ts]
    A3[RBAC & 3-Tier Security Rules với Mutation Checks]
    A4[Page /dossiers, Breadcrumb & Dossier Table]
    A5[Document ↔ Dossier Mapping & Delete Invariant]
    end
    
    subgraph Phase 2: Workflow & Transfer
    B1[Co-assignees Multi-select & View-only Permissions]
    B2[Transfer Dossier Atomic Batch Operation with Options]
    B3[Delete Dossier Prompt & Child Prevention Check]
    B4[Checklist Metadata & Debounced Description Notes]
    end
    
    subgraph Phase 3: Tags & Finder Polish
    C1[Tags Service lib/tags.ts với Batch Caching & Global Unique]
    C2[Sidebar Finder Tag Panel với Top 5 & Search Modal]
    C3[DocumentViewer Quick Dossier & Tag Pickers]
    C4[Global Search với Location Pathing]
    end
```

---

## 6. Kế hoạch Kiểm thử Comprehensive (Verification Suite)

1. **Kiểm thử Multi-dossier Deletion (Test A):**
   - Gán Văn bản vào `[D1, D2, D3]` -> Soft-delete `D2` -> Xác minh mảng còn `[D1, D3]`.
2. **Kiểm thử Atomic Rollback Failure (Test D):**
   - Tạo mutation cố tình gây lỗi 1 write trong Transfer -> Xác minh **toàn bộ transaction rollback**, không dossier/document nào bị thay đổi và không có AuditLog rác nào được tạo.
3. **Kiểm thử Security Rules Mutations (Test C):**
   - Đăng nhập Staff Co-assignee -> Thực hiện update direct Firestore `status = 'completed'` -> Phải nhận `permission-denied`.
   - Đăng nhập Staff A -> Thử đổi `request.resource.data.ownerId` của Hồ sơ Staff B -> Phải nhận `permission-denied`.
4. **Kiểm thử Tag Resolution Batching:**
   - Hiển thị 50 văn bản chứa các tag khác nhau -> Kiểm tra Network/Console chỉ gọi 1 batch query fetch nhãn thay vì N+1 query.
