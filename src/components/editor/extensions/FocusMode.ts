import { Extension } from '@tiptap/core'
import { Plugin } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const FocusMode = Extension.create({
  name: 'focusMode',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const { selection, doc } = state
            const decorations: Decoration[] = []
            doc.forEach((node, offset) => {
              const isActive =
                selection.anchor > offset &&
                selection.anchor < offset + node.nodeSize
              decorations.push(
                Decoration.node(offset, offset + node.nodeSize, {
                  class: isActive ? 'fm-active' : 'fm-inactive',
                })
              )
            })
            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})
