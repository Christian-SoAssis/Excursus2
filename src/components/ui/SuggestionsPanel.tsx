import { useEffect, useRef } from 'react'
import { useSuggestionsStore } from '../../store/suggestions'
import { getActiveEditor } from '../../lib/editorRegistry'

/* ── Score bar ─────────────────────────────────────────────────── */
function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const hue = Math.round(score * 40) // 0 → orange-ish, 1 → yellow-ish
  return (
    <div className="sg-score" title={`${pct}% de similaridade`}>
      <div
        className="sg-score__bar"
        style={{ width: `${pct}%`, background: `hsl(${25 + hue}, 80%, 60%)` }}
      />
      <span className="sg-score__label">{pct}%</span>
    </div>
  )
}

/* ── Main panel ─────────────────────────────────────────────────── */
export function SuggestionsPanel() {
  const { items, loading, visible, noResults, dismiss, dismissAll, hide, show, markLinked } =
    useSuggestionsStore()
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-hide after 12 s of no interaction
  useEffect(() => {
    if (!visible || items.length === 0) return
    autoHideRef.current = setTimeout(hide, 12_000)
    return () => { if (autoHideRef.current) clearTimeout(autoHideRef.current) }
  }, [visible, items.length])

  const resetTimer = () => {
    if (autoHideRef.current) clearTimeout(autoHideRef.current)
    autoHideRef.current = setTimeout(hide, 12_000)
  }

  const handleConnect = (targetId: string, targetTitle: string) => {
    const editor = getActiveEditor()
    if (editor) {
      const { state } = editor
      const { $from }  = state.selection

      // Find the end of the top-level block that contains the cursor.
      // depth 0 = doc, depth 1 = paragraph / heading / etc.
      const blockDepth  = Math.min(1, $from.depth)
      const endOfBlock  = blockDepth > 0
        ? $from.end(blockDepth)
        : state.doc.content.size - 2

      // Insert a new paragraph with the backlink right after the current block
      editor
        .chain()
        .focus()
        .insertContentAt(endOfBlock + 1, {
          type: 'paragraph',
          content: [{ type: 'backlink', attrs: { noteId: targetId, title: targetTitle } }],
        })
        .run()

      // Record the current word count so this note is suppressed until
      // 50 more words have been written in the active note
      const wc = editor.state.doc.textContent.trim().split(/\s+/).filter(Boolean).length
      markLinked(targetId, wc)
    }

    dismiss(targetId)
    resetTimer()
  }

  // Nothing to show
  if (items.length === 0 && !loading && !noResults) return null

  return (
    <div
      className="sg-panel"
      onMouseEnter={() => { if (autoHideRef.current) clearTimeout(autoHideRef.current) }}
      onMouseLeave={resetTimer}
    >
      {/* ── Collapsed pill ── */}
      {!visible && items.length > 0 && (
        <button className="sg-pill" onClick={show}>
          <span className="sg-pill__dot" />
          {items.length} conexão{items.length !== 1 ? 'ões' : ''} sugerida{items.length !== 1 ? 's' : ''}
          <span className="sg-pill__arrow">▲</span>
        </button>
      )}

      {/* ── Expanded panel ── */}
      {visible && (
        <div className="sg-body">
          <div className="sg-header">
            <div className="sg-header__left">
              <span className="sg-header__icon">◎</span>
              <span className="sg-header__title">Notas similares</span>
              {loading && <span className="sg-header__loading">…</span>}
            </div>
            <div className="sg-header__actions">
              <button className="sg-header__btn" onClick={dismissAll} title="Dispensar todas">
                Ignorar todas
              </button>
              <button className="sg-header__btn sg-header__btn--icon" onClick={hide} title="Recolher">
                ▼
              </button>
            </div>
          </div>

          {noResults && items.length === 0 && (
            <p className="sg-empty">Nenhuma nota similar encontrada para a seleção.</p>
          )}

          <ul className="sg-list">
            {items.map(item => (
              <li key={item.id} className="sg-item">
                <div className="sg-item__top">
                  <span className="sg-item__title" title={item.title}>
                    {item.title}
                  </span>
                  <button
                    className="sg-item__dismiss"
                    onClick={() => { dismiss(item.id); resetTimer() }}
                    aria-label="Ignorar sugestão"
                  >
                    ✕
                  </button>
                </div>
                <ScoreBar score={item.score} />
                <div className="sg-item__actions">
                  <button
                    className="sg-item__connect"
                    onClick={() => handleConnect(item.id, item.title)}
                    title={`Inserir backlink para "${item.title}" na linha abaixo do cursor`}
                  >
                    ⊕ Conectar
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <p className="sg-footer">
            Baseado em similaridade de conteúdo via pg_trgm
          </p>
        </div>
      )}
    </div>
  )
}
