# Design Specification: Quản lý Hồ sơ, Người phối hợp & Hệ thống Tag Finder

**Ngày tạo:** 2026-08-24  
**Dự án:** `my-office` — Ứng dụng Quản lý Văn bản Hành chính  
**Trạng thái:** Đã được người dùng duyệt  

---

## 1. Tổng quan & Mục tiêu

Tính năng mới mở rộng hệ thống `my-office` với 3 trụ cột chính:
1. **Trang Quản lý Hồ sơ (`/dossiers`):** Quản lý hồ sơ công việc theo dạng cây thư mục tối đa 3 cấp, giao diện Finder macOS, kèm Ghi chú mục đích và Checklist tiến độ hoàn thành. Hỗ trợ chuyển giao hồ sơ giữa các nhân viên.
2. **Người phối hợp (Co-assignees):** Bổ sung danh sách người phối hợp (nhiều người) song song với Người thực hiện chính (1 người). Người phối hợp có quyền xem văn bản nhưng không được hoàn thành hay chỉnh sửa ngày hoàn thành.
3. **Hệ thống Tag / Nhãn thông minh (macOS Finder style):** Gán tag màu cho Văn bản và Hồ sơ; tích hợp bộ lọc Tag ở Sidebar bên trái với chế độ "5 nhãn phổ biến + Hiển thị tất cả".
4. **Tích hợp Quick Picker:** Cho phép thêm/bớt Hồ sơ chứa và Tag ngay trong Modal xem văn bản (`DocumentViewer`).

---

## 2. Phân quyền & Vai trò (RBAC)

| Chức năng | Admin | Staff (Nhân viên) | Guest |
|---|---|---|---|
| Menu "Quản lý Hồ sơ" ở Sidebar | Hiển thị | Hiển thị | Ẩn hoàn toàn |
| Xem & Quản lý Hồ sơ | Quản lý Hồ sơ mình tạo hoặc được chuyển đến | Quản lý Hồ sơ mình tạo hoặc được chuyển đến | Không |
| Thêm / Sửa / Xóa Hồ sơ | Có | Phụ thuộc permission switch | Không |
| Chuyển giao Hồ sơ | Có | Phụ thuộc permission switch | Không |
| Gán Văn bản vào Hồ sơ | Tất cả văn bản | Văn bản được giao (Chính/Phối hợp) hoặc tạo ra | Không |
| Hoàn thành văn bản | Tất cả văn bản | Chỉ văn bản làm Người chính | Không |
| Xem văn bản làm Người phối hợp | Có | Có | Có |

Các quyền được cấu hình động trong `/settings/permissions`:
- `canCreateDossier`: Cho phép tạo hồ sơ
- `canEditDossier`: Cho phép sửa tên/mô tả/checklist hồ sơ
- `canDeleteDossier`: Cho phép xóa hồ sơ
- `canTransferDossier`: Cho phép chuyển giao hồ sơ

---

## 3. Schema Dữ liệu (Firestore)

