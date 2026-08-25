# Hướng dẫn dùng bộ skill global

Sau khi cài đặt, hãy khởi động session Codex mới. Skill được tự động chọn theo nội dung yêu cầu; bạn không cần import lại cho từng project.

## Chu trình phát triển

- Ý tưởng/yêu cầu mới: `Hãy dùng brainstorming để làm rõ mục tiêu, người dùng, phạm vi và các phương án.`
- Lập kế hoạch: `Hãy viết implementation plan cho tính năng ...`
- Thực thi: `Hãy thực hiện plan này theo từng task và xác minh sau mỗi task.`
- TDD: `Hãy dùng TDD cho ...; viết test fail trước.`
- Debug: `Hãy debug lỗi ... theo systematic debugging, tìm root cause trước khi sửa.`
- Review: `Hãy review thay đổi này về correctness, security, maintainability và UX.`
- Kết thúc: `Hãy verification trước khi nói là hoàn tất.`

## UI/UX web

- `Thiết kế dashboard SaaS cho [đối tượng], dùng Next.js/Tailwind. Hãy dùng ui-ux-pro-max để tạo design system trước, sau đó dùng frontend-design và shadcn-ui.`
- `Review UI hiện tại theo accessibility, responsive, interaction states và Web Interface Guidelines.`
- `Chọn palette, typography, spacing và motion cho landing page [mô tả], nêu rõ anti-pattern cần tránh.`
- `Tạo design system có token primitive → semantic → component và lưu quyết định vào DESIGN.md.`

## UI/UX mobile

- `Thiết kế flow React Native cho [tính năng], cân nhắc touch target, safe area, offline, navigation và platform iOS/Android.`
- `Audit màn hình mobile này theo mobile-design và web-design-guidelines.`

## Stitch

- `Dùng enhance-prompt để biến ý tưởng này thành prompt Stitch chi tiết.`
- `Dùng design-md để tổng hợp design system từ Stitch project.`
- `Dùng react-components để chuyển Stitch screen thành component React.`

Các skill Stitch cần Stitch MCP/server tương ứng. Nếu không có, skill sẽ cung cấp prompt hoặc hướng dẫn thủ công thay thế.

## Context và đồng bộ an toàn

- `Dùng load-project-context để đọc nhanh repository này.`
- `Dùng save-project-context để cập nhật CODEBASE.md và session notes.`
- `Dùng safe-project-sync để chạy các kiểm tra read-only và báo cáo trạng thái.`

Các yêu cầu push, merge, deploy, đổi branch hoặc rollback phải nêu rõ hành động và target; skill không tự suy ra quyền đó.

## Quản trị

```bash
python3 /Users/buiminhkhoi/Documents/Antigravity/Claude/my-office/scripts/global-skills.py validate --root /Users/buiminhkhoi/.codex/skill-packs/current
python3 /Users/buiminhkhoi/Documents/Antigravity/Claude/my-office/scripts/global-skills.py uninstall --apply
python3 /Users/buiminhkhoi/Documents/Antigravity/Claude/my-office/scripts/global-skills.py rollback --apply
```

Khởi động session Codex mới sau khi cài, nâng cấp, rollback hoặc uninstall để catalog được đọc lại.
