import { Node, mergeAttributes, InputRule } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ToggleBlockView } from '../../ui/ToggleBlockView'

/** Focus the .tgl__title inside the toggle node at `pos` after the next paint. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scheduleTitleFocus(view: any, pos: number) {
  requestAnimationFrame(() => {
    const dom = view.nodeDOM(pos) as HTMLElement | null
    const titleEl = dom?.querySelector?.('.tgl__title') as HTMLElement | null
    if (!titleEl) return
    titleEl.focus()
    // Place caret at the end
    const range = document.createRange()
    range.selectNodeContents(titleEl)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  })
}

export const ToggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  /**
   * Priority 200 > StarterKit's 100.
   * This ensures our Space and Enter keyboard shortcuts are checked
   * before StarterKit's blockquote input-rule / paragraph-split handlers.
   */
  priority: 200,

  addAttributes() {
    return {
      open:  { default: true },
      title: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggleBlock"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggleBlock' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleBlockView)
  },

  /**
   * Input rule: "> " (greater-than + space) at the start of a blank paragraph
   * → toggle block.
   *
   * This fires through ProseMirror's input-rule plugin, which runs with the
   * priority of the extension that registered it (200 here, vs. StarterKit's
   * 100 for the blockquote rule).  Because we have higher priority, our rule
   * is evaluated first; once we match and modify the transaction the blockquote
   * rule never sees the same text.
   *
   * The keyboard shortcut below is a complementary fast-path that intercepts
   * the Space keydown BEFORE the character is inserted — belt-and-suspenders.
   */
  addInputRules() {
    const type = this.type
    const getView = () => this.editor.view
    return [
      new InputRule({
        find: /^> $/,
        handler({ state, range }) {
          const { tr } = state
          const $from = state.doc.resolve(range.from)
          // Only convert plain paragraphs — leave blockquotes, list-items, etc. alone
          if ($from.parent.type.name !== 'paragraph') return
          const nodeStart = $from.before($from.depth)
          const nodeEnd   = $from.after($from.depth)
          const node = type.createAndFill({ open: true, title: '' })
          if (!node) return
          tr.replaceWith(nodeStart, nodeEnd, node)
          // Keep PM cursor inside the toggle body (fallback)
          const bodyPos = nodeStart + 2
          if (bodyPos <= tr.doc.content.size) {
            tr.setSelection(TextSelection.near(tr.doc.resolve(bodyPos)))
          }
          // Focus the title after the DOM updates
          scheduleTitleFocus(getView(), nodeStart)
        },
      }),
    ]
  },

  addKeyboardShortcuts() {
    /** Replace the current paragraph with a toggleBlock and focus its title. */
    const createToggle = (title: string): boolean => {
      const { state } = this.editor
      const { $from }  = state.selection
      if ($from.parent.type.name !== 'paragraph') return false

      const nodeStart = $from.before($from.depth)
      const ok = this.editor.commands.command(({ tr }) => {
        tr.replaceWith(
          nodeStart,
          nodeStart + $from.parent.nodeSize,
          this.type.create(
            { open: true, title },
            state.schema.nodes.paragraph.create(),
          ),
        )
        return true
      })

      if (ok) scheduleTitleFocus(this.editor.view, nodeStart)
      return ok
    }

    return {
      /**
       * Backspace at the very start of an empty toggle body → delete the
       * whole toggleBlock and leave an empty paragraph in its place.
       *
       * Without this, `isolating: true` prevents the cursor from ever
       * crossing the toggle boundary, so users would be stuck inside.
       */
      Backspace: () => {
        const { state } = this.editor
        const { $from, empty } = state.selection
        if (!empty) return false

        // Walk up to see if we're inside a toggleBlock
        let tDepth = -1
        for (let d = $from.depth; d >= 1; d--) {
          if ($from.node(d).type === this.type) { tDepth = d; break }
        }
        if (tDepth < 0) return false

        // Cursor must be at the very start of the toggle's body content.
        // ProseMirror layout: tStart(open) | para(open) | ...content... | para(close) | tEnd(close)
        // So "start of first para content" = tStart + 2
        const tStart = $from.before(tDepth)
        if ($from.pos !== tStart + 2) return false

        // Only delete the toggle when the body is a single empty paragraph
        const tNode = $from.node(tDepth)
        if (tNode.childCount !== 1 || tNode.firstChild!.content.size !== 0) return false

        const tEnd = $from.after(tDepth)
        return this.editor.commands.command(({ tr }) => {
          tr.replaceWith(tStart, tEnd, state.schema.nodes.paragraph.create())
          tr.setSelection(TextSelection.near(tr.doc.resolve(tStart + 1)))
          return true
        })
      },

      /**
       * "> " (space) → toggle block.
       *
       * Intercepting Space here prevents the text "> " from ever reaching
       * StarterKit's blockquote input rule, so "> " no longer creates a
       * blockquote — it creates a toggle instead.
       */
      Space: () => {
        const { $from } = this.editor.state.selection
        if ($from.parent.type.name !== 'paragraph') return false
        // Only act when the paragraph contains exactly ">"
        if ($from.parent.textContent !== '>') return false
        return createToggle('')
      },

      /**
       * "> text" + Enter → toggle block with "text" as the title.
       * Just ">" + Enter also works (empty title).
       */
      Enter: () => {
        const { $from } = this.editor.state.selection
        if ($from.parent.type.name !== 'paragraph') return false
        const text = $from.parent.textContent
        if (!/^>/.test(text)) return false
        const title = text.replace(/^>\s*/, '').trim()
        return createToggle(title)
      },
    }
  },
})
