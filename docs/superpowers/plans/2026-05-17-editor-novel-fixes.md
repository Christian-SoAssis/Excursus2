# Editor Novel — Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir 3 bugs que impedem o editor Novel de renderizar conteúdo e exibir slash commands.

**Architecture:** Correções cirúrgicas em 3 arquivos existentes. Nenhuma mudança de arquitetura. A extensão de drag handle já está instalada no package.json e só precisa ser registrada. O crash de import é o bloqueador crítico — resolve o editor em branco imediatamente.

**Tech Stack:** Next.js 14 (App Router), Novel v1.0.2, TipTap v2, Vitest + React Testing Library

---

## Mapa de Arquivos

| Arquivo | Operação | Motivo |
|---|---|---|
| `frontend/components/editor/Editor.tsx` | Modificar | Adicionar import faltando, remover dead code BlockNote |
| `frontend/app/(app)/notes/[id]/page.tsx` | Modificar | Adicionar `key={id}` no `<Editor>` |
| `frontend/components/editor/extensions/novel-extensions.ts` | Modificar | Registrar `GlobalDragHandle` |
| `frontend/__tests__/components/editor/editor.test.tsx` | Modificar | Atualizar mocks — o teste atual testa comportamento do BlockNote que não existe mais |

---

## Task 1: Corrigir Editor.tsx (import faltando + dead code)

**Files:**
- Modify: `frontend/components/editor/Editor.tsx`
- Test: `frontend/__tests__/components/editor/editor.test.tsx`

- [ ] **Step 1: Atualizar o teste para refletir o Editor atual (Novel)**

O teste atual mocka `@tiptap/react` e verifica `data-testid="editor-content"` — isso é do BlockNote, não do Novel. Substituir pelo comportamento real do Editor Novel:

```typescript
// frontend/__tests__/components/editor/editor.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/store/notesStore', () => ({
  useNotesStore: (selector: any) => selector({ notes: {}, allNotes: {} }),
}))
// Novel usa EditorRoot/EditorContent internamente — mockamos para smoke test
vi.mock('novel', () => ({
  EditorRoot: ({ children }: any) => <div>{children}</div>,
  EditorContent: ({ className }: any) => (
    <div data-testid="novel-editor" className={className} />
  ),
  JSONContent: {},
}))

import { Editor } from '@/components/editor/Editor'

describe('Editor component', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(
      <Editor content="<p>Hello</p>" onChange={vi.fn()} />
    )
    expect(getByTestId('novel-editor')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar o teste — deve FALHAR**

```bash
cd frontend && npx vitest run __tests__/components/editor/editor.test.tsx
```

Resultado esperado: FAIL — `ReferenceError: useNotesStore is not defined` (confirma o bug).

- [ ] **Step 3: Corrigir Editor.tsx**

Substituir o bloco completo de imports pelo seguinte (remove tudo de BlockNote, adiciona o import faltando):

```typescript
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useNotesStore } from '@/store/notesStore'
import { Search } from 'lucide-react'
import NovelEditor from './NovelEditor'
```

O restante do arquivo (a partir de `interface Props`) permanece idêntico — não alterar.

- [ ] **Step 4: Rodar o teste — deve PASSAR**

```bash
cd frontend && npx vitest run __tests__/components/editor/editor.test.tsx
```

Resultado esperado: PASS — `Editor component > renders without crashing`

- [ ] **Step 5: Commit**

```bash
git add frontend/components/editor/Editor.tsx frontend/__tests__/components/editor/editor.test.tsx
git commit -m "fix(editor): add missing useNotesStore import, remove dead BlockNote code"
```

---

## Task 2: Corrigir conteúdo estale ao trocar de nota

**Files:**
- Modify: `frontend/app/(app)/notes/[id]/page.tsx`

Não há teste unitário viável para este fix — envolve roteamento do Next.js e estado do Zustand em conjunto. Verificar manualmente após implementar.

- [ ] **Step 1: Adicionar `key={id}` no componente `<Editor>`**

No arquivo `frontend/app/(app)/notes/[id]/page.tsx`, localizar a linha com `<Editor` (próximo do final, dentro do `return`):

```typescript
      {/* Editor */}
      <Editor
        content={content}
        onChange={handleContentChange}
        placeholder="Comece a escrever... Use $LaTeX$ para matemática e [[Nota]] para links."
      />
```

Alterar para:

```typescript
      {/* Editor */}
      <Editor
        key={id}
        content={content}
        onChange={handleContentChange}
        placeholder="Comece a escrever... Use $LaTeX$ para matemática e [[Nota]] para links."
      />
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/(app)/notes/[id]/page.tsx
git commit -m "fix(editor): force remount on note change to clear stale content"
```

---

## Task 3: Ativar drag handle de blocos

**Files:**
- Modify: `frontend/components/editor/extensions/novel-extensions.ts`

- [ ] **Step 1: Verificar que o pacote está instalado**

```bash
cd frontend && grep "tiptap-extension-global-drag-handle" package.json
```

Resultado esperado: `"tiptap-extension-global-drag-handle": "^0.1.18"`

- [ ] **Step 2: Registrar a extensão**

No arquivo `frontend/components/editor/extensions/novel-extensions.ts`, adicionar o import no topo:

```typescript
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'
```

Depois, adicionar `GlobalDragHandle` ao array `defaultExtensions` logo após `MathExtension`:

```typescript
export const defaultExtensions = [
  GlobalDragHandle,
  MathExtension,
  StarterKit.configure({
    // ... configurações existentes, não alterar
  }),
  // ... resto das extensões, não alterar
]
```

- [ ] **Step 3: Rodar os testes existentes para garantir que nada quebrou**

```bash
cd frontend && npx vitest run
```

Resultado esperado: todos os testes passam (ou falham pelos mesmos motivos de antes — sem novas falhas).

- [ ] **Step 4: Commit**

```bash
git add frontend/components/editor/extensions/novel-extensions.ts
git commit -m "feat(editor): activate GlobalDragHandle extension for block drag-and-drop"
```

---

## Verificação Manual Final

Após os 3 commits, testar no navegador:

1. Abrir uma nota existente — conteúdo deve aparecer no editor
2. Digitar `/` em uma linha vazia — menu de slash commands deve aparecer com fundo Ethereal
3. Navegar para outra nota — editor deve mostrar o conteúdo da nova nota (não o anterior)
4. Passar o mouse na margem esquerda de um bloco — ícone de drag deve aparecer
5. Arrastar um bloco para outra posição — deve funcionar
