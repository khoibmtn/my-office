'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor, useEditorState, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Bold, Italic, List, ListOrdered, ImagePlus, AlertCircle, X } from 'lucide-react'
import { RedMark } from './extensions/red-mark'
import {
  createPasteImageExtension,
  uploadFilesIntoEditor,
  type UploadImageHandler,
} from './extensions/paste-image'
import type { RichSectionKey } from '@/types/weekly-report'

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export const RICH_CONTENT_PROSE_CLASSES =
  'text-base leading-relaxed text-slate-900 break-words [&_p]:my-1.5 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:my-1.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-1.5 [&_li]:my-0.5 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-2 [&_a]:text-blue-600 [&_a]:underline'

export function parseTiptapDoc(value: string | null | undefined): JSONContent {
  if (!value || !value.trim()) return EMPTY_DOC
  try {
    const parsed = JSON.parse(value) as JSONContent
    if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
      return parsed
    }
  } catch {
    // Fallback for plain text legacy values
    return {
      type: 'doc',
      content: value
        .split(/\r?\n/)
        .map((line) =>
          line.trim()
            ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
            : { type: 'paragraph' },
        ),
    }
  }
  return EMPTY_DOC
}

export interface RichEditorProps {
  value: string | null
  onChange: (json: string, plain: string) => void
  weekId: string
  section: RichSectionKey
  editable?: boolean
  placeholder?: string
  uploadImageFn?: UploadImageHandler
}

export function RichEditor({
  value,
  onChange,
  weekId,
  section,
  editable = true,
  placeholder = 'Nhập nội dung… (có thể dán hoặc kéo thả ảnh trực tiếp)',
  uploadImageFn,
}: RichEditorProps) {
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isEmpty, setIsEmpty] = useState(() => !value)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const weekIdRef = useRef(weekId)
  weekIdRef.current = weekId
  const sectionRef = useRef(section)
  sectionRef.current = section
  const uploadFnRef = useRef<UploadImageHandler | undefined>(uploadImageFn)
  uploadFnRef.current = uploadImageFn
  const onErrorRef = useRef<((msg: string) => void) | undefined>(setUploadError)
  onErrorRef.current = setUploadError

  const lastEmittedJsonRef = useRef<string | null>(value)
  const prevWeekIdRef = useRef<string>(weekId)

  const pasteExtension = useMemo(
    () =>
      createPasteImageExtension({
        weekIdRef,
        sectionRef,
        uploadFnRef,
        onErrorRef,
      }),
    [],
  )

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit,
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg border border-slate-200',
        },
      }),
      RedMark,
      pasteExtension,
    ],
    content: parseTiptapDoc(value),
    editorProps: {
      attributes: {
        class: `${RICH_CONTENT_PROSE_CLASSES} min-h-[120px] p-3 focus:outline-none`,
      },
    },
    onCreate({ editor: ed }) {
      const jsonStr = JSON.stringify(ed.getJSON())
      lastEmittedJsonRef.current = value ?? jsonStr
      setIsEmpty(ed.isEmpty)
    },
    onUpdate({ editor: ed }) {
      const jsonStr = JSON.stringify(ed.getJSON())
      const plain = ed.getText({ blockSeparator: '\n' }).trim()
      lastEmittedJsonRef.current = jsonStr
      setIsEmpty(ed.isEmpty)
      onChangeRef.current(jsonStr, plain)
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

  useEffect(() => {
    if (!editor) return
    const weekChanged = prevWeekIdRef.current !== weekId
    prevWeekIdRef.current = weekId

    if (weekChanged || (value !== lastEmittedJsonRef.current && !editor.isFocused)) {
      const doc = parseTiptapDoc(value)
      editor.commands.setContent(doc, { emitUpdate: false })
      lastEmittedJsonRef.current = value
      setIsEmpty(editor.isEmpty)
    }
  }, [editor, value, weekId])

  const activeState = useEditorState({
    editor,
    selector: (ctx) => {
      const ed = ctx.editor
      if (!ed) {
        return {
          bold: false,
          italic: false,
          red: false,
          bulletList: false,
          orderedList: false,
        }
      }
      return {
        bold: ed.isActive('bold'),
        italic: ed.isActive('italic'),
        red: ed.isActive('red'),
        bulletList: ed.isActive('bulletList'),
        orderedList: ed.isActive('orderedList'),
      }
    },
  })

  const sizeWarn = Boolean(value && value.length > 200_000)

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {editable && (
        <div
          role="toolbar"
          aria-label="Thanh công cụ định dạng"
          className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5"
        >
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            aria-pressed={activeState?.bold ?? false}
            title="In đậm (Ctrl/⌘+B)"
            aria-label="In đậm"
            className={`inline-flex items-center justify-center rounded-md min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] px-2 text-sm font-semibold transition-colors ${
              activeState?.bold
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Bold className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            aria-pressed={activeState?.italic ?? false}
            title="In nghiêng (Ctrl/⌘+I)"
            aria-label="In nghiêng"
            className={`inline-flex items-center justify-center rounded-md min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] px-2 text-sm transition-colors ${
              activeState?.italic
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Italic className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleRed().run()}
            aria-pressed={activeState?.red ?? false}
            title="Tô đỏ đậm (Ctrl/⌘+Shift+H)"
            aria-label="Tô đỏ đậm"
            className={`inline-flex items-center justify-center rounded-md min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] px-2.5 text-base font-bold transition-colors ${
              activeState?.red
                ? 'bg-red-700 text-white'
                : 'text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200'
            }`}
          >
            Đỏ
          </button>

          <div className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            aria-pressed={activeState?.bulletList ?? false}
            title="Danh sách gạch đầu dòng"
            aria-label="Danh sách gạch đầu dòng"
            className={`inline-flex items-center justify-center rounded-md min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] px-2 transition-colors ${
              activeState?.bulletList
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            <List className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            aria-pressed={activeState?.orderedList ?? false}
            title="Danh sách đánh số"
            aria-label="Danh sách đánh số"
            className={`inline-flex items-center justify-center rounded-md min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] px-2 transition-colors ${
              activeState?.orderedList
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ListOrdered className="h-4 w-4" />
          </button>

          <div className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Chèn ảnh từ máy"
            aria-label="Chèn ảnh"
            className="inline-flex items-center gap-1.5 rounded-md min-h-[44px] sm:min-h-[36px] px-3 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <ImagePlus className="h-4 w-4" />
            <span>Chèn ảnh</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files
              if (files && files.length > 0 && editor) {
                uploadFilesIntoEditor(editor, files, {
                  weekIdRef,
                  sectionRef,
                  uploadFnRef,
                  onErrorRef,
                })
              }
              e.target.value = ''
            }}
          />
        </div>
      )}

      {uploadError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-base text-red-800"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            aria-label="Đóng thông báo lỗi"
            className="tap rounded-md text-red-700 hover:bg-red-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {sizeWarn && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
          Mục này đang có dung lượng văn bản khá lớn (&gt; 200 KB). Nên giữ nội dung súc tích để tải nhanh.
        </div>
      )}

      <div className="relative">
        {isEmpty && editable && (
          <div className="pointer-events-none absolute left-3 top-3 text-base text-slate-400 select-none">
            {placeholder}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
