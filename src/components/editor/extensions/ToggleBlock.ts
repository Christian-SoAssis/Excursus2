import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ToggleBlockView } from '../../ui/ToggleBlockView'

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

  addKeyboardShortcuts() {
    /** Replace the current paragraph with a toggleBlock. */
    const createToggle = (title: string): boolean => {
      const { state } = this.editor
      const { $from }  = state.selection
      if ($from.parent.type.name !== 'paragraph') return false

      const nodeStart = $from.before($from.depth)
      return this.editor.commands.command(({ tr }) => {
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
    }

    return {
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
