import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { BacklinkExtension } from '../BacklinkExtension'

function makeEditor(content?: object) {
  return new Editor({
    extensions: [StarterKit, BacklinkExtension],
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
  })
}

describe('BacklinkExtension', () => {
  it('serializes backlink node with noteId and title', () => {
    const editor = makeEditor({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'backlink', attrs: { noteId: 'n1', title: 'My Note' } }],
      }],
    })
    const node = editor.getJSON().content![0].content![0]
    expect(node.type).toBe('backlink')
    expect(node.attrs?.noteId).toBe('n1')
    expect(node.attrs?.title).toBe('My Note')
    editor.destroy()
  })

  it('inserts backlink node via insertContent', () => {
    const editor = makeEditor()
    editor.commands.insertContent({ type: 'backlink', attrs: { noteId: 'n2', title: 'Other' } })
    const node = editor.getJSON().content![0].content![0]
    expect(node.type).toBe('backlink')
    expect(node.attrs?.noteId).toBe('n2')
    editor.destroy()
  })
})
