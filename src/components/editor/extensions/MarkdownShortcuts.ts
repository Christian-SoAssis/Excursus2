import { Extension } from '@tiptap/core'
import { wrappingInputRule } from '@tiptap/core'

// Adds two extra markdown shortcuts not covered by StarterKit:
//   ". " at line start  → bullet list  (complement to "- " and "* ")
//   '"  '  at line start → blockquote   (complement to "> ")
export const MarkdownShortcuts = Extension.create({
  name: 'markdownShortcuts',

  addInputRules() {
    const { schema } = this.editor
    const rules = []

    if (schema.nodes.bulletList) {
      rules.push(wrappingInputRule({
        find: /^\.\s$/,
        type: schema.nodes.bulletList,
      }))
    }

    if (schema.nodes.blockquote) {
      rules.push(wrappingInputRule({
        find: /^"\s$/,
        type: schema.nodes.blockquote,
      }))
    }

    return rules
  },
})
