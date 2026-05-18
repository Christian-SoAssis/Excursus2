# Design: Correção do Editor Novel

**Data:** 2026-05-17
**Escopo:** 4 bug fixes cirúrgicos em 3 arquivos do frontend

---

## Problema

O editor de notas (Novel/TipTap) não renderiza conteúdo nem exibe o menu de slash commands. Três bugs independentes causam isso em conjunto.

---

## Correções

### 1. `frontend/components/editor/Editor.tsx`

**Bug:** `useNotesStore` é chamado na linha 27 mas nunca importado → `ReferenceError` → componente crasha → tela em branco.

**Correção:**
- Adicionar `import { useNotesStore } from '@/store/notesStore'`
- Remover imports mortos da migração BlockNote: `useCreateBlockNote`, `BlockNoteView`, `BlockNoteSchema`, `defaultBlockSpecs`, `filterSuggestionItems`, `withMultiColumn`, `multiColumnDropCursor`, `getDefaultReactSlashMenuItems`, `SuggestionMenuController`, `DefaultReactSuggestionItem`
- Remover `import '@blocknote/mantine/style.css'` — conflita com os estilos do Novel

### 2. `frontend/app/(app)/notes/[id]/page.tsx`

**Bug:** `NovelEditor` usa `useState(content)` para o `initialContent`. Quando o usuário navega entre notas, o `content` prop atualiza mas o estado interno do Novel não — editor sempre mostra o conteúdo da primeira nota aberta.

**Correção:**
- Adicionar `key={id}` ao componente `<Editor>`. O React desmonta e remonta o editor inteiro ao trocar de nota, garantindo que `initialContent` receba o valor correto.

### 3. `frontend/components/editor/extensions/novel-extensions.ts`

**Bug:** `tiptap-extension-global-drag-handle` está em `package.json` mas nunca registrado nas extensões → drag-and-drop de blocos não funciona.

**Correção:**
- Importar `GlobalDragHandle` de `tiptap-extension-global-drag-handle`
- Adicionar ao array `defaultExtensions`

### 4. CSS (sem alteração necessária)

`tailwind.config.ts` já define `.novel-slash-command` e `.novel-slash-command-item` via `addComponents`. O popup do slash command aparecerá com os estilos Ethereal assim que o crash do import for resolvido.

---

## Arquivos modificados

| Arquivo | Tipo de mudança |
|---|---|
| `frontend/components/editor/Editor.tsx` | Adicionar import, remover dead code |
| `frontend/app/(app)/notes/[id]/page.tsx` | Adicionar `key={id}` no `<Editor>` |
| `frontend/components/editor/extensions/novel-extensions.ts` | Registrar GlobalDragHandle |

---

## O que não muda

- Extensões LaTeX/KaTeX (`math.tsx`) — intactas
- Extensão Wikilinks — intacta
- `NovelEditor.tsx` — sem alteração (o `key` no pai resolve o problema de stale content)
- CSS global / tema Ethereal — sem alteração
