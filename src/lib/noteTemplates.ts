import type { JSONContent } from '@tiptap/react'

// ── Template type ─────────────────────────────────────────────────
export interface NoteTemplate {
  id:      string
  label:   string
  icon:    string
  desc:    string
  folder:  string
  title:   string
  content: JSONContent
}

// ── Helper builders ───────────────────────────────────────────────
const h = (level: 1 | 2 | 3, text: string): JSONContent => ({
  type: 'heading', attrs: { level },
  content: [{ type: 'text', text }],
})
const p  = (text?: string): JSONContent =>
  text
    ? { type: 'paragraph', content: [{ type: 'text', text }] }
    : { type: 'paragraph' }

const li  = (text?: string): JSONContent => ({
  type: 'listItem',
  content: [text ? p(text) : p()],
})
const oli  = (text?: string): JSONContent => li(text)
const ti  = (text?: string): JSONContent => ({
  type: 'taskItem', attrs: { checked: false },
  content: [text ? p(text) : p()],
})
const ul  = (...items: JSONContent[]): JSONContent => ({ type: 'bulletList',   content: items })
const ol  = (...items: JSONContent[]): JSONContent => ({ type: 'orderedList',  content: items })
const tl  = (...items: JSONContent[]): JSONContent => ({ type: 'taskList',     content: items })
const hr  = (): JSONContent => ({ type: 'horizontalRule' })

// ── Built-in templates ────────────────────────────────────────────
export const NOTE_TEMPLATES: NoteTemplate[] = [
  // 1. Em branco
  {
    id: 'blank', label: 'Em branco', icon: '☐',
    desc: 'Começa do zero',
    folder: 'inbox', title: 'Sem título',
    content: { type: 'doc', content: [p()] },
  },

  // 2. Reunião
  {
    id: 'meeting', label: 'Reunião', icon: '◎',
    desc: 'Pauta, notas e próximos passos',
    folder: 'reuniões', title: 'Reunião — ',
    content: {
      type: 'doc',
      content: [
        h(2, 'Reunião'),
        p('📅 Data:   |   👥 Participantes:'),
        h(3, 'Pauta'),
        ol(oli(), oli(), oli()),
        h(3, 'Notas'),
        p(),
        h(3, 'Decisões'),
        ul(li(), li()),
        h(3, 'Próximos passos'),
        tl(ti(), ti(), ti()),
      ],
    },
  },

  // 3. Projeto
  {
    id: 'project', label: 'Projeto', icon: '⊞',
    desc: 'Objetivo, contexto e tarefas',
    folder: 'projetos', title: 'Projeto — ',
    content: {
      type: 'doc',
      content: [
        h(2, 'Projeto'),
        h(3, 'Objetivo'),
        p('O que queremos alcançar e por quê.'),
        h(3, 'Contexto'),
        p(),
        h(3, 'Tarefas'),
        tl(ti('Definir escopo'), ti('Alinhar stakeholders'), ti()),
        h(3, 'Referências'),
        ul(li()),
        hr(),
        p('Criado em: ' + new Date().toLocaleDateString('pt-BR')),
      ],
    },
  },

  // 4. Pesquisa
  {
    id: 'research', label: 'Pesquisa', icon: '⌕',
    desc: 'Pergunta, hipótese e fontes',
    folder: 'pesquisa', title: 'Pesquisa — ',
    content: {
      type: 'doc',
      content: [
        h(2, 'Pesquisa'),
        h(3, 'Pergunta principal'),
        p(),
        h(3, 'Hipótese'),
        p(),
        h(3, 'O que já sei'),
        ul(li(), li()),
        h(3, 'Fontes'),
        ol(oli(), oli()),
        h(3, 'Conclusões'),
        p(),
      ],
    },
  },

  // 5. Diário
  {
    id: 'journal', label: 'Diário', icon: '✎',
    desc: 'Entrada diária livre',
    folder: 'diário', title: 'Diário — ' + new Date().toLocaleDateString('pt-BR'),
    content: {
      type: 'doc',
      content: [
        h(2, '✎ ' + new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })),
        h(3, 'Humor'),
        p(),
        h(3, 'O que aconteceu'),
        p(),
        h(3, 'Gratidão'),
        ul(li(), li(), li()),
        h(3, 'Reflexão'),
        p(),
      ],
    },
  },
]
