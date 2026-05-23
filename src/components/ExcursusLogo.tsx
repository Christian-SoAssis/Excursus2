/**
 * ExcursusLogo — marca visual do app em duas variantes:
 *
 *   <ExcursusLogo />           → ícone quadrado compacto (AppBar, etc.)
 *   <ExcursusWordmark />       → logo panorâmico com fio + pulso + wordmark
 */

/* ── Gradiente compartilhado ──────────────────────────────────── */
const GRAD_ID = 'ex-grad'

function Defs() {
  return (
    <defs>
      <linearGradient id={GRAD_ID} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"   stopColor="#ff9d77" />
        <stop offset="0.6" stopColor="#f0bd8b" />
        <stop offset="1"   stopColor="#c4b6ff" stopOpacity="0.7" />
      </linearGradient>
    </defs>
  )
}

/* ── Ícone quadrado ───────────────────────────────────────────── */
interface LogoProps {
  size?:      number
  bg?:        boolean   // mostrar fundo escuro com cantos arredondados
  className?: string
}

export function ExcursusLogo({ size = 32, bg = true, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Excursus"
      role="img"
    >
      <Defs />
      {bg && (
        <rect width="64" height="64" rx="13" fill="#131411" />
      )}
      {/* fio */}
      <line x1="5" y1="39" x2="59" y2="39"
        stroke="#cec5c1" strokeWidth="1.4" strokeLinecap="round" />
      {/* pulso */}
      <path
        d="M9 39 C23 39 21.5 17 32 17 C42.5 17 41 39 55 39"
        fill="none"
        stroke={`url(#${GRAD_ID})`}
        strokeWidth="2.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ── Wordmark panorâmico (login, splash) ──────────────────────── */
interface WordmarkProps {
  width?:     number
  className?: string
  showText?:  boolean
}

export function ExcursusWordmark({ width = 320, className, showText = true }: WordmarkProps) {
  const h = Math.round(width * 0.36)   // proporção 320 × 115

  return (
    <svg
      width={width}
      height={h}
      viewBox="0 0 320 115"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Excursus"
      role="img"
    >
      <Defs />

      {/* fundo translúcido */}
      <rect width="320" height="115" rx="16" fill="#131411" fillOpacity="0.96" />

      {/* brilho sutil no topo */}
      <rect width="320" height="1" y="0" rx="0" fill="#ffffff" fillOpacity="0.04" />

      {/* linha do fio — de ponta a ponta */}
      <line x1="28" y1="54" x2="292" y2="54"
        stroke="#cec5c1" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.7" />

      {/* pulso — anomalia central, bem visível */}
      <path
        d="M124 54 C148 54 145 20 160 20 C175 20 172 54 196 54"
        fill="none"
        stroke={`url(#${GRAD_ID})`}
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* wordmark */}
      {showText && (
        <text
          x="160" y="82"
          fontFamily="'Courier New', 'Geist Mono', monospace"
          fontSize="10"
          letterSpacing="6"
          textAnchor="middle"
          fill="#998f8a"
        >
          EXCURSUS
        </text>
      )}
    </svg>
  )
}
