# TÀI LIỆU MÔ TẢ CHI TIẾT CÁC CHỨC NĂNG HỆ THỐNG MY OFFICE
*(Hệ thống Quản lý Văn bản & Hồ sơ Công việc Trực tuyến)*

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
   - [3.1. Cấu trúc cây thư mục 3 cấp & Sắp xếp thứ tự](#31-cấu-trúc-cây-thư-mục-3-cấp--sắp-xếp-thứ-tự)
   - [3.2. Thông báo tin nhắn chưa đọc phong cách Telegram / Zalo](#32-thông-báo-tin-nhắn-chưa-đọc-phong-cách-telegram--zalo)
   - [3.3. Chi tiết hồ sơ: Bảng văn bản & Khung thông tin 4 phần](#33-chi-tiết-hồ-sơ-bảng-văn-bản--khung-thông-tin-4-phần)
   - [3.4. Khung 1: Mô tả hồ sơ (Description)](#34-khung-1-mô-tả-hồ-sơ-description)
   - [3.5. Khung 2: Ghi chú cá nhân (Notes - Tự động lưu)](#35-khung-2-ghi-chú-cá-nhân-notes---tự-động-lưu)
   - [3.6. Khung 3: Checklist tiến độ công việc](#36-khung-3-checklist-tiến-độ-công-việc)
   - [3.7. Khung 4: Trao đổi & Bình luận (Chat nội bộ thời gian thực)](#37-khung-4-trao-đổi--bình-luận-chat-nội-bộ-thời-gian-thực)
   - [3.8. Chức năng Chia sẻ hồ sơ (Dossier Sharing)](#38-chức-năng-chia-sẻ-hồ-sơ-dossier-sharing)
   - [3.9. Chức năng Bàn giao / Chuyển quyền hồ sơ (Dossier Transfer)](#39-chức-năng-bàn-giao--chuyển-quyền-hồ-sơ-dossier-transfer)
   - [3.10. Lưu trữ & Xóa an toàn hồ sơ](#310-lưu-trữ--xóa-an-toàn-hồ-sơ)
4. [PHÂN HỆ 3: TÌM KIẾM & TRA CỨU NÂNG CAO (SEARCH)](#4-phân-hệ-3-tìm-kiếm--tra-cứu-nâng-cao-search)
5. [PHÂN HỆ 4: CÀI ĐẶT & QUẢN TRỊ HỆ THỐNG (SETTINGS)](#5-phân-hệ-4-cài-đặt--quản-trị-hệ-thống-settings)
   - [5.1. Quản lý danh sách Cán bộ / Nhân viên](#51-quản-lý-danh-sách-cán-bộ--nhân-viên)
   - [5.2. Hệ thống Phân quyền theo vai trò (RBAC)](#52-hệ-thống-phân-quyền-theo-vai-trò-rbac)
   - [5.3. Quản lý Nhãn / Tags danh mục](#53-quản-lý-nhãn--tags-danh-mục)
   - [5.4. Xác thực tự động & Cấu hình Google Drive Sync](#54-xác-thực-tự-động--cấu-hình-google-drive-sync)
6. [PHÂN HỆ 5: TIỆN ÍCH MỞ RỘNG (CHROME EXTENSION)](#6-phân-hệ-5-tiện-ích-mở-rộng-chrome-extension)
7. [BẢO MẬT, LỊCH SỬ KIỂM TOÁN (AUDIT LOGS) & THIẾT KẾ UI/UX](#7-bảo-mật-lịch-sử-kiểm-toán-audit-logs--thiết-kế-uiux)

---

## 1. TỔNG QUAN HỆ THỐNG

**My Office** là ứng dụng web quản lý văn bản và hồ sơ công việc chuyên nghiệp, phục vụ các cơ quan, đơn vị, văn phòng công sở hiện đại. Hệ thống được xây dựng trên nền tảng **Next.js (App Router)**, **Tailwind CSS**, cơ sở dữ liệu thời gian thực **Firebase Firestore** và kết nối chặt chẽ với hệ sinh thái **Google Drive**.

### Triết lý thiết kế cốt lõi:
- **Tinh gọn, trực quan, tốc độ**: Giảm thiểu tối đa số lần nhấp chuột, tập trung vào dữ liệu nghiệp vụ, không gian làm việc tối ưu.
- **Cộng tác liền mạch (Collaborative Workspaces)**: Hồ sơ công việc không chỉ là nơi chứa văn bản mà còn là không gian làm việc nhóm với chat thời gian thực, danh mục đầu việc (checklist), ghi chú tự lưu và cơ chế phân quyền chia sẻ sâu.
- **Tự động hóa & Đồng bộ**: Tự động chuyển đổi và nhúng tài liệu xem trước, tự động tính toán thời hạn, nhắc nhở quá hạn và đồng bộ Google Drive.

---

## 2. PHÂN HỆ 1: QUẢN LÝ VĂN BẢN (DOCUMENTS)

Phân hệ Văn bản (`/documents`) là trung tâm tiếp nhận, phân loại, theo dõi tiến độ xử lý và lưu chuyển văn bản đi/đến của đơn vị.

### 2.1. Danh sách & Bộ lọc văn bản thông minh
- **Bảng văn bản trực quan (`DocumentTable`)**:
  - Hiển thị đầy đủ thông tin: Tiêu đề, Số hiệu văn bản, Cơ quan ban hành, Lãnh đạo phụ trách, Ngày ban hành, Deadline, Cán bộ xử lý chính, Người phối hợp, Trạng thái và Danh sách file đính kèm.
  - Hỗ trợ sắp xếp cột linh hoạt, đánh số thứ tự tự động và chọn nhiều dòng để xử lý hàng loạt.
- **Hệ thống lọc đa chiều**:
  - **Lọc theo trạng thái**: *Chờ xử lý (Pending)*, *Đang xử lý (In Progress)*, *Hoàn thành (Completed)*, *Quá hạn (Overdue)*. Trạng thái mặc định được lưu trong `localStorage` để duy trì ngữ cảnh làm việc của người dùng.
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
- **Trang xem văn bản độc lập (`/documents/[id]`)**: Dành cho xem toàn màn hình hoặc truy cập qua link trực tiếp.

### 2.3. Tiếp nhận & Thêm mới văn bản
- Truy cập qua route `/documents/new`.
- Hỗ trợ nhập tiêu đề, số ký hiệu, ngày ban hành, cơ quan gửi, lãnh đạo ký duyệt, hạn định hoàn thành.
- **Đồng bộ Google Drive tự động**: Người dùng chỉ cần dán link file gốc hoặc tải file lên, hệ thống sẽ tự động sao chép sang thư mục lưu trữ nội bộ của cơ quan trên Google Drive và sinh link xem trước dạng nhúng (`/preview`).
- Hỗ trợ thêm không giới hạn các tệp đính kèm (`AttachmentInput`).

### 2.4. Chỉnh sửa văn bản & Panel xem trước linh hoạt
- Truy cập qua route `/documents/[id]/edit` với **Adaptive Layout**:
  - **Khi tắt xem trước (Mặc định)**: Bố cục dạng **2 cột** tinh gọn (Cột trái: Thông tin chính, File đính kèm, Ghi chú; Cột phải: Trạng thái & Thời hạn, Phân công, Hồ sơ & Nhãn), tối ưu chiều cao, loại bỏ thao tác cuộn dài.
  - **Khi bật xem trước (Preview Mode)**: Form tự động co về **1 cột rộng rãi** (~540px – 580px), nhường diện tích nửa phải cho **Sticky Preview Panel**. Toàn bộ 3 ô ngày tháng, combobox phân công và các nút chức năng có đầy đủ không gian hiển thị rộng rãi, không bị dồn ép.
- **Theo dõi trạng thái "Đang xem" chính xác**:
  - Nút xem trước của file đang hiển thị sẽ tự động đổi sang nhãn **`Đang xem`** với nền màu xanh đậm nổi bật (`bg-blue-600`).
  - Hỗ trợ xem trước cho cả link file chính và từng file đính kèm riêng biệt. Bấm lại vào nút "Đang xem" sẽ tự động đóng khung xem trước.
- **Khắc phục lỗi che khung Người phối hợp**: `CoAssigneePicker` được thiết lập `relative z-30` và bỏ giới hạn cắt góc, đảm bảo danh sách tìm kiếm và lựa chọn nhân sự luôn hiển thị trọn vẹn, trôi mượt mà trên các khối nội dung khác.
- **Ràng buộc nghiệp vụ (Validation)**:
  - Tự động kiểm tra: Ngày hoàn thành phải $\ge$ Ngày ban hành văn bản.
  - Tự động đề xuất chuyển trạng thái sang *Hoàn thành* khi người dùng nhập Ngày hoàn thành.

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

### 3.1. Cấu trúc cây thư mục 3 cấp & Sắp xếp thứ tự
- **Cấu trúc phân cấp chuẩn 3 cấp**:
  - **Cấp 1 (Root Dossiers)**: Hồ sơ / Dự án lớn cấp đơn vị.
  - **Cấp 2 (Sub-dossiers)**: Các giai đoạn, mảng công việc hoặc tiểu đề án.
  - **Cấp 3 (Nested Dossiers)**: Chi tiết từng đầu việc, biên bản, gói thầu cụ thể.
- **Thao tác cây thư mục (`DossierTreeNav`)**:
  - Mở rộng / thu gọn từng nhánh thư mục linh hoạt với lưu trạng thái vào bộ nhớ cục bộ.
  - Thêm nhanh thư mục con tại bất kỳ nhánh nào với nút `+`.
  - Hỗ trợ kéo thả (Drag & Drop) hoặc dùng menu di chuyển phân cấp (`MoveDossierHierarchyModal`) để chuyển đổi linh hoạt quan hệ cha-con hoặc đưa lên cấp 1.
  - Sắp xếp thứ tự ưu tiên các hồ sơ cấp 1 (`reorderLevel1Dossiers`).

### 3.2. Thông báo tin nhắn chưa đọc phong cách Telegram / Zalo
- **Huy hiệu số đỏ (`DossierUnreadBadge`)**:
  - Hiển thị số lượng tin nhắn trao đổi mới chưa đọc của từng hồ sơ với huy hiệu màu đỏ rực rỡ (`bg-red-600 text-white`).
- **Cơ chế cộng dồn đệ quy thông minh (Recursive Subtree Aggregation)**:
  - Khi một thư mục cha đang **thu gọn (collapsed)**, nếu bất kỳ thư mục con nào ở cấp 2 hoặc cấp 3 có tin nhắn mới, số lượng chưa đọc sẽ **tự động cộng dồn lên thư mục cha** kèm biểu tượng phân biệt.
  - Khi người dùng **mở rộng (expand)** thư mục cha, số cộng dồn sẽ được bóc tách và hiển thị chính xác tại đúng thư mục con phát sinh tin nhắn.
- **Đồng bộ thời gian thực & Tự động xóa thông báo**:
  - Dùng cơ chế `CustomEvent` và `localStorage` để cập nhật tức thì giữa các tab trình duyệt mà không cần tốn chi phí đọc lại cơ sở dữ liệu.
  - Khi người dùng nhấp vào hồ sơ hoặc mở panel trao đổi, hệ thống sẽ tự động ghi nhận đã đọc và xóa huy hiệu.

### 3.3. Chi tiết hồ sơ: Bảng văn bản & Khung thông tin 4 phần
Khi chọn một hồ sơ trên cây danh mục:
- **Khu vực trung tâm**: Hiển thị bảng toàn bộ văn bản thuộc hồ sơ hiện tại, hỗ trợ đầy đủ các thao tác xem, tải, lọc, thêm văn bản vào hồ sơ.
- **Panel thông tin bên phải (`DossierPanel`)**: Không gian làm việc chi tiết được chia thành **4 khối chức năng riêng biệt với màu sắc nhận diện đặc trưng**:
  1. *Mô tả hồ sơ (Xanh dương)*
  2. *Ghi chú nội bộ (Hổ phách)*
  3. *Checklist tiến độ (Xanh lục)*
  4. *Trao đổi & Bình luận (Chàm)*

---

### 3.4. Khung 1: Mô tả hồ sơ (Description)
- **Màu nhận diện**: Khung xanh dương (`border-blue-200`, `bg-blue-50/70`).
- **Chức năng**:
  - Lưu trữ tóm tắt mục tiêu, phạm vi công việc, căn cứ pháp lý hoặc các mốc quan trọng của hồ sơ.
  - Cho phép chỉnh sửa và lưu trực tiếp với nút "Lưu mô tả".

---

### 3.5. Khung 2: Ghi chú cá nhân (Notes - Tự động lưu)
- **Màu nhận diện**: Khung hổ phách (`border-amber-200`, `bg-amber-50/70`).
- **Chức năng**:
  - Sổ tay ghi chép nhanh dành cho người phụ trách hồ sơ (các lưu ý nháp, số điện thoại đối tác, chỉ đạo miệng của lãnh đạo...).
  - **Cơ chế tự động lưu (Autosave)**: Tự động lưu nội dung vào cơ sở dữ liệu ngay khi người dùng rời chuột khỏi ô nhập liệu (onBlur) hoặc ngừng gõ, kèm icon trạng thái *"Đã lưu"* giúp không bao giờ bị mất dữ liệu.

---

### 3.6. Khung 3: Checklist tiến độ công việc
- **Màu nhận diện**: Khung xanh lục (`border-emerald-200`, `bg-emerald-50/70`).
- **Giao diện & Tính năng**:
  - **Thanh tiến độ trực quan (Progress Bar)**: Hiển thị tỷ lệ phần trăm công việc đã hoàn thành (ví dụ: `Đã xong 4/6 việc (67%)`), tự động cập nhật khi tick chọn.
  - **Thêm đầu việc mới**: Nhập tiêu đề việc và nhấn `Enter` hoặc click nút `+`.
  - **Sửa nhanh tiêu đề đầu việc (Inline Editing)**: Nhấp vào icon cây bút để sửa trực tiếp tiêu đề công việc, hỗ trợ phím tắt `Enter` để lưu và `Esc` để hủy.
  - **Sắp xếp thứ tự công việc linh hoạt**: Nút mũi tên lên `▲` và xuống `▼` cho phép đảo thứ tự các công việc ưu tiên làm trước hoặc làm sau.
  - **Đánh dấu hoàn thành**: Checkbox tích chọn hoàn thành kèm ghi nhận thời gian và tên người thực hiện hoàn thành đầu việc đó.
- **Phân quyền thao tác Checklist sâu sắc (Granular Permissions)**:
  - **Chủ sở hữu hồ sơ (Owner) & Admin**: Toàn quyền thêm, sửa, xóa, đổi thứ tự và tick hoàn thành tất cả các việc.
  - **Thành viên được chia sẻ hồ sơ (Shared Staff)**:
    - *Trường hợp 1 (Được giao việc)*: Nếu cán bộ đó được phân công (xử lý chính hoặc người phối hợp) **ít nhất 1 văn bản** trong toàn bộ cây thư mục của hồ sơ này $\rightarrow$ **Có toàn quyền thao tác trên checklist** (thêm task mới, sửa tiêu đề, đổi thứ tự, tick hoàn thành).
    - *Trường hợp 2 (Chỉ tham khảo)*: Nếu cán bộ không được giao văn bản nào trong cây hồ sơ $\rightarrow$ Chỉ được xem tiến độ (hệ thống tự động ẩn form thêm task, ẩn nút sửa/xóa/đổi thứ tự, vô hiệu hóa checkbox).

---

### 3.7. Khung 4: Trao đổi & Bình luận (Chat nội bộ thời gian thực)
- **Màu nhận diện**: Khung tím chàm (`border-indigo-200`, `bg-indigo-50/70`).
- **Giao diện dạng tin nhắn chat hiện đại**:
  - **Bong bóng tin nhắn (Chat Bubbles)**:
    - Tin nhắn của người dùng hiện tại được căn lề phải với màu xanh nổi bật.
    - Tin nhắn của các thành viên khác được căn lề trái với màu xám thanh lịch.
  - **Thông tin tin nhắn**: Tên người gửi, avatar chữ cái viết tắt, nội dung tin nhắn và thời gian gửi (định dạng thông minh: `14:30` nếu trong ngày hoặc `14:30 08/09` nếu khác ngày).
  - **Xóa tin nhắn**: Cho phép người gửi hoặc Admin xóa tin nhắn của mình.
- **Trải nghiệm gõ phím mượt mà**:
  - Hỗ trợ phím tắt `Enter` để gửi tin nhắn ngay lập tức.
  - Hỗ trợ `Shift + Enter` để xuống dòng soạn thảo nhiều đoạn.
  - Tự động cuộn xuống tin nhắn mới nhất khi có thảo luận mới.

---

### 3.8. Chức năng Chia sẻ hồ sơ (Dossier Sharing)
- Kích hoạt qua nút **"Chia sẻ"** (`Share2`) trên thanh tiêu đề hồ sơ hoặc menu bảng.
- **Hộp thoại chia sẻ (`ShareDossierModal`)**:
  - Danh sách cán bộ được quyền truy cập hồ sơ hiển thị dưới dạng badge kèm nút gỡ bỏ `✕`.
  - Ô tìm kiếm cán bộ thông minh: Tìm nhanh theo tên, tên ngắn, nickname hoặc chức vụ; tự động loại trừ chủ sở hữu và những người đã được chia sẻ.
- **Kế thừa chia sẻ đệ quy (Recursive Inheritance)**:
  - Khi một hồ sơ cha được chia sẻ cho Cán bộ A, **toàn bộ các hồ sơ con ở cấp 2 và cấp 3 sẽ tự động được kế thừa quyền xem** của Cán bộ A.
  - Đảm bảo việc cộng tác trong toàn bộ đề án diễn ra thông suốt mà không cần chia sẻ thủ công từng thư mục con lẻ tẻ.

---

### 3.9. Chức năng Bàn giao / Chuyển quyền hồ sơ (Dossier Transfer)
- Áp dụng khi cán bộ luân chuyển công tác, bàn giao nhiệm vụ hoặc thay đổi người chủ trì đề tài/vụ việc.
- Kích hoạt qua nút **"Bàn giao hồ sơ"** trên menu bảng (`TransferDossierModal`).
- **Quy trình bàn giao nghiệp vụ hoàn chỉnh**:
  1. **Chọn người tiếp nhận**: Chọn cán bộ mới sẽ tiếp quản làm Chủ sở hữu (`ownerId`).
  2. **Chọn phạm vi hồ sơ con**: Người dùng có thể chọn bàn giao hồ sơ hiện tại và tùy chọn tích chọn các hồ sơ con trực thuộc muốn chuyển giao đi kèm.
  3. **Tùy chọn tự động chuyển giao văn bản chưa hoàn thành (`reassignUncompletedDocs`)**:
     - Khi bật tùy chọn này, hệ thống sẽ tự động quét tất cả các văn bản **chưa hoàn thành** nằm trong các hồ sơ được chuyển giao, và **tự động phân công lại người xử lý chính sang cho cán bộ tiếp nhận mới**.
     - Các văn bản đã hoàn thành trong quá khứ được giữ nguyên lịch sử cán bộ xử lý cũ.
  4. **Ghi nhật ký kiểm toán (Audit Logging)**: Lưu vết chi tiết người bàn giao, người tiếp nhận, thời điểm bàn giao và các hồ sơ con đi kèm vào hệ thống kiểm toán.

---

### 3.10. Lưu trữ & Xóa an toàn hồ sơ
- **Lưu trữ hồ sơ (Archive)**:
  - Đưa các hồ sơ đã kết thúc công việc vào trạng thái Lưu trữ để tránh làm rối mắt không gian làm việc thường nhật, nhưng vẫn tra cứu được khi cần.
  - Hồ sơ lưu trữ được bảo vệ ở chế độ chỉ đọc (Read-only).
- **Xóa hồ sơ an toàn (`DeleteDossierModal`)**:
  - Hỗ trợ 2 phương thức xử lý đối với các văn bản bên trong:
    - *Cách 1*: Gỡ hồ sơ khỏi văn bản (văn bản vẫn tồn tại an toàn trong hệ thống chung, chỉ mất liên kết với hồ sơ bị xóa).
    - *Cách 2*: Xóa vĩnh viễn toàn bộ văn bản phụ thuộc nếu người dùng có quyền quản trị tối cao.
  - Sử dụng cơ chế xóa mềm (`deletedAt`) để có thể khôi phục khi có sự cố nhầm lẫn.

---

## 4. PHÂN HỆ 3: TÌM KIẾM & TRA CỨU NÂNG CAO (SEARCH)

Trang tra cứu nâng cao (`/search`) phục vụ cho công tác kiểm tra, thanh tra, rà soát và thống kê tài liệu:
- **Tìm kiếm kết hợp đa điều kiện**:
  - Tìm theo từ khóa trong Tiêu đề, Số ký hiệu, Trích yếu nội dung văn bản.
  - Tìm theo Cơ quan ban hành hoặc Lãnh đạo ký.
  - Tìm theo khoảng thời gian (Từ ngày... Đến ngày...).
  - Tìm theo Nhãn / Tags danh mục.
- **Tra cứu liên thông Văn bản và Hồ sơ**:
  - Xem một văn bản đang nằm trong những hồ sơ công việc nào.
  - Tra cứu ngược lại từ hồ sơ để hiển thị toàn bộ tài liệu và biên bản liên quan.

---

## 5. PHÂN HỆ 4: CÀI ĐẶT & QUẢN TRỊ HỆ THỐNG (SETTINGS)

Trang quản trị hệ thống (`/settings`) dành riêng cho Admin và các nhân sự được phân quyền quản lý.

### 5.1. Quản lý danh sách Cán bộ / Nhân viên
- Quản lý hồ sơ cán bộ (`StaffMember`):
  - Họ và tên đầy đủ (ví dụ: *Nguyễn Văn Giang*).
  - Tên hiển thị viết tắt trên bảng (ví dụ: *Giang*).
  - Tên đăng nhập / Nickname (duy nhất).
  - Mật khẩu bảo vệ (mã hóa chuẩn SHA-256).
  - Chức danh chuyên môn (ví dụ: *Chuyên viên chính*).
  - Chức vụ quản lý (ví dụ: *Phó Trưởng phòng*).
  - Trạng thái hoạt động (Kích hoạt / Tạm dừng).
- Thêm mới cán bộ, cập nhật thông tin và cấp lại mật khẩu.

### 5.2. Hệ thống Phân quyền theo vai trò (RBAC)
Hệ thống thiết lập sẵn 3 nhóm vai trò cơ bản:
1. **Quản trị viên (Admin)**: Toàn quyền trên tất cả các phân hệ, quản lý người dùng, phân quyền, cấu hình hệ thống, xóa và chuyển nhượng hồ sơ.
2. **Cán bộ / Nhân viên (Staff)**: Được phân công xử lý văn bản, tạo và quản lý hồ sơ của mình, tham gia trao đổi trên các hồ sơ được chia sẻ, cập nhật tiến độ công việc được giao.
3. **Khách / Tra cứu (Guest)**: Chỉ xem thông tin văn bản công khai, không thể chỉnh sửa, không được chọn hàng loạt, không được tạo hay sửa hồ sơ/tags.

**Bảng Ma trận Phân quyền chi tiết (`RolePermissions`):**

| Mã quyền | Mô tả chức năng | Admin | Staff | Guest |
|---|---|:---:|:---:|:---:|
| `canViewAll` | Xem danh sách tất cả văn bản | ✅ | ✅ | ✅ |
| `canAddDocument` | Tiếp nhận / Thêm mới văn bản | ✅ | ✅ | ❌ |
| `canEditDocument` | Chỉnh sửa thông tin văn bản | ✅ | ✅ | ❌ |
| `canDeleteDocument` | Xóa văn bản khỏi hệ thống | ✅ | ❌ | ❌ |
| `canAssignStaff` | Phân công cán bộ xử lý | ✅ | ✅ | ❌ |
| `canSetDeadline` | Thiết lập hạn định xử lý | ✅ | ✅ | ❌ |
| `canSetCompletedDate` | Cập nhật ngày hoàn thành | ✅ | ✅ | ❌ |
| `canToggleComplete` | Bấm hoàn thành tất cả văn bản | ✅ | ❌ | ❌ |
| `canCompleteAssigned` | Bấm hoàn thành việc mình được giao | ✅ | ✅ | ❌ |
| `canCreateDossier` | Tạo hồ sơ công việc mới | ✅ | ✅ | ❌ |
| `canEditDossier` | Đổi tên, sửa mô tả hồ sơ | ✅ | ✅ (của mình) | ❌ |
| `canDeleteDossier` | Xóa hồ sơ công việc | ✅ | ✅ (của mình) | ❌ |
| `canTransferDossier` | Bàn giao quyền sở hữu hồ sơ | ✅ | ✅ (của mình) | ❌ |
| `canAccessSettings` | Truy cập trang Cài đặt hệ thống | ✅ | ❌ | ❌ |

### 5.3. Quản lý Nhãn / Tags danh mục
- Quản lý danh mục thẻ đánh dấu phân loại văn bản (`Tag`):
  - Tên nhãn (ví dụ: *BHYT, Đào tạo, Dự án CNTT, Khẩn cấp*).
  - Bảng mã màu trực quan (đỏ, xanh, tím, vàng, lục...) giúp văn bản nổi bật trên bảng danh sách.
  - Thêm nhãn mới, sửa tên nhãn, xóa nhãn và thống kê số lượng văn bản đang gắn nhãn.

### 5.4. Xác thực tự động & Cấu hình Google Drive Sync
- **Xác thực tự động (Auto-Anonymous Auth)**: Hệ thống tự động sinh phiên làm việc ẩn danh hợp lệ thông qua `ensureAuth()`, giúp người dùng truy cập làm việc ngay mà không bị chặn bởi màn hình đăng nhập rườm rà.
- **Kết nối Google Drive API**:
  - Quản trị viên đăng nhập Google để cấp quyền lưu trữ tập trung cho toàn cơ quan.
  - Cấu hình thư mục đích trên Google Drive để lưu trữ tự động các file tải lên từ văn bản.

---

## 6. PHÂN HỆ 5: TIỆN ÍCH MỞ RỘNG (CHROME EXTENSION)

Nằm trong thư mục `extension/`, tiện ích mở rộng Chrome là công cụ đắc lực hỗ trợ tiếp nhận văn bản từ môi trường web bên ngoài (các cổng thông tin, phần mềm quản lý văn bản ngành y tế, bảo hiểm xã hội, cổng dịch vụ công...):
- **Kiểm tra trùng lặp văn bản**: Tự động nhận diện số hiệu và tiêu đề văn bản trên trang web đang xem để đối soát với CSDL My Office xem văn bản này đã được tiếp nhận hay chưa.
- **Tiếp nhận 1 chạm (Quick Capture)**:
  - Trích xuất tiêu đề, số hiệu, ngày ban hành và link tệp đính kèm trực tiếp từ trang web đang duyệt.
  - Đẩy dữ liệu tức thì về My Office và kích hoạt tiến trình sao lưu tệp lên Google Drive.

---

## 7. BẢO MẬT, LỊCH SỬ KIỂM TOÁN (AUDIT LOGS) & THIẾT KẾ UI/UX

### 7.1. Lịch sử kiểm toán (Audit Trail)
- Mọi thao tác quan trọng trên hệ thống đều được lưu vết tự động vào bộ sưu tập `auditLogs` trong Firestore:
  - Hành động: `CREATE`, `UPDATE`, `DELETE`, `TRANSFER`.
  - Đối tượng: `document`, `dossier`, `tag`.
  - Thông tin người thực hiện (`actorId`), địa chỉ, thời gian (`timestamp`) và dữ liệu trước/sau khi thay đổi (`metadata`).

### 7.2. Chuẩn mực thiết kế UI/UX (UI/UX Pro Max & ckm:ui-styling)
- **Hệ thống Design Tokens đồng nhất**:
  - Bảng màu hiện đại: Slate làm nền (`bg-slate-50`, `border-slate-200`), Blue làm điểm nhấn chủ đạo (`text-blue-600`, `bg-blue-600`), kết hợp các màu nhấn ngữ nghĩa (Emerald cho thành công, Amber cho cảnh báo, Red cho lỗi/quá hạn, Indigo cho thảo luận).
  - Kiểu chữ hiện đại, phân cấp thị giác sắc nét từ tiêu đề đến phụ chú.
- **Tương tác vi mô (Micro-interactions)**:
  - Hiệu ứng chuyển động mượt mà khi hover, active, mở modal, mở side panel.
  - Phản hồi trạng thái tức thì (icon loading, nút "Đang xem" đổi màu, toast thông báo thành công).
- **Thiết kế thích ứng (Responsive Layout)**:
  - Tối ưu hóa trải nghiệm trên các kích thước màn hình phổ biến từ Desktop văn phòng (1920x1080, 1440x900) cho đến máy tính bảng và điện thoại di động.

---
*Tài liệu được cập nhật ngày 10/09/2026 bởi Đội ngũ Phát triển Hệ thống My Office.*
