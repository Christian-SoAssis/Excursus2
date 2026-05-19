#!/usr/bin/env python3
"""Seed 15 notes into Excursus 2 database for testing."""
import sqlite3, json, os, sys

DB_PATH = os.path.expanduser("~/.local/share/com.chrisassis.excursus2/excursus.db")

if not os.path.exists(DB_PATH):
    print(f"Banco não encontrado em {DB_PATH}")
    print("Abra o Excursus 2 ao menos uma vez para criar o banco.")
    sys.exit(1)

# ── helpers ──────────────────────────────────────────────────────────────────

def t(text): return {"type": "text", "text": text}
def bold(text): return {"type": "text", "marks": [{"type": "bold"}], "text": text}
def italic(text): return {"type": "text", "marks": [{"type": "italic"}], "text": text}
def code_inline(text): return {"type": "text", "marks": [{"type": "code"}], "text": text}
def h(level, text): return {"type": "heading", "attrs": {"level": level}, "content": [t(text)]}
def p(*parts): return {"type": "paragraph", "content": [x if isinstance(x, dict) else t(x) for x in parts]}
def ul(*items): return {"type": "bulletList", "content": [
    {"type": "listItem", "content": [{"type": "paragraph", "content":
        [x if isinstance(x, dict) else t(x) for x in (item if isinstance(item, list) else [item])]}]}
    for item in items]}
def bq(text): return {"type": "blockquote", "content": [p(text)]}
def code(lang, src): return {"type": "codeBlock", "attrs": {"language": lang}, "content": [t(src)]}
def math(src): return {"type": "mathBlock", "attrs": {"src": src}}
def callout(text): return {"type": "calloutBlock", "content": [t(text)]}
def hr(): return {"type": "horizontalRule"}
def bl(note_id, title): return {"type": "backlink", "attrs": {"noteId": note_id, "title": title}}
def doc(*nodes): return json.dumps({"type": "doc", "content": list(nodes)})

# ── notas ────────────────────────────────────────────────────────────────────

NOTES = []
EDGES = []   # (a_id, b_id)

# 1 ─ Índice Geral
NOTES.append(("idx001", "Índice Geral", "inbox", 100, 100, 280,
  "Índice Geral navegação Ciências Código Filosofia Projetos backlinks",
  doc(
    h(1,"Índice Geral"),
    p("Central de navegação do sistema de notas. Use os backlinks abaixo para explorar os temas."),
    h(2,"Ciências"),
    p("→ ", bl("qnt003","Física Quântica"), " · ", bl("thm006","Termodinâmica")),
    h(2,"Código"),
    p("→ ", bl("py004","Python Essentials"), " · ", bl("dst007","Estruturas de Dados"), " · ", bl("arc011","Arquitetura de Software")),
    h(2,"Filosofia e Método"),
    p("→ ", bl("sto005","Filosofia Estoica"), " · ", bl("zkn002","Zettelkasten")),
    h(2,"Projetos e Ideias"),
    p("→ ", bl("exc014","Projeto Excursus"), " · ", bl("hab010","Ideia: App de Hábitos")),
  )
))
EDGES += [("idx001","qnt003"),("idx001","thm006"),("idx001","py004"),("idx001","dst007"),
          ("idx001","arc011"),("idx001","sto005"),("idx001","zkn002"),("idx001","exc014"),("idx001","hab010")]

# 2 ─ Zettelkasten
NOTES.append(("zkn002", "Zettelkasten", "método", 420, 80, 280,
  "Zettelkasten Niklas Luhmann atomicidade conexão emergência notas fichas conhecimento backlinks",
  doc(
    h(1,"Zettelkasten"),
    p("O método Zettelkasten (\"caixa de fichas\") foi criado pelo sociólogo ",
      bold("Niklas Luhmann"), ", que produziu ~70 livros usando 90.000 fichas interligadas."),
    h(2,"Princípios"),
    ul(
      [bold("Atomicidade: "), t("cada nota contém exatamente uma ideia")],
      [bold("Conexão: "), t("notas se ligam umas às outras por backlinks")],
      [bold("Emergência: "), t("conhecimento surge das conexões, não das notas isoladas")],
    ),
    bq("\"Não escrevo para publicar, escrevo para pensar.\" — Niklas Luhmann"),
    p("Ver: ", bl("idx001","Índice Geral")),
  )
))
EDGES += [("zkn002","idx001")]

