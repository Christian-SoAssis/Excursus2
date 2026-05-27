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
const h3 = (text: string): JSONContent => ({
  type: 'heading', attrs: { level: 3 },
  content: [{ type: 'text', text }],
})
const p = (text?: string): JSONContent =>
  text
    ? { type: 'paragraph', content: [{ type: 'text', text }] }
    : { type: 'paragraph' }

const li = (text?: string): JSONContent => ({
  type: 'listItem',
  content: [text ? p(text) : p()],
})
const ti = (text?: string): JSONContent => ({
  type: 'taskItem', attrs: { checked: false },
  content: [text ? p(text) : p()],
})
const ul = (...items: JSONContent[]): JSONContent => ({ type: 'bulletList',  content: items })
const ol = (...items: JSONContent[]): JSONContent => ({ type: 'orderedList', content: items })
const tl = (...items: JSONContent[]): JSONContent => ({ type: 'taskList',    content: items })

// ── Built-in templates ────────────────────────────────────────────
export const NOTE_TEMPLATES: NoteTemplate[] = [
  // 1. Em branco
  {
    id: 'blank', label: 'Em branco', icon: '☐',
    desc: 'Começa do zero',
    folder: 'inbox', title: 'Sem título',
    content: { type: 'doc', content: [p()] },
  },

  // 2. Reunião — sem heading duplicado; metadados como parágrafo inicial
  {
    id: 'meeting', label: 'Reunião', icon: '◎',
    desc: 'Pauta, notas e próximos passos',
    folder: 'reuniões', title: 'Reunião — ',
    content: {
      type: 'doc',
      content: [
        p('📅 Data:   |   👥 Participantes:'),
        h3('Pauta'),
        ol(li(), li(), li()),
        h3('Notas'),
        p(),
        h3('Decisões'),
        ul(li(), li()),
        h3('Próximos passos'),
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
        h3('Objetivo'),
        p(),
        h3('Contexto'),
        p(),
        h3('Tarefas'),
        tl(ti('Definir escopo'), ti('Alinhar stakeholders'), ti()),
        h3('Referências'),
        ul(li()),
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
        h3('Pergunta principal'),
        p(),
        h3('Hipótese'),
        p(),
        h3('O que já sei'),
        ul(li(), li()),
        h3('Fontes'),
        ol(li(), li()),
        h3('Conclusões'),
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
        h3('Humor'),
        p(),
        h3('O que aconteceu'),
        p(),
        h3('Gratidão'),
        ul(li(), li(), li()),
        h3('Reflexão'),
        p(),
      ],
    },
  },
]
