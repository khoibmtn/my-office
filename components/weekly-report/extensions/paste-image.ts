import { Extension, type Editor } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import { uploadWeeklyReportImage } from '@/lib/weekly-report/image-client'
import type { RichSectionKey } from '@/types/weekly-report'

export type UploadImageHandler = (
  file: File,
  ctx: { weekId: string; section: RichSectionKey },
) => Promise<{ url: string; imageId: string }>

export interface PasteImageRefs {
  weekIdRef: { current: string }
  sectionRef: { current: RichSectionKey }
  uploadFnRef: { current: UploadImageHandler | undefined }
  onErrorRef: { current: ((message: string) => void) | undefined }
}

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
])

const MAX_GIF_BYTES = 4 * 1024 * 1024
const MAX_RAW_IMAGE_BYTES = 25 * 1024 * 1024

export const pasteImagePluginKey = new PluginKey<DecorationSet>('weeklyReportPasteImage')

type PlaceholderMeta =
  | { add: { id: string; pos: number } }
  | { remove: { id: string } }

function findPlaceholderPos(state: EditorView['state'], id: string): number | null {
  const decos = pasteImagePluginKey.getState(state)
  if (!decos) return null
  const found = decos.find(undefined, undefined, (spec) => spec?.id === id)
  return found.length > 0 ? found[0].from : null
}

function createPlaceholderNode(): HTMLElement {
  const box = document.createElement('span')
  box.className =
    'inline-flex items-center gap-2 rounded-md border border-dashed border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 my-1 select-none'
  box.setAttribute('contenteditable', 'false')

  const spinner = document.createElement('span')
  spinner.className =
    'inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent'

  const label = document.createElement('span')
  label.textContent = 'Đang tải ảnh lên…'

  box.appendChild(spinner)
  box.appendChild(label)
  return box
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return 'Chỉ nhận ảnh định dạng PNG, JPEG, WebP hoặc GIF.'
  }
  if (file.type === 'image/gif' && file.size > MAX_GIF_BYTES) {
    return 'Ảnh GIF vượt quá 4 MB. Vui lòng chọn ảnh nhỏ hơn.'
  }
  if (file.size > MAX_RAW_IMAGE_BYTES) {
    return 'Ảnh vượt quá giới hạn dung lượng (tối đa 4 MB sau nén). Vui lòng chọn ảnh nhỏ hơn.'
  }
  return null
}

function makeUploadId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function processImageFile(
  view: EditorView,
  file: File,
  pos: number,
  refs: PasteImageRefs,
): Promise<void> {
  const validationError = validateImageFile(file)
  if (validationError) {
    refs.onErrorRef.current?.(validationError)
    return
  }

  const id = makeUploadId()
  const addMeta: PlaceholderMeta = { add: { id, pos } }
  view.dispatch(view.state.tr.setMeta(pasteImagePluginKey, addMeta))

  const uploadFn = refs.uploadFnRef.current ?? uploadWeeklyReportImage
  try {
    const result = await uploadFn(file, {
      weekId: refs.weekIdRef.current,
      section: refs.sectionRef.current,
    })

    if (view.isDestroyed) return

    const currentPos = findPlaceholderPos(view.state, id)
    if (currentPos === null) return

    const imageNodeType = view.state.schema.nodes.image
    const tr = view.state.tr
    if (imageNodeType) {
      const node = imageNodeType.create({
        src: result.url,
        alt: file.name || 'Ảnh đính kèm',
      })
      tr.insert(currentPos, node)
    }
    const removeMeta: PlaceholderMeta = { remove: { id } }
    tr.setMeta(pasteImagePluginKey, removeMeta)
    view.dispatch(tr)
  } catch (err) {
    if (!view.isDestroyed) {
      const removeMeta: PlaceholderMeta = { remove: { id } }
      view.dispatch(view.state.tr.setMeta(pasteImagePluginKey, removeMeta))
    }
    const msg =
      err instanceof Error && err.message
        ? err.message
        : 'Tải ảnh thất bại. Vui lòng thử lại.'
    refs.onErrorRef.current?.(msg)
  }
}

function extractFiles(dataTransfer: DataTransfer | null): File[] {
  if (!dataTransfer) return []
  if (dataTransfer.files && dataTransfer.files.length > 0) {
    return Array.from(dataTransfer.files)
  }
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    const files: File[] = []
    for (const item of Array.from(dataTransfer.items)) {
      if (item.kind === 'file') {
        const f = item.getAsFile()
        if (f) files.push(f)
      }
    }
    return files
  }
  return []
}

/**
 * Upload selected files into an active Tiptap editor (used by toolbar file picker).
 */
export function uploadFilesIntoEditor(
  editor: Editor,
  files: FileList | File[],
  refs: PasteImageRefs,
): void {
  const list = Array.from(files)
  if (list.length === 0 || editor.isDestroyed) return
  const pos = editor.state.selection.from
  for (const file of list) {
    void processImageFile(editor.view, file, pos, refs)
  }
}

export function createPasteImageExtension(refs: PasteImageRefs) {
  return Extension.create({
    name: 'weeklyReportPasteImage',

    addProseMirrorPlugins() {
      return [
        new Plugin<DecorationSet>({
          key: pasteImagePluginKey,
          state: {
            init() {
              return DecorationSet.empty
            },
            apply(tr, set) {
              let nextSet = set.map(tr.mapping, tr.doc)
              const action = tr.getMeta(pasteImagePluginKey) as PlaceholderMeta | undefined
              if (action && 'add' in action) {
                const { id, pos } = action.add
                const clampedPos = Math.max(0, Math.min(pos, tr.doc.content.size))
                const deco = Decoration.widget(clampedPos, createPlaceholderNode, { id })
                nextSet = nextSet.add(tr.doc, [deco])
              } else if (action && 'remove' in action) {
                const targetId = action.remove.id
                nextSet = nextSet.remove(
                  nextSet.find(undefined, undefined, (spec) => spec?.id === targetId),
                )
              }
              return nextSet
            },
          },
          props: {
            decorations(state) {
              return pasteImagePluginKey.getState(state) ?? DecorationSet.empty
            },
            handlePaste(view, event) {
              if (!view.editable) return false
              const files = extractFiles(event.clipboardData)
              if (files.length === 0) return false

              event.preventDefault()
              const pos = view.state.selection.from
              for (const file of files) {
                void processImageFile(view, file, pos, refs)
              }
              return true
            },
            handleDrop(view, event, _slice, moved) {
              if (!view.editable || moved) return false
              const files = extractFiles(event.dataTransfer)
              if (files.length === 0) return false

              event.preventDefault()
              const coords = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              })
              const pos = coords ? coords.pos : view.state.selection.from
              for (const file of files) {
                void processImageFile(view, file, pos, refs)
              }
              return true
            },
          },
        }),
      ]
    },
  })
}
