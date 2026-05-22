export function TweaksPanel({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      className="tweaks-trigger appbar__tab"
      style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 100 }}
      onClick={onOpen}
      title="Configurações"
      aria-label="Abrir configurações"
    >
      ⚙
    </button>
  )
}
