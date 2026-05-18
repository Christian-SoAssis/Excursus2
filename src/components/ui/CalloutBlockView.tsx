import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react'

export function CalloutBlockView(_: NodeViewProps) {
  return (
    <NodeViewWrapper className="callout">
      <div className="callout__icon">✦</div>
      <div style={{ flex: 1 }}>
        <NodeViewContent as="div" />
      </div>
    </NodeViewWrapper>
  )
}
