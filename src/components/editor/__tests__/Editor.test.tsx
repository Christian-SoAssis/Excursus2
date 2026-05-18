import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { Editor } from '../Editor'

vi.mock('../../../lib/db', () => ({
  getNoteContent: vi.fn().mockResolvedValue('{"type":"doc","content":[{"type":"paragraph"}]}'),
}))

vi.mock('../../../store/notes', () => ({
  useNotesStore: vi.fn(() => ({
    notes: [{ id: 'n1', title: 'Test', folder: 'inbox', posX: 0, posY: 0, posW: 360, wordCount: 0, createdAt: '', updatedAt: '' }],
    contentCache: {},
    saveNoteContent: vi.fn(),
    cacheContent: vi.fn(),
  })),
}))

describe('Editor', () => {
  it('renders without crashing for a given noteId', async () => {
    let container!: HTMLElement
    await act(async () => {
      const result = render(<Editor noteId="n1" />)
      container = result.container
    })
    expect(container.querySelector('.ProseMirror')).toBeTruthy()
  })
})