# 3 ─ Física Quântica
NOTES.append(("qnt003", "Física Quântica", "ciência", 720, 80, 280,
  "Física Quântica Schrödinger Heisenberg De Broglie dualidade incerteza mecânica quântica probabilidade",
  doc(
    h(1,"Física Quântica"),
    p("Fundamentos da mecânica quântica e suas equações centrais."),
    h(2,"Equação de Schrödinger"),
    p("Governa a evolução temporal de um sistema quântico:"),
    math(r"i\hbar\frac{\partial}{\partial t}\Psi = \hat{H}\Psi"),
    h(2,"Princípio da Incerteza de Heisenberg"),
    math(r"\Delta x \cdot \Delta p \geq \frac{\hbar}{2}"),
    h(2,"Comprimento de Onda de De Broglie"),
    math(r"\lambda = \frac{h}{p} = \frac{h}{mv}"),
    callout("A mecânica quântica descreve o mundo subatômico com probabilidades, não certezas."),
    p("Ver: ", bl("thm006","Termodinâmica")),
  )
))
EDGES += [("qnt003","thm006")]

# 4 ─ Python Essentials
NOTES.append(("py004", "Python Essentials", "código", 100, 340, 280,
  "Python list comprehension context manager dataclass frozen typing padrões idiomático",
  doc(
    h(1,"Python Essentials"),
    p("Padrões e idiomas fundamentais do Python moderno."),
    h(2,"List Comprehension"),
    code("python",
      "# Idiomático\nquadrados = [x**2 for x in range(10) if x % 2 == 0]\n\n"
      "# Dict comprehension\nfreq = {p: texto.count(p) for p in set(texto.split())}"),
    h(2,"Context Managers"),
    code("python",
      "from contextlib import contextmanager\n\n@contextmanager\ndef timer(label: str):\n"
      "    import time\n    t = time.perf_counter()\n    yield\n"
      "    print(f\"{label}: {time.perf_counter()-t:.3f}s\")"),
    h(2,"Dataclasses"),
    code("python",
      "from dataclasses import dataclass, field\n\n@dataclass(frozen=True)\nclass Ponto:\n"
      "    x: float\n    y: float\n    tags: list[str] = field(default_factory=list)\n\n"
      "    @property\n    def dist(self) -> float:\n        return (self.x**2 + self.y**2)**0.5"),
    p("Ver: ", bl("dst007","Estruturas de Dados"), " · ", bl("arc011","Arquitetura de Software")),
  )
))
EDGES += [("py004","dst007"),("py004","arc011")]

# 5 ─ Filosofia Estoica
NOTES.append(("sto005", "Filosofia Estoica", "filosofia", 420, 340, 280,
  "Estoicismo Zenão Epicteto Marco Aurélio dicotomia controle prática meditação desapego virtude tranquilidade",
  doc(
    h(1,"Filosofia Estoica"),
    p("Fundada por ", bold("Zenão de Cítio"), " (~300 a.C.). Núcleo: distinguir o que está em nosso poder do que não está."),
    bq("\"Não peças que os eventos aconteçam como desejas, mas deseja que aconteçam como são.\" — Epicteto"),
    bq("\"Você tem poder sobre sua mente, não sobre eventos externos.\" — Marco Aurélio"),
    h(2,"Dicotomia do Controle"),
    ul(
      [bold("Em nosso poder: "), t("opiniões, julgamentos, impulsos, desejos")],
      [bold("Fora do nosso poder: "), t("corpo, reputação, posses, resultados")],
    ),
    callout("Prática: meditação negativa — imaginar o pior cenário para exercitar o desapego."),
    p("Ver: ", bl("ref015","Reflexões do Dia"), " · ", bl("zkn002","Zettelkasten")),
  )
))
EDGES += [("sto005","ref015"),("sto005","zkn002")]

# 6 ─ Termodinâmica
NOTES.append(("thm006", "Termodinâmica", "ciência", 720, 340, 280,
  "Termodinâmica leis energia calor trabalho entropia temperatura conservação zero absoluto",
  doc(
    h(1,"Termodinâmica"),
    p("As quatro leis que governam energia, calor e trabalho nos sistemas físicos."),
    h(2,"Lei Zero — Equilíbrio Térmico"),
    p("Se A está em equilíbrio com B, e B com C, então A está com C. Define temperatura."),
    h(2,"Primeira Lei — Conservação de Energia"),
    math(r"\Delta U = Q - W"),
    h(2,"Segunda Lei — Entropia"),
    math(r"dS \geq \frac{\delta Q}{T}"),
    p("A entropia de um sistema isolado nunca diminui espontaneamente."),
    h(2,"Terceira Lei — Zero Absoluto"),
    math(r"\lim_{T \to 0} S = 0"),
    p("Ver: ", bl("qnt003","Física Quântica")),
  )
))
EDGES += [("thm006","qnt003")]

