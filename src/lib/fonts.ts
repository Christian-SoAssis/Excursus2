/** Supported UI fonts for the interface (–-font-sans override). */
export type UIFont =
  | 'inter'
  | 'dm-sans'
  | 'newsreader'
  | 'playfair'
  | 'jetbrains-mono'

export interface FontMeta {
  label:       string
  family:      string   // CSS font-family value
  sample:      string   // preview sentence
  category:    'sans-serif' | 'serif' | 'monospace'
  googleFont?: string   // Google Fonts URL fragment (family + variants)
}

export const FONTS: Record<UIFont, FontMeta> = {
  'inter': {
    label:    'Inter',
    family:   'Inter, system-ui, sans-serif',
    sample:   'Clean e moderna',
    category: 'sans-serif',
    // Inter is a common system font — no remote load needed
  },
  'dm-sans': {
    label:      'DM Sans',
    family:     '"DM Sans", system-ui, sans-serif',
    sample:     'Geométrica suave',
    category:   'sans-serif',
    googleFont: 'DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700',
  },
  'newsreader': {
    label:      'Newsreader',
    family:     '"Newsreader", Georgia, serif',
    sample:     'Serifa literária',
    category:   'serif',
    googleFont: 'Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700',
  },
  'playfair': {
    label:      'Playfair Display',
    family:     '"Playfair Display", Georgia, serif',
    sample:     'Serifa editorial',
    category:   'serif',
    googleFont: 'Playfair+Display:ital,wght@0,400..700;1,400..700',
  },
  'jetbrains-mono': {
    label:      'JetBrains Mono',
    family:     '"JetBrains Mono", monospace',
    sample:     'Monospace técnica',
    category:   'monospace',
    googleFont: 'JetBrains+Mono:ital,wght@0,100..800;1,100..800',
  },
}

const loaded = new Set<UIFont>()

/** Injects a Google Fonts <link> for the given font (idempotent). */
export function loadFont(font: UIFont): void {
  if (loaded.has(font)) return
  const meta = FONTS[font]
  if (!meta.googleFont) { loaded.add(font); return }

  const el = document.createElement('link')
  el.rel  = 'stylesheet'
  el.href = `https://fonts.googleapis.com/css2?family=${meta.googleFont}&display=swap`
  document.head.appendChild(el)
  loaded.add(font)
}

/** Loads (if needed) and applies the font to --font-sans on <html>. */
export function applyFont(font: UIFont): void {
  loadFont(font)
  document.documentElement.style.setProperty('--font-sans', FONTS[font].family)
}
