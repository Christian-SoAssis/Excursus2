import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useNotesStore } from '../../store/notes'
import { useUIStore } from '../../store/ui'

export function BacklinkChip({ node }: NodeViewProps) {
  const setActiveNote = useNotesStore(s => s.setActiveNote)
  const setMode = useUIStore(s => s.setMode)

  const handleClick = () => {
    if (node.attrs.noteId) {
      setActiveNote(node.attrs.noteId)
      setMode('floating')
    }
  }

  return (
    <NodeViewWrapper as="span" className="backlink" contentEditable={false} onClick={handleClick}>
      {node.attrs.title || 'nota'}
    </NodeViewWrapper>
  )
}