# 7 ─ Estruturas de Dados
NOTES.append(("dst007", "Estruturas de Dados", "código", 100, 580, 280,
  "Estruturas dados array hashmap BST heap complexidade Big O Rust BinaryHeap algoritmo ordenação",
  doc(
    h(1,"Estruturas de Dados"),
    h(2,"Complexidade das Operações"),
    ul(
      [code_inline("Array"), t(" — acesso O(1), inserção/remoção O(n)")],
      [code_inline("HashMap"), t(" — acesso O(1)*, inserção O(1)*")],
      [code_inline("BST (balanceada)"), t(" — acesso, insert, delete O(log n)")],
      [code_inline("Heap"), t(" — findMin O(1), deleteMin O(log n)")],
    ),
    h(2,"MinHeap em Rust"),
    code("rust",
      "use std::collections::BinaryHeap;\nuse std::cmp::Reverse;\n\n"
      "fn top_k(nums: Vec<i32>, k: usize) -> Vec<i32> {\n"
      "    let mut heap: BinaryHeap<Reverse<i32>> =\n"
      "        nums.into_iter().map(Reverse).collect();\n"
      "    (0..k)\n        .filter_map(|_| heap.pop())\n"
      "        .map(|Reverse(v)| v)\n        .collect()\n}"),
    p("Ver: ", bl("py004","Python Essentials"), " · ", bl("arc011","Arquitetura de Software")),
  )
))
EDGES += [("dst007","py004"),("dst007","arc011")]

# 8 ─ Reunião — Sprint Review
NOTES.append(("mtg008", "Reunião — Sprint Review", "trabalho", 420, 580, 280,
  "Reunião sprint review decisões beta lançamento FTS5 busca pasta pendências E2E bundle release",
  doc(
    h(1,"Reunião — Sprint Review"),
    p(bold("Data:"), " 18 mai 2026   ", bold("Participantes:"), " Chris, Ana, Pedro"),
    h(2,"Decisões"),
    ul(
      "Lançar beta para testadores internos até sexta",
      "Priorizar modo Floating antes de refinar Spatial",
      "FTS5 — adicionar filtro por pasta na próxima sprint",
    ),
    h(2,"Pendências"),
    ul(
      "☐  Escrever release notes da v0.1.0",
      "☑  Corrigir bug IPC pos_x → posX",
      "☐  Rodar testes E2E com binary compilado",
      "☑  Configurar bundle RPM/DEB para Fedora",
    ),
    p("Ver: ", bl("exc014","Projeto Excursus")),
  )
))
EDGES += [("mtg008","exc014")]

# 9 ─ Livros para Ler
NOTES.append(("bks009", "Livros para Ler", "leitura", 720, 580, 280,
  "Livros leitura filosofia Nietzsche Wittgenstein Knuth SICP Borges Bulgakov Meditações",
  doc(
    h(1,"Livros para Ler"),
    h(2,"Filosofia"),
    ul(
      [italic("Além do Bem e do Mal"), t(" — Nietzsche")],
      [italic("Investigações Filosóficas"), t(" — Wittgenstein")],
      [italic("Meditações"), t(" — Marco Aurélio")],
    ),
    h(2,"Computação"),
    ul(
      [italic("Structure and Interpretation of Computer Programs"), t(" — Abelson & Sussman")],
      [italic("The Art of Computer Programming"), t(" — Knuth")],
      [italic("A Philosophy of Software Design"), t(" — Ousterhout")],
    ),
    h(2,"Literatura"),
    ul(
      [italic("Ficções"), t(" — Jorge Luis Borges")],
      [italic("O Mestre e Margarida"), t(" — Bulgakov")],
    ),
  )
))

