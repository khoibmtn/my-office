export interface TiptapMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  text?: string
  marks?: TiptapMark[]
  content?: TiptapNode[]
}

const RED_MARK_TYPES = new Set([
  'red',
  'redmark',
  'red-mark',
  'red_mark',
  'redhighlight',
  'highlight',
])

const TEXT_COLOR_MARK_TYPES = new Set(['textstyle', 'textcolor', 'color'])

const RED_HEX_RE = /#(ff0000|dc2626|ef4444|b91c1c|c00000|cc0000|e11d48)\b/i

export function isRedMark(mark: TiptapMark): boolean {
  if (!mark || typeof mark.type !== 'string') return false
  const type = mark.type.toLowerCase()
  if (RED_MARK_TYPES.has(type)) return true
  if (TEXT_COLOR_MARK_TYPES.has(type)) {
    const color = mark.attrs?.color
    if (typeof color === 'string') {
      const normalized = color.trim().toLowerCase()
      if (normalized.includes('red') || RED_HEX_RE.test(normalized)) return true
    }
  }
  return false
}

export function parseTiptapDoc(docJson: string): TiptapNode | null {
  if (!docJson || typeof docJson !== 'string') return null
  const trimmed = docJson.trim()
  if (!trimmed) return null
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const node = parsed as Partial<TiptapNode>
    if (typeof node.type !== 'string') return null
    return node as TiptapNode
  } catch {
    return null
  }
}

function renderInlineMarkdown(nodes: TiptapNode[] | undefined): string {
  if (!nodes || nodes.length === 0) return ''
  return nodes
    .map((node) => {
      if (node.type === 'text') {
        const raw = node.text ?? ''
        if (!raw) return ''
        if (!raw.trim()) return raw
        const marks = node.marks ?? []
        if (marks.length === 0) return raw

        const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw)
        const leading = match ? match[1] : ''
        const core = match ? match[2] : raw
        const trailing = match ? match[3] : ''

        let hasCode = false
        let hasBoldOrRed = false
        let hasItalic = false
        let hasStrike = false
        let linkHref: string | null = null

        for (const m of marks) {
          const mt = (m.type || '').toLowerCase()
          if (mt === 'code') hasCode = true
          else if (mt === 'bold' || mt === 'strong' || isRedMark(m)) hasBoldOrRed = true
          else if (mt === 'italic' || mt === 'em') hasItalic = true
          else if (mt === 'strike') hasStrike = true
          else if (mt === 'link' && typeof m.attrs?.href === 'string' && m.attrs.href.trim()) {
            linkHref = m.attrs.href.trim()
          }
        }

        let formatted = core
        if (hasCode) formatted = `\`${formatted}\``
        if (hasBoldOrRed && hasItalic) formatted = `***${formatted}***`
        else if (hasBoldOrRed) formatted = `**${formatted}**`
        else if (hasItalic) formatted = `*${formatted}*`
        if (hasStrike) formatted = `~~${formatted}~~`
        if (linkHref) formatted = `[${formatted}](${linkHref})`

        return `${leading}${formatted}${trailing}`
      }
      if (node.type === 'hardBreak') return '  \n'
      if (node.type === 'image') {
        const src = typeof node.attrs?.src === 'string' ? node.attrs.src.trim() : ''
        if (!src) return ''
        const alt =
          typeof node.attrs?.alt === 'string' && node.attrs.alt.trim()
            ? node.attrs.alt.trim()
            : 'ảnh'
        return `![${alt}](${src})`
      }
      if (node.content) return renderInlineMarkdown(node.content)
      return ''
    })
    .join('')
}

function renderInlinePlain(nodes: TiptapNode[] | undefined): string {
  if (!nodes || nodes.length === 0) return ''
  return nodes
    .map((node) => {
      if (node.type === 'text') return node.text ?? ''
      if (node.type === 'hardBreak') return '\n'
      if (node.type === 'image') {
        const src = typeof node.attrs?.src === 'string' ? node.attrs.src.trim() : ''
        return src ? '[ảnh]' : ''
      }
      if (node.content) return renderInlinePlain(node.content)
      return ''
    })
    .join('')
}

