/**
 * StorageImage — extends TipTap's Image extension with a `path` attribute.
 *
 * When the storage path is available, the NodeView resolves a fresh signed URL
 * on mount so images remain visible regardless of whether the Supabase Storage
 * bucket is public or private and whether the original URL has expired.
 */
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { StorageImageView } from '../../ui/StorageImageView'

export const StorageImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      /** Storage path for signed-URL renewal — empty on images inserted before this feature */
      path: { default: '' },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(StorageImageView)
  },
})
