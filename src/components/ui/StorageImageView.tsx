import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useEffect, useState } from 'react'
import { refreshStorageUrl } from '../../lib/storage'

/**
 * NodeView for the StorageImage extension.
 *
 * If the node carries a `path` attribute (set when the image was uploaded via
 * the editor), a fresh signed URL is generated on mount so the image loads
 * correctly even with a private Supabase Storage bucket or an expired URL.
 */
export function StorageImageView({ node }: NodeViewProps) {
  const { src, alt, title, path } = node.attrs as {
    src: string
    alt?: string
    title?: string
    path?: string
  }

  const [resolvedSrc, setResolvedSrc] = useState(src)

  useEffect(() => {
    if (!path) return
    refreshStorageUrl(path).then(url => { if (url) setResolvedSrc(url) })
  }, [path])

  return (
    <NodeViewWrapper as="span" style={{ display: 'contents' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolvedSrc}
        alt={alt ?? ''}
        title={title ?? undefined}
        style={{ maxWidth: '100%', display: 'block' }}
        draggable={false}
      />
    </NodeViewWrapper>
  )
}