function renderList(
  node: TiptapNode,
  ordered: boolean,
  indent: number,
  plain: boolean,
): string {
  const items = (node.content ?? []).filter((c) => c.type === 'listItem')
  if (items.length === 0) return ''

  const startNum = Number(node.attrs?.start)
  const start = Number.isFinite(startNum) && startNum > 0 ? Math.floor(startNum) : 1
  const prefixPad = '  '.repeat(indent)
  const contPad = '  '.repeat(indent + 1)
  const lines: string[] = []

  items.forEach((item, idx) => {
    const marker = ordered ? `${start + idx}. ` : '- '
    const children = item.content ?? []
    let wroteFirst = false

    for (const child of children) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        if (!wroteFirst) {
          lines.push(`${prefixPad}${marker}`.trimEnd())
          wroteFirst = true
        }
        const nested = renderList(child, child.type === 'orderedList', indent + 1, plain)
        if (nested) lines.push(nested)
        continue
      }

      const rendered = plain
        ? renderBlockPlain(child, indent + 1)
        : renderBlockMarkdown(child, indent + 1)

      if (!rendered) continue
      const blockLines = rendered.split('\n')

      if (!wroteFirst) {
        lines.push(`${prefixPad}${marker}${blockLines[0]}`)
        for (let i = 1; i < blockLines.length; i++) {
          lines.push(blockLines[i] ? `${contPad}${blockLines[i]}` : '')
        }
        wroteFirst = true
      } else {
        for (const bl of blockLines) {
          lines.push(bl ? `${contPad}${bl}` : '')
        }
      }
    }

    if (!wroteFirst) {
      lines.push(`${prefixPad}${marker}`.trimEnd())
    }
  })

  return lines.join('\n')
}

function renderBlockMarkdown(node: TiptapNode, indent = 0): string {
  switch (node.type) {
    case 'doc': {
      const blocks = (node.content ?? [])
        .map((c) => renderBlockMarkdown(c, 0))
        .filter((b) => b !== '')
      return blocks.join('\n\n').trim()
    }
    case 'paragraph': {
      const text = renderInlineMarkdown(node.content).replace(/[ \t]+$/, '')
      return text.trim() === '' ? '' : text
    }
    case 'heading': {
      const rawLevel = Number(node.attrs?.level)
      const level = Number.isFinite(rawLevel) ? Math.min(6, Math.max(1, Math.floor(rawLevel))) : 2
      const text = renderInlineMarkdown(node.content).trim()
      if (!text) return ''
      return `${'#'.repeat(level)} ${text}`
    }
    case 'bulletList':
      return renderList(node, false, indent, false)
    case 'orderedList':
      return renderList(node, true, indent, false)
    case 'blockquote': {
      const inner = (node.content ?? [])
        .map((c) => renderBlockMarkdown(c, 0))
        .filter((b) => b !== '')
        .join('\n\n')
      if (!inner) return ''
      return inner
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n')
    }
    case 'codeBlock': {
      const code = renderInlinePlain(node.content)
      return `\`\`\`\n${code}\n\`\`\``
    }
    case 'horizontalRule':
      return '---'
    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src.trim() : ''
      if (!src) return ''
      const alt =
        typeof node.attrs?.alt === 'string' && node.attrs.alt.trim()
          ? node.attrs.alt.trim()
          : 'ảnh'
      return `![${alt}](${src})`
    }
    default: {
      if (node.content) {
        return (node.content ?? [])
          .map((c) => renderBlockMarkdown(c, indent))
          .filter((b) => b !== '')
          .join('\n\n')
      }
      if (typeof node.text === 'string') return node.text
      return ''
    }
  }
}

function renderBlockPlain(node: TiptapNode, indent = 0): string {
  switch (node.type) {
    case 'doc': {
      const blocks = (node.content ?? [])
        .map((c) => renderBlockPlain(c, 0))
        .filter((b) => b !== '')
      return blocks.join('\n').trim()
    }
    case 'paragraph':
    case 'heading': {
      const text = renderInlinePlain(node.content).replace(/[ \t]+$/, '')
      return text.trim() === '' ? '' : text.trim()
    }
    case 'bulletList':
      return renderList(node, false, indent, true)
    case 'orderedList':
      return renderList(node, true, indent, true)
    case 'blockquote':
    case 'codeBlock':
      return node.type === 'codeBlock'
        ? renderInlinePlain(node.content).trim()
        : (node.content ?? [])
            .map((c) => renderBlockPlain(c, 0))
            .filter((b) => b !== '')
            .join('\n')
    case 'horizontalRule':
      return '---'
    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src.trim() : ''
      return src ? '[ảnh]' : ''
    }
    default: {
      if (node.content) {
        return (node.content ?? [])
          .map((c) => renderBlockPlain(c, indent))
          .filter((b) => b !== '')
          .join('\n')
      }
      return node.text ?? ''
    }
  }
}

export function tiptapToMarkdown(docJson: string): string {
  const doc = parseTiptapDoc(docJson)
  if (!doc) return ''
  return renderBlockMarkdown(doc, 0).trim()
}

export function tiptapToPlainText(docJson: string): string {
  const doc = parseTiptapDoc(docJson)
  if (!doc) return ''
  return renderBlockPlain(doc, 0).trim()
}
