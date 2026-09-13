# TÀI LIỆU MÔ TẢ CHI TIẾT CÁC CHỨC NĂNG HỆ THỐNG MY OFFICE
*(Hệ thống Quản lý Văn bản, Hồ sơ & Công việc Trực tuyến)*

---

## MỤC LỤC
1. [TỔNG QUAN HỆ THỐNG](#1-tổng-quan-hệ-thống)
2. [PHÂN HỆ 1: QUẢN LÝ VĂN BẢN (DOCUMENTS)](#2-phân-hệ-1-quản-lý-văn-bản-documents)
   - [2.1. Danh sách & Bộ lọc văn bản thông minh](#21-danh-sách--bộ-lọc-văn-bản-thông-minh)
   - [2.2. Xem nhanh & Chi tiết văn bản (Document Modal & Viewer)](#22-xem-nhanh--chi-tiết-văn-bản-document-modal--viewer)
   - [2.3. Tiếp nhận & Thêm mới văn bản](#23-tiếp-nhận--thêm-mới-văn-bản)
   - [2.4. Chỉnh sửa văn bản & Panel xem trước linh hoạt](#24-chỉnh-sửa-văn-bản--panel-xem-trước-linh-hoạt)
   - [2.5. Thao tác hàng loạt (Batch Actions)](#25-thao-tác-hàng-loạt-batch-actions)
3. [PHÂN HỆ 2: QUẢN LÝ HỒ SƠ CÔNG VIỆC (DOSSIERS)](#3-phân-hệ-2-quản-lý-hồ-sơ-công-việc-dossiers)
   - [3.1. Cấu trúc cây thư mục 3 cấp & Điều hướng thông minh](#31-cấu-trúc-cây-thư-mục-3-cấp--điều-hướng-thông-minh)
   - [3.2. Thông báo tin nhắn chưa đọc phong cách Telegram / Zalo](#32-thông-báo-tin-nhắn-chưa-đọc-phong-cách-telegram--zalo)
   - [3.3. Chi tiết hồ sơ: Bảng văn bản & Khung thông tin 4 phần](#33-chi-tiết-hồ-sơ-bảng-văn-bản--khung-thông-tin-4-phần)
   - [3.4. Khung 1: Mô tả hồ sơ (Description)](#34-khung-1-mô-tả-hồ-sơ-description)
   - [3.5. Khung 2: Ghi chú cá nhân (Notes - Tự động lưu)](#35-khung-2-ghi-chú-cá-nhân-notes---tự-động-lưu)
   - [3.6. Khung 3: Checklist tiến độ công việc](#36-khung-3-checklist-tiến-độ-công-việc)
   - [3.7. Khung 4: Trao đổi & Bình luận (Chat nội bộ thời gian thực)](#37-khung-4-trao-đổi--bình-luận-chat-nội-bộ-thời-gian-thực)
   - [3.8. Chức năng Chia sẻ hồ sơ (Dossier Sharing)](#38-chức-năng-chia-sẻ-hồ-sơ-dossier-sharing)
   - [3.9. Chức năng Bàn giao / Chuyển quyền hồ sơ (Dossier Transfer)](#39-chức-năng-bàn-giao--chuyển-quyền-hồ-sơ-dossier-transfer)
   - [3.10. Lưu trữ & Ràng buộc Xóa an toàn hồ sơ](#310-lưu-trữ--ràng-buộc-xóa-an-toàn-hồ-sơ)
4. [PHÂN HỆ 3: QUẢN LÝ CÔNG VIỆC (TASKS)](#4-phân-hệ-3-quản-lý-công-việc-tasks)
   - [4.1. Ba chế độ xem trực quan: Danh sách, Kanban & Lịch](#41-ba-chế-độ-xem-trực-quan-danh-sách-kanban--lịch)
   - [4.2. Bảng công việc cải tiến (TaskTable v2)](#42-bảng-công-việc-cải-tiến-tasktable-v2)
   - [4.3. Tìm kiếm nhanh Fuzzy Search & Bộ lọc đồng bộ 3 View](#43-tìm-kiếm-nhanh-fuzzy-search--bộ-lọc-đồng-bộ-3-view)
   - [4.4. Thao tác hàng loạt trên công việc (TaskBulkActions)](#44-thao-tác-hàng-loạt-trên-công-việc-taskbulkactions)
   - [4.5. Quản lý phụ thuộc (Dependencies) & Tự động mở khóa (Auto-Unblock)](#45-quản-lý-phụ-thuộc-dependencies--tự-động-mở-khóa-auto-unblock)
   - [4.6. Công việc lặp lại định kỳ (Task Series)](#46-công-việc-lặp-lại-định-kỳ-task-series)
   - [4.7. Mẫu quy trình công việc chuẩn (Task Templates)](#47-mẫu-quy-trình-công-việc-chuẩn-task-templates)
   - [4.8. Liên kết hai chiều Văn bản ↔ Công việc](#48-liên-kết-hai-chiều-văn-bản--công-việc)
5. [PHÂN HỆ 4: TÌM KIẾM & TRA CỨU NÂNG CAO (SEARCH)](#5-phân-hệ-4-tìm-kiếm--tra-cứu-nâng-cao-search)
6. [PHÂN HỆ 5: CÀI ĐẶT & QUẢN TRỊ HỆ THỐNG (SETTINGS)](#6-phân-hệ-5-cài-đặt--quản-trị-hệ-thống-settings)
   - [6.1. Quản lý Cơ cấu Tổ chức & Khoa / Phòng ban](#61-quản-lý-cơ-cấu-tổ-chức--khoa--phòng-ban)
   - [6.2. Quản lý danh sách Cán bộ / Nhân sự](#62-quản-lý-danh-sách-cán-bộ--nhân-sự)
   - [6.3. Hệ thống Phân quyền theo vai trò (RBAC) & Phạm vi khoa phòng](#63-hệ-thống-phân-quyền-theo-vai-trò-rbac--phạm-vi-khoa-phòng)
   - [6.4. Quản lý Nhãn / Tags danh mục](#64-quản-lý-nhãn--tags-danh-mục)
   - [6.5. Xác thực tự động & Cấu hình Google Drive Sync](#65-xác-thực-tự-động--cấu-hình-google-drive-sync)
7. [PHÂN HỆ 6: TIỆN ÍCH MỞ RỘNG (CHROME EXTENSION)](#7-phân-hệ-6-tiện-ích-mở-rộng-chrome-extension)
8. [BẢO MẬT, LỊCH SỬ KIỂM TOÁN (AUDIT LOGS) & THIẾT KẾ UI/UX](#8-bảo-mật-lịch-sử-kiểm-toán-audit-logs--thiết-kế-uiux)

---

## 1. TỔNG QUAN HỆ THỐNG

**My Office** là ứng dụng web quản lý văn bản, hồ sơ công việc và điều hành tác nghiệp chuyên nghiệp, phục vụ các cơ quan, bệnh viện, đơn vị và văn phòng công sở hiện đại. Hệ thống được xây dựng trên nền tảng **Next.js (App Router)**, **Tailwind CSS**, cơ sở dữ liệu đám mây thời gian thực **Firebase Firestore** và kết nối chặt chẽ với hệ sinh thái **Google Drive**.

### Triết lý thiết kế cốt lõi:
- **Tinh gọn, trực quan, tốc độ**: Giảm thiểu tối đa số lần nhấp chuột, tập trung vào dữ liệu nghiệp vụ, không gian làm việc tối ưu. Tải trước tài nguyên trên hover (`router.prefetch`) mang lại phản hồi tức thì.
- **Cộng tác liền mạch (Collaborative Workspaces)**: Hồ sơ và công việc là không gian cộng tác đa người dùng với trao đổi trực tuyến, phân công đa nhân sự/phòng ban, danh mục đầu việc con và kiểm soát quyền hạn chính xác.
- **Tự động hóa & Đồng bộ**: Tự động sinh công việc định kỳ, tự động giải tỏa trạng thái bị chặn khi hoàn thành công việc tiên quyết, cảnh báo quá hạn thời gian thực và đồng bộ Google Drive.

---

## 2. PHÂN HỆ 1: QUẢN LÝ VĂN BẢN (DOCUMENTS)

Phân hệ Văn bản (`/documents`) là trung tâm tiếp nhận, phân loại, theo dõi tiến độ xử lý và lưu chuyển văn bản đi/đến của đơn vị.

### 2.1. Danh sách & Bộ lọc văn bản thông minh
- **Bảng văn bản trực quan (`DocumentTable`)**:
  - Hiển thị đầy đủ: Tiêu đề, Số hiệu văn bản, Cơ quan ban hành, Lãnh đạo phụ trách, Ngày ban hành, Deadline, Cán bộ xử lý chính, Người phối hợp, Trạng thái và Danh sách file đính kèm.
  - Hỗ trợ sắp xếp cột linh hoạt, đánh số thứ tự tự động và chọn nhiều dòng để xử lý hàng loạt.
- **Hệ thống lọc đa chiều**:
  - **Lọc theo trạng thái**: *Chờ xử lý (Pending)*, *Đang xử lý (In Progress)*, *Hoàn thành (Completed)*, *Quá hạn (Overdue)*. Trạng thái mặc định được lưu trong `localStorage` để duy trì ngữ cảnh làm việc.
  - **Lọc theo cán bộ**: Xem nhanh toàn bộ văn bản của tất cả nhân sự hoặc lọc riêng theo từng cán bộ được phân công.
  - **Lọc theo độ khẩn**: Phân loại theo 5 cấp độ: *Thường*, *Khẩn*, *Thượng khẩn*, *Hỏa tốc*, *Hỏa tốc hẹn giờ*.
  - **Tìm kiếm tức thì (Live Search)**: Tìm kiếm nhanh theo từ khóa trong tiêu đề, số hiệu, trích yếu hoặc tên người gửi mà không cần tải lại trang.
- **Tính toán Deadline & Cảnh báo hạn xử lý**:
  - Đếm ngược số ngày còn lại đến hạn (`còn X ngày`, `hôm nay!`, `quá X ngày`).
  - Đổi màu cảnh báo động: Xanh lục (> 3 ngày), Vàng cam (1–3 ngày), Đỏ rực (hôm nay hoặc đã quá hạn).
  - Tự động chuyển trạng thái văn bản sang *Quá hạn (Overdue)* khi quá deadline mà chưa hoàn thành.

### 2.2. Xem nhanh & Chi tiết văn bản (Document Modal & Viewer)
- **Modal chi tiết văn bản (`DocumentModal`)**:
  - Thiết kế 2 nửa màn hình (Split View):
    - **Nửa trái**: Thông tin trích yếu, số hiệu, ngày ban hành, hạn hoàn thành, người xử lý chính, người phối hợp, ghi chú cá nhân, danh sách hồ sơ chứa văn bản và danh sách các tệp đính kèm.
    - **Nửa phải**: Khung xem trước tài liệu (Preview Iframe) hiển thị trực tiếp file Google Drive / PDF / Google Docs mà không cần rời khỏi hệ thống.
  - **Nút sao chép thông tin giao việc nhanh (Quick Copy)**: 1 cú click để copy toàn bộ nội dung gồm tiêu đề, deadline, người được giao và liên kết tất cả các file vào clipboard để gửi qua Zalo/Telegram/Email.
  - **Tích hợp QuickDossierTagPicker**: Cho phép thêm/gỡ hồ sơ hoặc gắn nhãn màu trực tiếp ngay trong cửa sổ xem văn bản.
  - **Liên kết Công việc**: Hiển thị danh sách các công việc liên quan sinh ra từ văn bản kèm trạng thái và nút deep-link chuyển đến chi tiết công việc; nút **"+ Giao việc từ văn bản"** kích hoạt form tạo công việc gắn sẵn văn bản nguồn.
- **Trang xem văn bản độc lập (`/documents/[id]`)**: Dành cho xem toàn màn hình hoặc truy cập qua link trực tiếp.

### 2.3. Tiếp nhận & Thêm mới văn bản
- Truy cập qua route `/documents/new`.
- Hỗ trợ nhập tiêu đề, số ký hiệu, ngày ban hành, cơ quan gửi, lãnh đạo ký duyệt, hạn định hoàn thành.
- **Đồng bộ Google Drive tự động**: Người dùng chỉ cần dán link file gốc hoặc tải file lên, hệ thống sẽ tự động sao chép sang thư mục lưu trữ nội bộ của cơ quan trên Google Drive và sinh link xem trước dạng nhúng (`/preview`).
- Hỗ trợ thêm không giới hạn các tệp đính kèm (`AttachmentInput`).

### 2.4. Chỉnh sửa văn bản & Panel xem trước linh hoạt
- Truy cập qua route `/documents/[id]/edit` với **Adaptive Layout**:
  - **Khi tắt xem trước (Mặc định)**: Bố cục dạng **2 cột** tinh gọn (Cột trái: Thông tin chính, File đính kèm, Ghi chú; Cột phải: Trạng thái & Thời hạn, Phân công, Hồ sơ & Nhãn).
  - **Khi bật xem trước (Preview Mode)**: Form tự động co về **1 cột rộng rãi** (~540px – 580px), nhường diện tích nửa phải cho **Sticky Preview Panel**.
- **Theo dõi trạng thái "Đang xem" chính xác**: Nút xem trước của file đang hiển thị tự động đổi sang nhãn **`Đang xem`** với nền xanh nổi bật (`bg-blue-600`).
- **Phân công phối hợp**: `CoAssigneePicker` được thiết kế linh hoạt, đảm bảo danh sách tìm kiếm và lựa chọn nhân sự hiển thị trọn vẹn, không bị che khuất.
- **Ràng buộc nghiệp vụ**: Ngày hoàn thành phải $\ge$ Ngày ban hành văn bản; tự động đề xuất chuyển trạng thái sang *Hoàn thành* khi nhập Ngày hoàn thành.

### 2.5. Thao tác hàng loạt (Batch Actions)
Khi tick chọn nhiều văn bản trên bảng danh sách, thanh tác vụ hàng loạt sẽ xuất hiện cho phép:
- **Gán cán bộ xử lý hàng loạt**: Phân công đồng thời nhiều văn bản cho một cán bộ.
- **Chuyển trạng thái hàng loạt**: Đổi trạng thái hàng loạt (Chờ xử lý $\rightarrow$ Đang xử lý $\rightarrow$ Hoàn thành).
- **Thêm vào hồ sơ hàng loạt (`BatchAddDossierModal`)**: Đưa cùng lúc nhiều văn bản vào một hoặc nhiều hồ sơ công việc thông qua cây thư mục.
- **Di chuyển hồ sơ hàng loạt (`BatchMoveDossierModal`)**: Chuyển các văn bản đã chọn từ hồ sơ cũ sang hồ sơ mới.
- **Xóa văn bản hàng loạt**: Dành cho quản trị viên với hộp thoại xác nhận bảo vệ dữ liệu.

---

## 3. PHÂN HỆ 2: QUẢN LÝ HỒ SƠ CÔNG VIỆC (DOSSIERS)

Phân hệ Hồ sơ (`/dossiers`) là không gian cộng tác chuyên sâu theo chuyên đề, dự án hoặc vụ việc, kết nối các văn bản liên quan với nhau cùng toàn bộ quá trình trao đổi, xử lý công việc.

### 3.1. Cấu trúc cây thư mục 3 cấp & Điều hướng thông minh
- **Cấu trúc phân cấp chuẩn 3 cấp**:
  - **Cấp 1 (Root Dossiers)**: Hồ sơ / Dự án lớn cấp đơn vị.
  - **Cấp 2 (Sub-dossiers)**: Các giai đoạn, mảng công việc hoặc tiểu đề án.
  - **Cấp 3 (Nested Dossiers)**: Chi tiết từng đầu việc, biên bản, gói thầu cụ thể.
- **Thao tác cây thư mục (`DossierTreeNav`)**:
  - **Mở rộng / Thu gọn 1 chạm trên thanh tiêu đề**: Nhấp chuột vào tiêu đề *"Quản lý hồ sơ"* lần 1 sẽ tự động mở rộng toàn bộ các nhánh cây thư mục; nhấp lần nữa sẽ thu gọn tất cả lại, giúp điều hướng nhanh chóng.
  - Mở rộng / thu gọn từng nhánh thư mục linh hoạt với lưu trạng thái vào bộ nhớ cục bộ.
  - Thêm nhanh thư mục con tại bất kỳ nhánh nào với nút `+`.
  - Hỗ trợ di chuyển phân cấp (`MoveDossierHierarchyModal`) để chuyển đổi linh hoạt quan hệ cha-con hoặc đưa lên cấp 1.
  - Sắp xếp thứ tự ưu tiên các hồ sơ cấp 1 (`reorderLevel1Dossiers`).
- **Mặc định bộ lọc "Tất cả"**: Trong tất cả các cấp hồ sơ cha và hồ sơ con, bộ lọc trạng thái văn bản mặc định luôn là **"Tất cả"**, đảm bảo người dùng nhìn thấy toàn bộ tài liệu hiện có trong hồ sơ ngay khi mở.

### 3.2. Thông báo tin nhắn chưa đọc phong cách Telegram / Zalo
- **Huy hiệu số đỏ (`DossierUnreadBadge`)**: Hiển thị số lượng tin nhắn trao đổi mới chưa đọc của từng hồ sơ với huy hiệu màu đỏ rực rỡ (`bg-red-600 text-white`).
- **Cơ chế cộng dồn đệ quy thông minh (Recursive Subtree Aggregation)**:
  - Khi một thư mục cha đang **thu gọn (collapsed)**, nếu bất kỳ thư mục con nào ở cấp 2 hoặc cấp 3 có tin nhắn mới, số lượng chưa đọc sẽ **tự động cộng dồn lên thư mục cha** kèm biểu tượng phân biệt.
  - Khi người dùng **mở rộng (expand)** thư mục cha, số cộng dồn sẽ được bóc tách và hiển thị chính xác tại đúng thư mục con phát sinh tin nhắn.
- **Đồng bộ thời gian thực**: Sử dụng `CustomEvent` và `localStorage` để cập nhật tức thì giữa các tab trình duyệt; tự động đánh dấu đã đọc khi người dùng mở xem hồ sơ.

### 3.3. Chi tiết hồ sơ: Bảng văn bản & Khung thông tin 4 phần
Khi chọn một hồ sơ trên cây danh mục:
- **Khu vực trung tâm**: Hiển thị bảng toàn bộ văn bản thuộc hồ sơ hiện tại, hỗ trợ đầy đủ các thao tác xem, tải, lọc, thêm văn bản vào hồ sơ.
- **Panel thông tin bên phải (`DossierPanel`)**: Không gian làm việc chi tiết được chia thành **4 khối chức năng riêng biệt với màu sắc nhận diện đặc trưng**:
  1. *Mô tả hồ sơ (Xanh dương)*
  2. *Ghi chú nội bộ (Hổ phách)*
  3. *Checklist tiến độ (Xanh lục)*
  4. *Trao đổi & Bình luận (Chàm)*

### 3.4. Khung 1: Mô tả hồ sơ (Description)
- **Màu nhận diện**: Khung xanh dương (`border-blue-200`, `bg-blue-50/70`).
- Lưu trữ tóm tắt mục tiêu, phạm vi công việc, căn cứ pháp lý hoặc các mốc quan trọng của hồ sơ; cho phép chỉnh sửa và lưu trực tiếp.

### 3.5. Khung 2: Ghi chú cá nhân (Notes - Tự động lưu)
- **Màu nhận diện**: Khung hổ phách (`border-amber-200`, `bg-amber-50/70`).
- Sổ tay ghi chép nhanh dành cho người phụ trách hồ sơ. **Cơ chế tự động lưu (Autosave)**: Tự động lưu nội dung vào cơ sở dữ liệu ngay khi người dùng rời chuột khỏi ô nhập liệu (onBlur) hoặc ngừng gõ, kèm icon trạng thái *"Đã lưu"*.

### 3.6. Khung 3: Checklist tiến độ công việc
- **Màu nhận diện**: Khung xanh lục (`border-emerald-200`, `bg-emerald-50/70`).
- **Tính năng**: Thanh tiến độ trực quan (% hoàn thành), thêm đầu việc mới, sửa nhanh tiêu đề (inline editing), sắp xếp thứ tự công việc linh hoạt (`▲`, `▼`), đánh dấu hoàn thành kèm tên người thực hiện và thời gian.
- **Phân quyền thao tác Checklist**:
  - **Chủ sở hữu hồ sơ (Owner) & Admin**: Toàn quyền thao tác trên mọi việc.
  - **Thành viên được chia sẻ hồ sơ**: Nếu được giao xử lý ít nhất 1 văn bản trong cây hồ sơ $\rightarrow$ Có toàn quyền thao tác checklist. Nếu chỉ được chia sẻ xem $\rightarrow$ Chỉ được xem tiến độ ở chế độ Read-only.

### 3.7. Khung 4: Trao đổi & Bình luận (Chat nội bộ thời gian thực)
- **Màu nhận diện**: Khung tím chàm (`border-indigo-200`, `bg-indigo-50/70`).
- Giao diện chat thời gian thực: Bong bóng tin nhắn trái/phải, thông tin người gửi, thời gian gửi thông minh, hỗ trợ `Enter` gửi tin nhắn và `Shift + Enter` xuống dòng, xóa tin nhắn cá nhân.

### 3.8. Chức năng Chia sẻ hồ sơ (Dossier Sharing)
- Hộp thoại chia sẻ thông minh (`ShareDossierModal`): Tìm kiếm nhanh nhân sự theo tên, nickname, chức vụ.
- **Kế thừa chia sẻ đệ quy (Recursive Inheritance)**: Khi một hồ sơ cha được chia sẻ cho Cán bộ A, toàn bộ các hồ sơ con ở cấp 2 và cấp 3 tự động được kế thừa quyền xem của Cán bộ A.

### 3.9. Chức năng Bàn giao / Chuyển quyền hồ sơ (Dossier Transfer)
- Chuyển quyền sở hữu hồ sơ sang cán bộ mới (`ownerId`).
- Tùy chọn phạm vi hồ sơ con chuyển giao đi kèm.
- **Tùy chọn tự động chuyển giao văn bản chưa hoàn thành (`reassignUncompletedDocs`)**: Tự động phân công lại cán bộ xử lý chính cho toàn bộ các văn bản đang dang dở trong hồ sơ sang cho người tiếp nhận mới.

### 3.10. Lưu trữ & Ràng buộc Xóa an toàn hồ sơ
- **Lưu trữ hồ sơ (Archive)**: Đưa hồ sơ đã kết thúc vào kho lưu trữ (Read-only), giữ gọn gàng không gian làm việc.
- **Ràng buộc an toàn khi Xóa hồ sơ (`DeleteDossierModal`)**:
  - **Chặn xóa khi đang chia sẻ**: Khi hồ sơ đang được chia sẻ với các cán bộ khác (`sharedWith.length > 0`), hệ thống sẽ **vô hiệu hóa nút xóa** và hiển thị cảnh báo yêu cầu thu hồi các quyền chia sẻ trước khi có thể xóa hồ sơ, tránh vô tình làm mất dữ liệu làm việc chung của đồng nghiệp.
  - **Xóa mềm (Soft Delete)**: Sử dụng trường `deletedAt` để bảo toàn dữ liệu và có thể phục hồi khi cần thiết.

---

## 4. PHÂN HỆ 3: QUẢN LÝ CÔNG VIỆC (TASKS)

Phân hệ Công việc (`/tasks`) là động cơ điều hành tác nghiệp toàn diện, quản lý chu trình sống của từng nhiệm vụ từ lúc khởi tạo, phân công, thực hiện, theo dõi tiến độ cho đến khi nghiệm thu hoàn thành.

### 4.1. Ba chế độ xem trực quan: Danh sách, Kanban & Lịch
Hệ thống cung cấp thanh chuyển đổi linh hoạt giữa 3 chế độ xem:
1. **Danh sách (List View)**: Hiển thị bảng tổng hợp chi tiết với tính năng chọn nhiều dòng, thanh tác vụ hàng loạt, huy hiệu lọc nhanh trạng thái và sắp xếp đa cột.
2. **Kanban Board (`/tasks` view mode Kanban)**:
   - Trực quan hóa công việc theo 4 cột trạng thái chuẩn: *Chờ xử lý (Pending)*, *Đang thực hiện (In Progress)*, *Bị chặn (Blocked)*, *Hoàn thành (Completed)*.
   - Hỗ trợ **kéo thả (Drag & Drop)** thẻ công việc giữa các cột để cập nhật trạng thái tức thì với cơ chế cập nhật giao diện lạc quan (Optimistic UI).
   - Thẻ công việc hiển thị đầy đủ: Phòng ban chủ trì, mức ưu tiên, hạn hoàn thành, tiến độ và người xử lý.
3. **Lịch biểu (Calendar View)**:
   - Hiển thị theo lưới tháng, hỗ trợ điều hướng tháng trước / tháng sau.
   - Nhận diện trực quan các công việc đến hạn trong từng ngày kèm mã màu theo trạng thái.

### 4.2. Bảng công việc cải tiến (TaskTable v2)
Bảng công việc được thiết kế lại tối ưu theo chuẩn UI/UX hiện đại:
- **Tên công việc hiển thị đầy đủ**: Loại bỏ cắt ngắn chữ (`line-clamp-1`), cho phép tên công việc tự động xuống dòng tự nhiên, đọc trọn vẹn nội dung ngay trên bảng.
- **Cột Ưu tiên dạng biểu tượng chấm tròn (`●`)**: Thay thế các badge văn bản dài gây vỡ dòng bằng chấm tròn màu nhỏ gọn kết hợp tooltip chi tiết:
  - `⚪ Thấp` (`bg-slate-400`)
  - `🔵 Bình thường` (`bg-blue-400`)
  - `🟡 Cao` (`bg-amber-500`)
  - `🔴 Khẩn cấp` (`bg-red-500`)
- **Tiền tố biểu tượng trong mọi Dropdown Ưu tiên**: Bộ ký hiệu tròn màu (`⚪`, `🔵`, `🟡`, `🔴`) được đặt trước nhãn chữ trong toàn bộ các dropdown, modal tạo/sửa công việc, form công việc định kỳ và thanh thao tác hàng loạt.
- **Đánh dấu công việc định kỳ**: Tự động hiển thị huy hiệu nhỏ gọn kèm icon `🔄` (Định kỳ) màu tím ngay cạnh tiêu đề đối với các công việc lặp lại định kỳ (`task.seriesId`).
- **Thanh lọc nhanh trạng thái 1-chạm (Quick Filter Badges)**:
  - Hàng badge đầu bảng giúp lọc nhanh: *Chờ xử lý*, *Đang thực hiện*, *Bị chặn*, *Hoàn thành*, *Đã hủy*, *Quá hạn*.
  - Mỗi badge tích hợp bộ đếm số lượng công việc thời gian thực.
  - Hiển thị thông báo *"Hiển thị X/Y công việc"* khi đang lọc kèm nút *"Bỏ lọc"*.
- **Sắp xếp linh hoạt theo từng cột (Column Sorting)**: Click vào tiêu đề các cột (Công việc, Trạng thái, Ưu tiên, Người xử lý, Hạn, Tiến độ) để đảo chiều sắp xếp (Tăng dần $\leftrightarrow$ Giảm dần) với icon mũi tên rõ ràng.
- **Tối ưu tốc độ phản hồi**:
  - Prefetch thông minh trên hover (`onMouseEnter router.prefetch`) trên từng dòng bảng, thẻ Kanban và chip lịch: Khi người dùng rê chuột qua, Next.js đã nạp sẵn dữ liệu trang chi tiết, giúp cú click đầu tiên mở ra tức thì.
  - Áp dụng `React.memo` cho các badge và tách component `SortIcon` ra ngoài bảng, loại bỏ hiện tượng giật lag re-render.

### 4.3. Tìm kiếm nhanh Fuzzy Search & Bộ lọc đồng bộ 3 View
- **Ô tìm kiếm nhanh (Fuzzy Search)**: Cho phép gõ tìm kiếm tức thì theo từ khóa trong tiêu đề công việc. Tích hợp cơ chế Debounce 300ms chống nghẽn và nút xóa nhanh (`✕`).
- **Bộ lọc đa năng**: Lọc theo trạng thái, mức ưu tiên, người xử lý chính (`assigneeId`) và phòng ban (`departmentId`).
- **Đồng bộ xuyên suốt 3 chế độ xem**: Bộ lọc được nâng lên cấp độ trang chủ `/tasks`, do đó khi người dùng chuyển đổi qua lại giữa **Danh sách**, **Kanban** hay **Lịch**, toàn bộ kết quả lọc và tìm kiếm được bảo toàn và áp dụng đồng nhất.

### 4.4. Thao tác hàng loạt trên công việc (TaskBulkActions)
- Checkbox chọn từng dòng và chọn tất cả với trạng thái indeterminate (`-`).
- **Thanh tác vụ nổi (Floating Action Bar)** xuất hiện ở cạnh dưới màn hình khi có công việc được chọn:
  - **Giao việc hàng loạt**: Chọn nhanh nhân sự tiếp nhận.
  - **Đổi trạng thái hàng loạt**: Chuyển đồng thời nhiều việc sang Chờ xử lý, Đang thực hiện, Hoàn thành, Đã hủy.
  - **Đổi mức ưu tiên hàng loạt**: Đổi sang Thấp, Bình thường, Cao, Khẩn cấp với biểu tượng màu trực quan.
  - **Gia hạn hoàn thành hàng loạt**: Chọn ngày hoàn thành mới cho tất cả các việc được chọn.
  - **Đưa vào hồ sơ hàng loạt**: Gắn đồng thời vào hồ sơ công việc.
  - **Xóa hàng loạt**: Xóa an toàn kèm hộp thoại xác nhận.
- **An toàn cơ sở dữ liệu**: Sử dụng thuật toán chia nhỏ lô (chunking) tối đa 200 thao tác/batch, đảm bảo không bao giờ vượt ngưỡng giới hạn của Firestore.

### 4.5. Quản lý phụ thuộc (Dependencies) & Tự động mở khóa (Auto-Unblock)
- **Thiết lập công việc tiên quyết (`dependsOnTaskIds`)**: Cho phép chọn các công việc bắt buộc phải làm xong trước khi việc hiện tại có thể bắt đầu. Thuật toán kiểm tra vòng lặp tự động ngăn chặn việc phụ thuộc chéo (Circular Dependencies).
- **Khởi tạo trạng thái Bị chặn tự động**: Nếu công việc được giao có công việc tiên quyết chưa hoàn thành, hệ thống sẽ tự động đặt trạng thái `blocked` kèm lý do `dependency`.
- **Cảnh báo trực quan trên trang chi tiết (`TaskDetail`)**: Banner màu đỏ cảnh báo công việc đang bị chặn kèm danh sách các việc tiên quyết cần giải quyết trước.
- **Cơ chế tự động mở khóa (Event-Driven Auto-Unblock)**: Ngay khi một công việc chuyển sang trạng thái `completed`, hệ thống sẽ tự động kiểm tra tất cả các công việc đang bị chặn bởi việc này. Nếu tất cả các điều kiện tiên quyết đã thỏa mãn, hệ thống sẽ **tự động mở khóa (unblock)** và chuyển chúng về trạng thái `pending` hoặc `in_progress`, gửi thông báo đến người xử lý.

### 4.6. Công việc lặp lại định kỳ (Task Series)
- **Quản lý chuỗi công việc (`/tasks/recurring`)**:
  - Thiết lập chu kỳ lặp lại: *Hàng ngày*, *Hàng tuần*, *Hàng tháng*, *Hàng năm*.
  - Tùy biến khoảng lặp (ví dụ: mỗi 2 tuần một lần, ngày 15 hàng tháng, thứ Hai cuối cùng của tháng...).
  - **Chính sách ngày nghỉ cuối tuần (Weekend Policy)**: Tùy chọn dời ngày diễn ra sang thứ Sáu tuần trước (`shift_friday`), dời sang thứ Hai tuần sau (`shift_monday`), hoặc giữ nguyên ngày chính xác (`exact`).
  - **Sinh việc định kỳ tự động & Kích hoạt thủ công**: Tự động sinh ra các instance công việc cụ thể theo lịch hoặc bấm nút *"Sinh công việc ngay"* để kiểm tra và sinh trước các kỳ tiếp theo.
  - **Phạm vi chỉnh sửa linh hoạt**: Khi chỉnh sửa một công việc định kỳ, người dùng có thể chọn: *Chỉ sửa lần lặp này (This occurrence)*, *Sửa lần này và tất cả các lần sau (This and following)*, hoặc *Sửa toàn bộ chuỗi (All occurrences)*.

### 4.7. Mẫu quy trình công việc chuẩn (Task Templates)
- Tích hợp các bộ mẫu quy trình chuẩn hóa dành cho môi trường bệnh viện và công sở:
  - *Quy trình Bảng kiểm An toàn Phẫu thuật (WHO Surgical Safety Checklist)*.
  - *Quy trình Báo cáo Sự cố Y khoa & Phân tích Nguyên nhân Gốc rễ (RCA)*.
  - *Quy trình Giao ban & Bàn giao ca trực (Shift Handover)*.
- Cho phép áp dụng nhanh mẫu chỉ bằng 1 cú nhấp chuột, tự động điền tiêu đề, mô tả, danh sách công việc con (subtasks) và mức ưu tiên tương ứng.

### 4.8. Liên kết hai chiều Văn bản ↔ Công việc
- Một văn bản có thể sinh ra nhiều công việc (`task.documentIds`).
- Tại cửa sổ xem văn bản (`DocumentModal`), hiển thị khu vực công việc liên quan với trạng thái tiến độ thời gian thực.
- Bấm nút **"+ Giao việc từ văn bản"** sẽ tự động liên kết ID văn bản vào công việc mới, giúp tra cứu nguồn gốc chỉ đạo dễ dàng.

---

## 5. PHÂN HỆ 4: TÌM KIẾM & TRA CỨU NÂNG CAO (SEARCH)

Trang tra cứu nâng cao (`/search`) phục vụ cho công tác kiểm tra, thanh tra, rà soát và thống kê tài liệu:
- **Tìm kiếm kết hợp đa điều kiện**: Từ khóa trong Tiêu đề, Số ký hiệu, Trích yếu; Cơ quan ban hành; Lãnh đạo ký; Khoảng thời gian; Nhãn phân loại.
- **Tra cứu liên thông Văn bản, Hồ sơ và Công việc**: Xem văn bản nằm trong những hồ sơ nào, sinh ra những công việc nào và ngược lại.

---

## 6. PHÂN HỆ 5: CÀI ĐẶT & QUẢN TRỊ HỆ THỐNG (SETTINGS)

Trang quản trị hệ thống (`/settings`) được tổ chức thành cấu trúc tab hiện đại: `/organization`, `/staff`, `/permissions`, `/tags`, `/general`, `/drive`.

### 6.1. Quản lý Cơ cấu Tổ chức & Khoa / Phòng ban
- **Cây sơ đồ phòng ban (`/settings/organization`)**:
  - Quản lý các khoa lâm sàng, cận lâm sàng, phòng ban chức năng theo mô hình phân cấp cha - con.
  - Thiết lập Trưởng khoa/phòng (`headStaffId`) và các Phó khoa/phòng (`deputyStaffIds`).
  - Phân loại đơn vị: Khoa lâm sàng, Khoa cận lâm sàng, Phòng chức năng, Ban chuyên môn.

### 6.2. Quản lý danh sách Cán bộ / Nhân sự
- **Danh bạ nhân sự (`/settings/staff`)**:
  - Họ tên đầy đủ, tên hiển thị viết tắt, tên đăng nhập, mật khẩu (mã hóa SHA-256).
  - Phân công phòng ban: Phòng ban chính (`primaryDepartmentId`) và danh sách các phòng ban kiêm nhiệm (`departmentIds`).
  - Gán vai trò hệ thống: Hỗ trợ đầy đủ các vai trò bao gồm **Quản trị viên (Admin)**, Trưởng phòng, Phó phòng, Nhân viên, Giao việc, Khách.
  - Trạng thái hoạt động (Đang công tác / Tạm dừng).

### 6.3. Hệ thống Phân quyền theo vai trò (RBAC) & Phạm vi khoa phòng
Hệ thống thiết lập 6 nhóm vai trò chuẩn hóa với cơ chế kiểm soát quyền hạn phân lớp sâu:
1. **Quản trị viên (Admin)**: Toàn quyền trên toàn bộ hệ thống, quản lý người dùng, phân quyền, cấu hình hệ thống, sửa/xóa bất kỳ văn bản, hồ sơ và công việc.
2. **Trưởng phòng / Trưởng khoa (`truong_phong`)**: Quản lý toàn diện công việc, hồ sơ và văn bản trong phạm vi khoa/phòng ban mình phụ trách.
3. **Phó Trưởng phòng / Phó Trưởng khoa (`pho_phong`)**: Hỗ trợ điều hành, phân công và xử lý công việc trong phạm vi khoa/phòng ban.
4. **Cán bộ / Nhân viên (`nhan_vien`)**: Thực hiện các nhiệm vụ được giao, tạo và quản lý hồ sơ/công việc của chính mình.
5. **Cán bộ giao việc (`giao_viec`)**: Chuyên trách tiếp nhận văn bản, phân loại và giao việc.
6. **Khách / Tra cứu (`guest`)**: Chỉ xem các thông tin công khai ở chế độ Read-only.

#### Nguyên tắc Phân quyền Sở hữu & Phạm vi Khoa phòng:
- **Quyền sửa/xóa do chính mình tạo ra (`own`)**:
  - Người dùng có quyền `task:edit_own` / `task:delete_own` chỉ được phép sửa hoặc xóa những công việc do chính tài khoản của mình tạo ra (`createdBy === currentStaffId`). Không được sửa/xóa công việc của người khác.
  - Người dùng có quyền `dossier:edit_own` / `dossier:delete_own` chỉ được phép sửa hoặc xóa hồ sơ do chính mình tạo ra (`ownerId === currentStaffId`).
- **Quyền sửa/xóa đối với tài nguyên của người khác (`all`)**:
  - Khi quyền `task:edit_all`, `task:delete_all`, `dossier:edit_all`, `dossier:delete_all` được cấp cho Trưởng khoa, Phó khoa hoặc Nhân viên: **Quyền này CHỈ CÓ HIỆU LỰC trong phạm vi khoa/phòng ban mà người đó trực thuộc** (so khớp `departmentId` của công việc/hồ sơ với `departmentIds` của người dùng).
  - Nghiêm cấm việc sửa/xóa tài nguyên của các khoa phòng khác.
  - Duy nhất tài khoản **Quản trị viên (Admin)** có quyền sửa/xóa vượt ra ngoài phạm vi khoa phòng trên toàn hệ thống.
- **Chặn xóa hồ sơ đang chia sẻ**: Dù là chủ sở hữu hay có quyền xóa trong khoa, hệ thống kiên quyết ngăn chặn việc xóa hồ sơ nếu hồ sơ đó đang được chia sẻ cho bất kỳ ai khác (`sharedWith.length > 0`).

**Bảng Ma trận Phân quyền chi tiết (`types/permissions.ts`):**

| Nhóm | Quyền hạn | Mô tả chức năng |
|---|---|---|
| **Văn bản** | `document:view_all` | Xem tất cả văn bản trên toàn hệ thống |
| | `document:view_department` | Xem văn bản thuộc khoa/phòng mình |
| | `document:view_assigned` | Chỉ xem văn bản mình được giao |
| | `document:create` | Tiếp nhận / Thêm văn bản mới |
| | `document:edit` | Sửa thông tin văn bản |
| | `document:delete` | Xóa văn bản khỏi hệ thống |
| | `document:assign` | Phân công cán bộ xử lý |
| **Công việc** | `task:view_all` | Xem danh sách tất cả công việc |
| | `task:view_department` | Xem công việc của khoa/phòng |
| | `task:view_assigned` | Xem công việc được giao cho mình |
| | `task:create` | Tạo công việc mới |
| | `task:edit_own` | Sửa công việc do chính mình tạo ra |
| | `task:edit_all` | Sửa công việc do người khác tạo trong cùng khoa |
| | `task:delete_own` | Xóa công việc do chính mình tạo ra |
| | `task:delete_all` | Xóa công việc do người khác tạo trong cùng khoa |
| | `task:assign` | Giao việc cho cán bộ khác |
| | `task:change_status` | Thay đổi trạng thái công việc |
| | `task:complete_assigned`| Hoàn thành công việc mình được giao |
| **Hồ sơ** | `dossier:create` | Tạo hồ sơ công việc mới |
| | `dossier:edit_own` | Sửa hồ sơ do chính mình tạo ra |
| | `dossier:edit_all` | Sửa hồ sơ do người khác tạo trong cùng khoa |
| | `dossier:delete_own` | Xóa hồ sơ do mình tạo (khi không chia sẻ) |
| | `dossier:delete_all` | Xóa hồ sơ trong khoa (khi không chia sẻ) |
| | `dossier:transfer` | Bàn giao hồ sơ cho người khác |
| | `dossier:share` | Chia sẻ hồ sơ cho đồng nghiệp |
| **Tổ chức** | `org:manage_departments`| Thêm, sửa, xóa khoa/phòng ban |
| | `org:manage_staff` | Quản lý cán bộ và gán phòng ban |
| | `org:manage_roles` | Phân quyền vai trò cán bộ |
| **Cấu hình** | `settings:access` | Truy cập trang Cài đặt |
| | `settings:manage_tags` | Quản lý danh mục Nhãn phân loại |
| | `settings:manage_permissions` | Cấu hình ma trận phân quyền RBAC |
| | `settings:manage_drive`| Cấu hình đồng bộ Google Drive |

### 6.4. Quản lý Nhãn / Tags danh mục
- Quản lý danh mục nhãn phân loại màu sắc (`Tag`): Tên nhãn, mã màu nhận diện, sửa, xóa và thống kê số lượng sử dụng.

### 6.5. Xác thực tự động & Cấu hình Google Drive Sync
- **Xác thực tự động (Auto-Anonymous Auth)**: Hệ thống tự động thiết lập phiên làm việc ẩn danh hợp lệ thông qua `ensureAuth()`.
- **Kết nối Google Drive API**: Đăng nhập tài khoản Google tập trung của cơ quan để lưu trữ các file tải lên.

---

## 7. PHÂN HỆ 6: TIỆN ÍCH MỞ RỘNG (CHROME EXTENSION)

Tiện ích mở rộng Chrome trong thư mục `extension/`:
- **Kiểm tra trùng lặp văn bản**: Tự động nhận diện số hiệu và tiêu đề văn bản trên trang web đang xem để đối soát với CSDL My Office.
- **Tiếp nhận 1 chạm (Quick Capture)**: Trích xuất tiêu đề, số hiệu, ngày ban hành và link tệp đính kèm trực tiếp từ trang web đang duyệt để đẩy về My Office.

---

## 8. BẢO MẬT, LỊCH SỬ KIỂM TOÁN (AUDIT LOGS) & THIẾT KẾ UI/UX

### 8.1. Lịch sử kiểm toán (Audit Trail)
Mọi thao tác quan trọng trên hệ thống đều được lưu vết tự động vào bộ sưu tập `auditLogs` trong Firestore:
- Hành động: `CREATE`, `UPDATE`, `DELETE`, `TRANSFER`, `STATUS_CHANGED`, `ASSIGNED`.
- Đối tượng: `document`, `dossier`, `task`, `tag`.
- Thông tin: Người thực hiện (`actorId`), thời gian (`timestamp`), chi tiết thay đổi (`metadata`).

### 8.2. Chuẩn mực thiết kế UI/UX
- **Bảng màu Design Tokens đồng nhất**: Slate làm nền, Blue làm điểm nhấn chủ đạo, kết hợp Emerald (hoàn thành), Amber (cảnh báo/cao), Red (lỗi/quá hạn/khẩn cấp), Indigo (thảo luận), Violet (định kỳ).
- **Tối ưu hóa hiệu năng & tương tác**:
  - `React.memo` và `useMemo` hạn chế re-render thừa.
  - `router.prefetch` nạp trước trang chi tiết khi rê chuột.
  - Debounce tìm kiếm mượt mà.
  - Giao diện đáp ứng (Responsive) trên mọi kích thước màn hình.

---
*Tài liệu được cập nhật ngày 13/09/2026 bởi Đội ngũ Phát triển Hệ thống My Office.*
