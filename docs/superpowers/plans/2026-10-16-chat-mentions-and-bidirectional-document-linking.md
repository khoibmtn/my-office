# @Mention Nhân Viên & Liên Kết Văn Bản 2 Chiều Giữa Chat ⇄ Công Việc ⇄ Hồ Sơ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiện thực hóa tính năng @mention nhân viên có menu gợi ý và highlight, cơ chế đính kèm văn bản dạng Rich Card vào tin nhắn chat, và menu chuyển đổi 2 chiều giữa tin nhắn chat với công việc và hồ sơ lưu trữ.

**Architecture:**
- Mở rộng schema `TaskComment` và `DossierComment` với `AttachedDocMetadata` và `mentions: string[]`.
- Xây dựng cụm component chat dùng chung trong `components/chat/`: `MentionTextarea`, `ChatMessageBubble`, `DocAttachmentPickerModal`.
- Tích hợp đồng bộ vào `TaskCommentThread.tsx` (Khung trao đổi Công việc) và `DossierPanel.tsx` (Khung chat Hồ sơ), hỗ trợ các nút "Gửi vào chat" và menu "Gắn vào công việc/hồ sơ".

**Tech Stack:** Next.js 14/15 (App Router), React, TypeScript, Tailwind CSS, Firebase Firestore, Lucide Icons.

---

### Task 1: Data Model & Mutation Updates for Chat Mentions & Attached Documents

**Files:**
- Modify: `types/tasks.ts`
- Modify: `types/index.ts`
- Modify: `lib/tasks/mutations.ts`
- Modify: `lib/dossiers.ts`

- [x] **Step 1: Add `AttachedDocMetadata` and update `TaskComment` in `types/tasks.ts`**
- [x] **Step 2: Update `DossierComment` in `types/index.ts`**
- [x] **Step 3: Update `addTaskComment` in `lib/tasks/mutations.ts` to accept `attachedDocMetadata`**
- [x] **Step 4: Update `addDossierComment` in `lib/dossiers.ts` to accept `mentions`, `attachedDocId`, `attachedDocMetadata`**
- [x] **Step 5: Verify types with `npx tsc --noEmit` & commit**

---

### Task 2: Build `MentionTextarea.tsx` Component

**Files:**
- Create: `components/chat/MentionTextarea.tsx`

- [x] **Step 1: Implement caret detection and `@` query extraction**
- [x] **Step 2: Build floating autocomplete menu with `activeStaff` filtering**
- [x] **Step 3: Support keyboard navigation (Up, Down, Enter, Tab, Escape)**
- [x] **Step 4: Support attached document preview pill with remove (X) button**
- [x] **Step 5: Add document attachment picker button and Send button**
- [x] **Step 6: Verify types & commit**

---

### Task 3: Build `DocAttachmentPickerModal.tsx` Component

**Files:**
- Create: `components/chat/DocAttachmentPickerModal.tsx`

- [x] **Step 1: Create modal dialog with two tabs: "Trong mục này" and "Tất cả văn bản"**
- [x] **Step 2: Implement search and selection with document preview tags**
- [x] **Step 3: Export formatted `AttachedDocMetadata` on selection**
- [x] **Step 4: Verify types & commit**

---

### Task 4: Build `ChatMessageBubble.tsx` Component

**Files:**
- Create: `components/chat/ChatMessageBubble.tsx`

- [x] **Step 1: Regex parser for @mentions to render highlighted blue pills**
- [x] **Step 2: Render rich card for `attachedDocMetadata` (number, title, files, View/Copy buttons)**
- [x] **Step 3: Implement Actions Menu `...` on message hover:**
  - "Gắn vào công việc này" (`onLinkToTask`)
  - "Lưu vào hồ sơ này" (`onLinkToDossier`)
  - "Gắn tệp vào văn bản có sẵn" (`onAttachFileToDoc`)
  - "Tạo văn bản mới từ tin nhắn" (`onCreateDocFromMessage`)
  - "Xóa tin nhắn" (`onDelete`)
- [x] **Step 4: Verify types & commit**

---

### Task 5: Integrate into Task Chat (`TaskCommentThread.tsx`) & `TaskDetail.tsx`

**Files:**
- Modify: `components/tasks/TaskCommentThread.tsx`
- Modify: `components/tasks/TaskDetail.tsx`

- [x] **Step 1: Refactor `TaskCommentThread.tsx` to use `MentionTextarea` and `ChatMessageBubble`**
- [x] **Step 2: Implement `onLinkToTask` to add document to `task.documentIds` via `updateTask`**
- [x] **Step 3: Add "Gửi vào chat" action buttons on linked documents list in `TaskDetail.tsx`**
- [x] **Step 4: Verify types & commit**

---

### Task 6: Integrate into Dossier Chat (`DossierPanel.tsx`)

**Files:**
- Modify: `components/dossiers/DossierPanel.tsx`

- [x] **Step 1: Refactor Frame 4 in `DossierPanel.tsx` to use `MentionTextarea` and `ChatMessageBubble`**
- [x] **Step 2: Implement `onLinkToDossier` to add document to dossier via `toggleDocumentDossier`**
- [x] **Step 3: Add "Gửi vào chat" action button on dossier documents table**
- [x] **Step 4: Verify types & commit**

---

### Task 7: Comprehensive Verification & Deploy

- [x] **Step 1: Run `npx tsc --noEmit` and `npm run build`**
- [ ] **Step 2: Push to GitHub `main` branch**
- [ ] **Step 3: Deploy to Vercel Production (`vercel --prod --yes`)**
