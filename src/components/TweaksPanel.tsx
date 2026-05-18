import { useState } from 'react'
import { useUIStore, type Accent } from '../store/ui'

const ACCENTS: { value: Accent; label: string }[] = [
  { value: 'terracotta', label: 'Terracotta' },
  { value: 'amber',      label: 'Âmbar' },
  { value: 'electric',   label: 'Elétrico' },
  { value: 'emerald',    label: 'Esmeralda' },
]

export function TweaksPanel() {
  const { theme, accent, fontScale, showHandles, setTheme, setAccent, setFontScale, setShowHandles } = useUIStore()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        className="tweaks-trigger appbar__tab"
        style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 100 }}
        onClick={() => setOpen(o => !o)}
        title="Tweaks"
      >⚙</button>

      {open && (
        <div className="twk-panel" style={{ bottom: 56, right: 16 }}>
          <div className="twk-hd">
            <b>Tweaks</b>
            <button className="twk-x" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="twk-body">
            <div className="twk-sect">Aparência</div>
            <div className="twk-row twk-row-h">
              <div className="twk-lbl"><span>Tema</span></div>
              <div className="twk-seg">
                {(['dark', 'light'] as const).map(t => (
                  <button key={t} className={theme === t ? 'is-active' : ''} onClick={() => setTheme(t)}>
                    {t === 'dark' ? 'Clay' : 'Archive'}
                  </button>
                ))}
              </div>
            </div>
            <div className="twk-row">
              <div className="twk-lbl"><span>Acento</span></div>
              <select className="twk-field" value={accent} onChange={e => setAccent(e.target.value as Accent)}>
                {ACCENTS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="twk-row">
              <div className="twk-lbl"><span>Escala de fonte</span><span className="twk-val">{fontScale.toFixed(2)}</span></div>
              <input type="range" className="twk-slider" min={0.85} max={1.2} step={0.05}
                value={fontScale} onChange={e => setFontScale(Number(e.target.value))} />
            </div>
            <div className="twk-row twk-row-h">
              <div className="twk-lbl"><span>Drag handles</span></div>
              <button className="twk-toggle" data-on={showHandles ? '1' : '0'}
                onClick={() => setShowHandles(!showHandles)}><i /></button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
