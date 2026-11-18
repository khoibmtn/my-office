'use client'

import React, { useEffect } from 'react'
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { RedMark } from './extensions/red-mark'
import { parseTiptapDoc, RICH_CONTENT_PROSE_CLASSES } from './RichEditor'

function hasNonEmptyNode(node: JSONContent | undefined): boolean {
  if (!node) return false
  if (node.type === 'image') return Boolean(node.attrs?.src)
  if (typeof node.text === 'string' && node.text.trim().length > 0) return true
  if (Array.isArray(node.content)) {
    return node.content.some((child) => hasNonEmptyNode(child))
  }
  return false
}

/**
 * Checks whether a rich section has no visible text and no embedded images.
 * Sections containing only pasted images are treated as non-empty.
 */
export function isRichSectionEmpty(
  section: { docJson: string; plainText: string } | null | undefined,
): boolean {
  if (!section) return true
  if (section.plainText && section.plainText.trim().length > 0) return false
  if (!section.docJson || !section.docJson.trim()) return true
  try {
    const parsed = JSON.parse(section.docJson) as JSONContent
    return !hasNonEmptyNode(parsed)
  } catch {
    return true
  }
}

export interface RichViewerProps {
  value: string | null
  className?: string
}

/**
 * Read-only Tiptap viewer — renders structured JSON safely without dangerouslySetInnerHTML.
 */
export function RichViewer({ value, className }: RichViewerProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit,
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      RedMark,
    ],
    content: parseTiptapDoc(value),
    editorProps: {
      attributes: {
        class: className ? `${RICH_CONTENT_PROSE_CLASSES} ${className}` : RICH_CONTENT_PROSE_CLASSES,
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.commands.setContent(parseTiptapDoc(value), { emitUpdate: false })
  }, [editor, value])

  return <EditorContent editor={editor} />
}
