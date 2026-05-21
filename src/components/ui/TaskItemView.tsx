import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

export function TaskItemView({ node, updateAttributes, editor }: NodeViewProps) {
  const checked = node.attrs.checked as boolean

  const toggle = () => {
    if (editor.isEditable) updateAttributes({ checked: !checked })
  }

  return (
    <NodeViewWrapper
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '3px 0',
      }}
    >
      {/* Checkbox — fully controlled by React, no native input */}
      <span
        contentEditable={false}
        role="checkbox"
        aria-checked={checked}
        onClick={toggle}
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 16,
          height: 16,
          marginTop: 4,
          borderRadius: 4,
          border: checked
            ? '1.5px solid var(--accent-emerald)'
            : '1.5px solid var(--border-strong)',
          background: checked ? 'var(--accent-emerald)' : 'transparent',
          cursor: 'pointer',
          transition: 'background 0.15s, border-color 0.15s',
          userSelect: 'none',
        }}
      >
        {checked && (
          <svg viewBox="0 0 10 10" fill="none" style={{ width: 10, height: 10 }}>
            <polyline
              points="1.5,5.5 4,8 8.5,2"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>

      {/* Editable text content */}
      <NodeViewContent
        style={{
          flex: 1,
          minWidth: 0,
          ...(checked
            ? { color: 'var(--text-muted)', textDecoration: 'line-through' }
            : {}),
        }}
      />
    </NodeViewWrapper>
  )
}
