/**
 * Module-level singleton that holds a reference to the currently mounted
 * TipTap Editor instance.  Components that live outside the editor tree
 * (e.g. SuggestionsPanel) can call getActiveEditor() to manipulate the
 * editor programmatically without prop-drilling.
 */
import type { Editor } from '@tiptap/core'

let _active: Editor | null = null

export function registerEditor(editor: Editor | null) {
  _active = editor
}

export function getActiveEditor(): Editor | null {
  return _active
}