### 3.1. Collection `/dossiers/{dossierId}`
```typescript
export interface DossierChecklistItem {
  id: string              // nanoid (8 chars)
  title: string           // Tên công việc/hạng mục
  completed: boolean      // Trạng thái hoàn thành
}

export interface Dossier {
  id: string              // Firestore docId
  name: string            // Tên hồ sơ
  parentId: string | null // ID hồ sơ cha (null nếu Cấp 1)
  level: 1 | 2 | 3        // Cấp hồ sơ (1, 2, 3)
  createdBy: string       // staffId người tạo
  assignedTo: string      // staffId người quản lý hiện tại
  description: string     // Ghi chú cấu trúc, mục đích hồ sơ
  checklist: DossierChecklistItem[] // Danh sách tiến độ
  tags: string[]          // Danh sách nhãn/tag
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 3.2. Collection `/tags/{tagId}`
```typescript
export interface Tag {
  id: string              // Firestore docId (hoặc tag slug)
  name: string            // Tên nhãn (unique string)
  color: string           // Mã màu (vd: #EF4444, #3B82F6...)
  createdBy: string       // staffId người tạo
  usageCount: number      // Số lần tag được sử dụng (dùng sắp xếp top 5)
  createdAt: Timestamp
}
```

### 3.3. Cập nhật Document (`/documents/{docId}`)
```typescript
export interface Document {
  // ... các trường hiện tại giữ nguyên
  assigneeId?: string        // Người thực hiện chính (1 staffId)
  coAssigneeIds?: string[]   // Người phối hợp (mảng staffId)
  dossierIds?: string[]      // Danh sách ID các hồ sơ chứa văn bản này
  tags?: string[]            // Danh sách tên nhãn/tag
}
```

---

## 4. Giao diện & Luồng Nghiệp vụ

### 4.1. Trang Quản lý Hồ sơ (`/dossiers`)
- **Breadcrumb:** Đường dẫn thư mục `Hồ sơ của tôi / Kế hoạch / Chỉ đạo tuyến`.
- **Thanh Công cụ:** Nút `+ Thêm hồ sơ`, `Chuyển hồ sơ`, `Ghi chú & Tiến độ`, Ô tìm kiếm (`[ ] Tìm trong thư mục này` / `[x] Tìm toàn bộ`).
  - Khi tìm toàn bộ: Hiển thị thêm cột `📍 Vị trí lưu` (ví dụ: `Kế hoạch > Chỉ đạo tuyến`).
- **Tầng trên (Folders):** Thẻ thông tin các hồ sơ con (Tên, icon folder, số lượng văn bản, % tiến độ).
- **Tầng dưới (Document Table):** Tái sử dụng component `DocumentTable` đầy đủ chức năng (giao việc, xem/sửa/xóa, phân trang, filter status).
- **Panel bên phải (Collapsible):**
  - Textarea ghi chú mô tả mục đích hồ sơ (tự động lưu).
  - Progress bar + danh sách Checklist có checkbox.

### 4.2. Xử lý Xóa Hồ sơ
- **Xóa Cấp 2 hoặc 3:** Văn bản trong hồ sơ bị xóa được tự động chuyển gán mảng `dossierIds` lên Hồ sơ Cấp cha. Hồ sơ con của hồ sơ bị xóa đẩy lên làm con của Hồ sơ Cấp cha.
- **Xóa Cấp 1:** Loại bỏ ID hồ sơ cấp 1 khỏi mảng `dossierIds` của văn bản. Văn bản trở thành văn bản tự do, không bị xóa khỏi hệ thống.

### 4.3. Xử lý Chuyển giao Hồ sơ
- Modal chuyển hồ sơ chọn Người nhận mới + Tree Checkbox danh sách hồ sơ con (mặc định tích chọn tất cả).
- Đổi `assignedTo` của các hồ sơ được chọn sang người nhận mới.
- Đổi người thực hiện chính `assigneeId` của toàn bộ văn bản trong các hồ sơ được chọn sang người nhận mới (đồng bộ cả ở trang Văn bản).
- Xử lý trùng tên: Nếu bên người nhận đã có hồ sơ cùng tên, tự động nối đuôi tên dạng `Kế hoạch (Khôi chuyển)`.
- Các hồ sơ con KHÔNG được tích chọn: Ngắt liên kết `parentId`, nâng lên 1 cấp (thành cấp cha trực tiếp trước đó) thuộc sở hữu của User hiện tại.

### 4.4. Người phối hợp (Co-assignees)
- Dropdown Người phối hợp cho phép chọn nhiều staff trong `DocumentModal`.
- Nhân viên làm Người thực hiện chính tự động bị loại khỏi danh sách Người phối hợp (và ngược lại).
- Người phối hợp chỉ có quyền XEM văn bản, nút Hoàn thành và ô chỉnh ngày hoàn thành bị vô hiệu hóa với tooltip thông báo.

### 4.5. Panel Tag Sidebar Finder & Quick Picker Viewer
- Sidebar bên trái hiển thị mục `NHÃN (TAGS)` liệt kê 5 tag dùng nhiều nhất kèm chấm màu + nút `Hiển thị tất cả`.
- Bấm vào tag ở Sidebar: Lọc danh sách hiển thị trên trang hiện tại theo tag đó.
- Trong `DocumentViewer`: Cột trái hiển thị mục `Hồ sơ chứa` và `Nhãn (Tags)` cho phép thêm/bớt nhanh trực tiếp.

---

## 5. Kế hoạch Kiểm thử & Xác minh (Verification)

1. **Test Phân quyền (RBAC):**
   - Đăng nhập tài khoản Guest -> Xác minh ẩn menu `/dossiers` và không truy cập được đường dẫn.
   - Đăng nhập Staff -> Xác minh chỉ xem/sửa được hồ sơ do mình sở hữu hoặc được chuyển đến.
2. **Test Cây Hồ sơ & Xóa:**
   - Tạo cây 3 cấp -> Thêm văn bản -> Xóa cấp 2 -> Xác minh văn bản được chuyển lên cấp 1.
3. **Test Chuyển giao Hồ sơ:**
   - Chuyển hồ sơ cho Staff B (bỏ tích 1 hồ sơ con) -> Xác minh Hồ sơ B nhận có văn bản đổi `assigneeId = B`, hồ sơ con không chọn được nâng cấp và thuộc sở hữu của Staff A.
4. **Test Người phối hợp:**
   - Đăng nhập nhân viên làm Người phối hợp -> Xác minh xem được văn bản nhưng không bấm được Hoàn thành.
5. **Test Tag Sidebar:**
   - Gán tag cho văn bản -> Kiểm tra hiển thị top 5 tag ở Sidebar -> Bấm tag lọc danh sách.