# 10 ─ Ideia: App de Hábitos
NOTES.append(("hab010", "Ideia: App de Hábitos", "ideias", 100, 820, 280,
  "Ideia app hábitos rastreamento streak heatmap gamificação notificações local-first Tauri minimalista",
  doc(
    h(1,"Ideia: App de Hábitos"),
    callout("Inspiração: reusar o stack do Excursus (Tauri + SQLite) para tracking de hábitos."),
    h(2,"Conceito"),
    p("App minimalista de rastreamento de hábitos. Sem servidor, sem assinatura. Tudo local."),
    h(2,"Features MVP"),
    ul(
      "Check-in diário (sim/não por hábito)",
      "Visualização de streak consecutivo",
      "Heatmap anual estilo GitHub",
      "Notificações locais via Tauri",
      "Export CSV para análise",
    ),
    h(2,"Stack"),
    p("Tauri 2 + React + SQLite — base idêntica ao Excursus."),
    p("Ver: ", bl("exc014","Projeto Excursus"), " · ", bl("arc011","Arquitetura de Software")),
  )
))
EDGES += [("hab010","exc014"),("hab010","arc011")]

# 11 ─ Arquitetura de Software
NOTES.append(("arc011", "Arquitetura de Software", "código", 420, 820, 280,
  "Arquitetura SOLID responsabilidade inversão dependência hexagonal ports adapters camadas domínio",
  doc(
    h(1,"Arquitetura de Software"),
    h(2,"Princípios SOLID"),
    ul(
      [bold("S — Single Responsibility: "), t("cada módulo tem exatamente uma razão para mudar")],
      [bold("O — Open/Closed: "), t("aberto para extensão, fechado para modificação")],
      [bold("L — Liskov Substitution: "), t("subtipos devem ser substituíveis pelos seus supertipos")],
      [bold("I — Interface Segregation: "), t("interfaces pequenas e específicas são melhores que grandes")],
      [bold("D — Dependency Inversion: "), t("dependa de abstrações, não de implementações")],
    ),
    h(2,"Arquitetura Hexagonal (Ports & Adapters)"),
    ul(
      [bold("Domínio: "), t("lógica de negócio pura, sem dependências externas")],
      [bold("Aplicação: "), t("orquestra casos de uso, chama o domínio")],
      [bold("Infraestrutura: "), t("banco de dados, UI, APIs externas — adaptadores")],
    ),
    callout("No Excursus: Rust commands = camada de aplicação, SQLite = infraestrutura, React = adapter de UI."),
    p("Ver: ", bl("py004","Python Essentials"), " · ", bl("dst007","Estruturas de Dados")),
  )
))
EDGES += [("arc011","py004"),("arc011","dst007")]

# 12 ─ Receita: Pão de Queijo
NOTES.append(("pao012", "Receita: Pão de Queijo", "receitas", 720, 820, 280,
  "Receita pão queijo polvilho azedo ovos leite manteiga queijo minas rendimento assado 180 graus",
  doc(
    h(1,"Receita: Pão de Queijo"),
    p(bold("Rendimento:"), " ~30 unidades   ", bold("Tempo:"), " 40 min   ", bold("Temperatura:"), " 180°C"),
    h(2,"Ingredientes"),
    ul(
      "500g polvilho azedo",
      "2 ovos inteiros",
      "1 xícara de leite integral",
      "½ xícara de óleo ou manteiga derretida",
      "250g queijo minas curado ralado",
      "1 colher de chá de sal",
    ),
    h(2,"Modo de Preparo"),
    ul(
      "Aquecer leite + óleo até quase ferver",
      "Despejar sobre o polvilho e misturar com garfo",
      "Deixar amornar, incorporar ovos batidos e queijo",
      "Modelar bolinhas e assar em forno pré-aquecido por 25 min",
    ),
    callout("Segredo: polvilho azedo (não doce) deixa a casca crocante. Não abra o forno nos primeiros 15 min."),
  )
))

# 13 ─ Vocabulário Inglês
NOTES.append(("voc013", "Vocabulário Inglês", "idiomas", 100, 1060, 280,
  "Vocabulário inglês shibboleth ephemeral liminal serendipity perspicuous eloquent resilience palavras acadêmicas",
  doc(
    h(1,"Vocabulário Inglês"),
    p("Palavras de alta frequência em textos acadêmicos e literários."),
    h(2,"Palavras desta semana"),
    ul(
      [bold("Shibboleth"), t(" — costume/palavra que identifica pertencimento a um grupo")],
      [bold("Ephemeral"), t(" — que dura muito pouco; efêmero, passageiro")],
      [bold("Liminal"), t(" — relativo a limiar ou estado de transição entre dois mundos")],
      [bold("Serendipity"), t(" — descoberta feliz e inesperada; sorte criativa")],
      [bold("Perspicuous"), t(" — claro, fácil de entender; o oposto de obscuro")],
      [bold("Elicit"), t(" — provocar ou extrair uma resposta/reação de alguém")],
    ),
    bq("\"The limits of my language mean the limits of my world.\" — Wittgenstein"),
  )
))

