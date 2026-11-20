// Turn the previous week's "3. Tuần tới" rich text into Mục 1 work-item lines.
// One line per paragraph / list item (hard breaks split lines too); nested list items
// become children of their parent item. Red-marked text keeps the highlight.

export interface NextWeekLine {
  text: string
  highlight: boolean
  children: Array<{ text: string; highlight: boolean }>
}

interface Node {
  type?: string
  text?: string
  marks?: Array<{ type?: string }>
  content?: Node[]
}

const LIST_TYPES = new Set(['bulletList', 'orderedList'])

/** Split an inline block (paragraph/heading) into lines at hard breaks. */
function inlineLines(block: Node): Array<{ text: string; highlight: boolean }> {
  const out: Array<{ text: string; highlight: boolean }> = []
  let text = ''
  let red = false
  const push = () => {
    const t = text.replace(/\s+/g, ' ').trim()
    if (t) out.push({ text: t, highlight: red })
    text = ''
    red = false
  }
  for (const n of block.content ?? []) {
    if (n.type === 'hardBreak') { push(); continue }
    if (n.type === 'text' && n.text) {
      text += n.text
      if (n.marks?.some((m) => m.type === 'red')) red = true
    }
  }
  push()
  return out
}

function collectListItems(list: Node, depth: number, out: NextWeekLine[]): void {
  for (const li of list.content ?? []) {
    if (li.type !== 'listItem') continue
    for (const child of li.content ?? []) {
      if (LIST_TYPES.has(child.type ?? '')) {
        collectListItems(child, depth + 1, out)
        continue
      }
      for (const line of inlineLines(child)) {
        const parent = out[out.length - 1]
        if (depth > 0 && parent) parent.children.push(line)
        else out.push({ ...line, children: [] })
      }
    }
  }
}

export function nextWeekLines(docJson: string | null | undefined): NextWeekLine[] {
  if (!docJson) return []
  let doc: Node
  try {
    doc = JSON.parse(docJson) as Node
  } catch {
    return docJson
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text) => ({ text, highlight: false, children: [] }))
  }
  const out: NextWeekLine[] = []
  for (const block of doc.content ?? []) {
    if (LIST_TYPES.has(block.type ?? '')) collectListItems(block, 0, out)
    else if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'blockquote') {
      const blocks = block.type === 'blockquote' ? block.content ?? [] : [block]
      for (const b of blocks) for (const line of inlineLines(b)) out.push({ ...line, children: [] })
    }
  }
  return out
}

/** Normalised key used to skip lines already present in Mục 1. */
export function lineKey(text: string): string {
  return text.toLowerCase().replace(/^[-•*+\d.)\s]+/, '').replace(/\s+/g, ' ').trim()
}
