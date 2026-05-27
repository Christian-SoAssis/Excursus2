import type { JSONContent } from '@tiptap/react'

// ── Mark application ─────────────────────────────────────────────

function applyMarks(text: string, marks: JSONContent['marks']): string {
  if (!marks || marks.length === 0) return text
  let out = text
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':   out = `**${out}**`; break
      case 'italic': out = `_${out}_`;   break
      case 'code':   out = `\`${out}\``; break
      case 'strike': out = `~~${out}~~`; break
      // underline has no Markdown equivalent — keep as-is
    }
  }
  return out
}

// ── Inline content ───────────────────────────────────────────────

function inlinesToMd(nodes: JSONContent[]): string {
  return nodes.map(n => {
    if (n.type === 'text')      return applyMarks(n.text ?? '', n.marks)
    if (n.type === 'hardBreak') return '  \n'   // trailing spaces = MD line break
    if (n.type === 'backlink')  return `[[${n.attrs?.title ?? ''}]]`
    // Fallback: recurse into children
    if (n.content)              return inlinesToMd(n.content)
    return ''
  }).join('')
}

// ── Extract inline text from a block node (for list items, table cells) ─────

function blockToInline(node: JSONContent): string {
  if (node.type === 'paragraph') return inlinesToMd(node.content ?? [])
  if (node.content)              return node.content.map(blockToInline).join(' ')
  return ''
}

// ── Block renderer ───────────────────────────────────────────────

function nodeToMd(node: JSONContent, ctx: { listPrefix?: string } = {}): string {
  const ch = node.content ?? []

  switch (node.type) {
    case 'doc':
      return ch.map(c => nodeToMd(c)).join('')

    case 'paragraph':
      if (!ch.length) return '\n'
      return inlinesToMd(ch) + '\n\n'

    case 'heading': {
      const level  = (node.attrs?.level ?? 1) as number
      const hashes = '#'.repeat(Math.min(level, 6))
      return `${hashes} ${inlinesToMd(ch)}\n\n`
    }

    case 'bulletList':
      return ch.map(c => nodeToMd(c, { listPrefix: '- ' })).join('') + '\n'

    case 'orderedList':
      return ch.map((c, i) => nodeToMd(c, { listPrefix: `${i + 1}. ` })).join('') + '\n'

    case 'listItem': {
      const prefix = ctx.listPrefix ?? '- '
      // First child is usually a paragraph; the rest can be nested lists
      const [first, ...rest] = ch
      const firstText = first ? blockToInline(first) : ''
      const nested    = rest.map(r => {
        const inner = nodeToMd(r).trimEnd()
        return inner.split('\n').map(l => `  ${l}`).join('\n')
      }).join('\n')
      return `${prefix}${firstText}${nested ? '\n' + nested : ''}\n`
    }

    case 'taskList':
      return ch.map(c => nodeToMd(c)).join('') + '\n'

    case 'taskItem': {
      const checked = node.attrs?.checked ? 'x' : ' '
      const text    = ch.map(blockToInline).join(' ').trim()
      return `- [${checked}] ${text}\n`
    }

    case 'blockquote': {
      const inner = ch.map(c => nodeToMd(c)).join('').trimEnd()
      return inner.split('\n').map(l => `> ${l}`).join('\n') + '\n\n'
    }

    case 'codeBlock': {
      const lang = node.attrs?.language ?? ''
      const code = ch.map(c => c.text ?? '').join('')
      return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`
    }

    case 'horizontalRule':
      return '---\n\n'

    case 'table': {
      // ch → tableRow[]  →  tableCell[] | tableHeader[]
      if (!ch.length) return ''
      const rows = ch.map(row =>
        (row.content ?? []).map(cell => blockToInline(cell.content?.[0] ?? cell))
      )
      const [header, ...body] = rows
      const sep = header.map(() => '---')
      const fmt = (cols: string[]) => `| ${cols.join(' | ')} |`
      return [fmt(header), fmt(sep), ...body.map(fmt)].join('\n') + '\n\n'
    }

    // ── Custom extensions ─────────────────────────────────────────
    case 'mathBlock': {
      const src = node.attrs?.src ?? ''
      return `$$\n${src}\n$$\n\n`
    }

    case 'calloutBlock': {
      const inner = ch.map(c => nodeToMd(c)).join('').trimEnd()
      return inner.split('\n').map(l => `> ${l}`).join('\n') + '\n\n'
    }

    case 'toggleBlock': {
      const title = node.attrs?.title ?? ''
      const inner = ch.map(c => nodeToMd(c)).join('')
      return `#### ${title}\n\n${inner}`
    }

    case 'pdfBlock': {
      const src  = node.attrs?.src  ?? ''
      const name = node.attrs?.name ?? 'documento.pdf'
      return `[📎 ${name}](${src})\n\n`
    }

    default:
      // Generic fallback: recurse into children
      if (ch.length) return ch.map(c => nodeToMd(c)).join('')
      return ''
  }
}

// ── Public API ───────────────────────────────────────────────────

/** Convert a note's TipTap JSON document to a Markdown string. */
export function jsonToMarkdown(title: string, doc: JSONContent | undefined): string {
  const body = doc ? nodeToMd(doc) : ''
  return `# ${title}\n\n${body}`
}

/** Trigger a browser download of `content` as a `.md` file. */
export function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Sanitize a note title into a safe filename. */
export function titleToFilename(title: string): string {
  return title.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'nota'
}