# 14 ─ Projeto Excursus
NOTES.append(("exc014", "Projeto Excursus", "projetos", 420, 1060, 280,
  "Excursus Tauri React SQLite local-first grafo backlinks Floating Spatial Graph beta lançamento open-source",
  doc(
    h(1,"Projeto Excursus"),
    callout("Status: beta interno — testando notas, graph view, spatial e backlinks."),
    h(2,"Stack Técnica"),
    ul(
      "Tauri 2 + Rust/rusqlite (backend local-first)",
      "React 18 + TypeScript + TipTap (editor rico)",
      "Zustand (estado global sem boilerplate)",
      "FTS5 com triggers automáticos (busca full-text)",
      "Vitest + Playwright (testes)",
    ),
    h(2,"Três Modos de Visualização"),
    ul(
      [bold("Floating: "), t("sidebar + editor de texto completo com backlinks inline")],
      [bold("Spatial: "), t("canvas 2D com cards arrastáveis e arestas SVG")],
      [bold("Graph: "), t("simulação de força — backlinks viram arestas, notas viram nós")],
    ),
    h(2,"Roadmap"),
    ul(
      "v0.1 — MVP funcional (atual)",
      "v0.2 — Filtro por pasta no FTS, resize de cards no Spatial",
      "v0.3 — Export Markdown, temas customizáveis",
      "v1.0 — Open source público",
    ),
    p("Ver: ", bl("arc011","Arquitetura de Software"), " · ", bl("dst007","Estruturas de Dados")),
  )
))
EDGES += [("exc014","arc011"),("exc014","dst007")]

# 15 ─ Reflexões do Dia
NOTES.append(("ref015", "Reflexões do Dia", "diário", 720, 1060, 280,
  "Reflexões diário aprendizado Excursus Tauri IPC FTS5 AppImage Fedora estoicismo notas construção",
  doc(
    h(1,"Reflexões do Dia"),
    p(italic("18 de maio de 2026")),
    hr(),
    p("Hoje finalmente consegui fazer o Excursus funcionar corretamente. "
      "Tem algo satisfatório em construir a própria ferramenta — "
      "cada decisão de design reflete como você pensa."),
    callout("Insight: o grafo de backlinks não é só visualização — é o mapa do próprio pensamento."),
    h(2,"O que aprendi hoje"),
    ul(
      "Tauri v2 usa camelCase para argumentos IPC por padrão",
      "FTS5 tem sintaxe especial que precisa ser sanitizada antes do MATCH",
      "AppImage falha por FUSE no kernel recente do Fedora — RPM é o caminho",
      "WAL mode no SQLite permite leitura concorrente sem bloquear writes",
    ),
    bq("\"Cuida do teu espaço interior. O mundo exterior segue.\" — Marco Aurélio (paráfrase)"),
    p("Ver: ", bl("sto005","Filosofia Estoica")),
  )
))
EDGES += [("ref015","sto005")]

# ── inserção ─────────────────────────────────────────────────────────────────

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA foreign_keys = ON")

inserted = 0
for (nid, title, folder, px, py, pw, text_body, content) in NOTES:
    wc = len(text_body.split())
    conn.execute(
        """INSERT OR IGNORE INTO notes
           (id, title, folder, pos_x, pos_y, pos_w, content, text_body, word_count)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (nid, title, folder, float(px), float(py), float(pw), content, text_body, wc)
    )
    inserted += conn.execute("SELECT changes()").fetchone()[0]

edge_inserted = 0
for (a, b) in EDGES:
    conn.execute(
        "INSERT OR IGNORE INTO note_edges (a_id, b_id, kind) VALUES (?,?,'explicit')",
        (a, b)
    )
    edge_inserted += conn.execute("SELECT changes()").fetchone()[0]

conn.commit()
conn.close()

print(f"✓ {inserted} notas inseridas")
print(f"✓ {edge_inserted} arestas inseridas")
print("Abra o Excursus 2 — as notas já aparecem na sidebar e no Graph.")
