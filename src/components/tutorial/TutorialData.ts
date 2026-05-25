/* ================================================================
   Excursus — Tutorial steps data
   ================================================================ */

export interface TutorialTip {
  icon: string
  text: string
}

export interface TutorialStep {
  id:          string
  label:       string          // nome curto p/ lista nas settings
  icon:        string
  iconColor:   string
  mode?:       string          // id do modo no AppBar (para destaque)
  title:       string
  subtitle:    string
  desc:        string
  tips:        TutorialTip[]
  written:     string[]        // parágrafos p/ o guia escrito nas settings
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  /* ── 0 · Boas-vindas ─────────────────────────────────────────── */
  {
    id:        'welcome',
    label:     'Introdução',
    icon:      '◈',
    iconColor: '#ff9d77',
    title:     'Bem-vindo ao Excursus',
    subtitle:  'Seu espaço de pensamento',
    desc:
      'O Excursus é um ambiente onde notas, hábitos, calendário e IA convivem sem fragmentar o que é naturalmente contínuo. ' +
      'Este tour mostra o que cada modo pode fazer — leva menos de 2 minutos.',
    tips: [],
    written: [
      'O Excursus nasceu da frustração com ferramentas fragmentadas: uma para notas, outra para hábitos, outra para calendário. Aqui, tudo coexiste.',
      'Você pode alternar entre modos a qualquer momento pela barra superior. Suas notas são as mesmas em todos os modos — o que muda é a perspectiva.',
      'Use as Configurações (ícone redondo no canto superior direito) para personalizar tema, fonte, cores e muito mais.',
    ],
  },

  /* ── 1 · Hoje ────────────────────────────────────────────────── */
  {
    id:        'home',
    label:     'Hoje',
    icon:      '◈',
    iconColor: '#ff9d77',
    mode:      'home',
    title:     'Hoje — seu ponto de partida',
    subtitle:  'Registre, reflita, acompanhe',
    desc:
      'O modo Hoje é o seu diário pessoal estruturado. Escreva reflexões, acompanhe hábitos e mantenha um registro contínuo do seu dia, tudo em um só lugar.',
    tips: [
      { icon: '/',   text: 'Digite `/` em qualquer linha para abrir o menu de blocos — insira tabelas, listas de tarefas, chamadas, fórmulas e muito mais.' },
      { icon: '[[', text: 'Use `[[nome da nota]]` para criar um backlink. A conexão aparece automaticamente no modo Graph.' },
      { icon: '✓',   text: 'Hábitos configurados aparecem no topo do Hoje — marque-os com um clique sem perder o fio da escrita.' },
      { icon: '📅',  text: 'Cada entrada do Hoje é uma nota completa e independente, linkável de qualquer outro contexto.' },
    ],
    written: [
      'O modo Hoje abre automaticamente na data atual e cria uma nota para cada dia. Você pode navegar pelos dias anteriores clicando nas setas ao lado da data.',
      'O editor é rico e suporta markdown nativo: escreva `**negrito**`, `_itálico_`, `# Título`, `- lista` e o texto se formata enquanto você digita.',
      'Hábitos são rastreados por dia: se você marcou "Exercício" hoje, a marcação fica registrada e aparece no histórico.',
      'Use backlinks `[[Nome da Nota]]` para conectar ideias. O Excursus autocompleta o nome enquanto você digita.',
      'Dica de pro: escreva uma reflexão curta toda manhã no Hoje. Com o tempo, o Graph mostra os padrões do seu pensamento.',
    ],
  },

  /* ── 2 · Calendário ──────────────────────────────────────────── */
  {
    id:        'calendar',
    label:     'Calendário',
    icon:      '◷',
    iconColor: '#f0bd8b',
    mode:      'calendar',
    title:     'Calendário — tempo e pensamento juntos',
    subtitle:  'Seus compromissos com contexto',
    desc:
      'Conecte ao Google Calendar para ver eventos e escrever notas diretamente neles. Nunca mais perca o contexto de uma reunião.',
    tips: [
      { icon: '🔗', text: 'Clique em "Conectar Google Calendar" e faça login com sua conta Google — o processo leva menos de 1 minuto.' },
      { icon: '📝', text: 'Clique em qualquer evento para abrir um editor de notas vinculado a ele.' },
      { icon: '🔁', text: 'Notas de eventos aparecem linkadas no modo Hoje do mesmo dia — contexto sempre preservado.' },
      { icon: '👁',  text: 'Use a visualização mensal para ter uma perspectiva ampla de compromissos e notas.' },
    ],
    written: [
      'O modo Calendário integra com o Google Calendar via OAuth seguro. Seus eventos são lidos em tempo real.',
      'Para conectar, clique no botão "Conectar Google Calendar" na tela do modo Calendário e siga o fluxo de autorização.',
      'Cada evento pode ter notas vinculadas: ata de reunião, decisões, próximos passos. Tudo fica salvo na sua conta Excursus.',
      'As notas de eventos também aparecem no modo Hoje do dia correspondente, mantendo o contexto completo.',
      'A conexão usa refresh token armazenado de forma segura no servidor — você só precisa autorizar uma vez.',
    ],
  },

  /* ── 3 · Floating ────────────────────────────────────────────── */
  {
    id:        'floating',
    label:     'Floating',
    icon:      '◰',
    iconColor: '#c4b6ff',
    mode:      'floating',
    title:     'Floating — notas livres na tela',
    subtitle:  'Organize como a sua mente organiza',
    desc:
      'Arraste e redimensione janelas de notas livremente. Ideal para comparar textos, fazer brainstorm ou tomar notas enquanto lê outro conteúdo.',
    tips: [
      { icon: '↕', text: 'Arraste o cabeçalho da janela para mover; arraste qualquer borda para redimensionar.' },
      { icon: '☰', text: 'O ícone ☰ na barra superior abre o painel de lista de notas para criar ou trocar de nota.' },
      { icon: '×', text: 'Clique no × da janela para minimizar ao painel — a nota não é excluída.' },
      { icon: '🖱', text: 'Abra múltiplas janelas para comparar duas notas lado a lado, como abas flutuantes.' },
    ],
    written: [
      'O modo Floating transforma suas notas em janelas flutuantes sobre a área de trabalho, como um gerenciador de janelas pessoal.',
      'Cada janela é uma nota completa com o mesmo editor rico. Você pode ter quantas janelas quiser abertas simultaneamente.',
      'As posições e tamanhos das janelas são salvos automaticamente — na próxima vez que abrir o modo Floating, tudo estará onde você deixou.',
      'Use o painel lateral (☰) para ver todas as suas notas e arrastar novas janelas a partir delas.',
      'Perfeito para pesquisa: cole links, referências e citações em janelas separadas enquanto escreve o documento principal em outra.',
    ],
  },

  /* ── 4 · Spatial ─────────────────────────────────────────────── */
  {
    id:        'spatial',
    label:     'Spatial',
    icon:      '⊹',
    iconColor: '#7dd3a3',
    mode:      'spatial',
    title:     'Spatial — o canvas infinito',
    subtitle:  'Pense no espaço, não só no tempo',
    desc:
      'Posicione notas em um canvas bidimensional e crie mapas visuais de ideias. Perfeito para projetos complexos onde a posição e a proximidade importam.',
    tips: [
      { icon: '🖱', text: 'Scroll do mouse para dar zoom; clique e arraste o fundo para navegar pelo canvas.' },
      { icon: '➕', text: 'Clique duas vezes no canvas para criar uma nova nota diretamente naquele ponto.' },
      { icon: '→',  text: 'Conecte notas com setas: passe o mouse sobre a borda de uma nota e arraste o ponto que aparece.' },
      { icon: '📌', text: 'Notas podem ser minimizadas para pinos — útil para manter muitas ideias sem poluir a visão.' },
    ],
    written: [
      'O Spatial oferece um canvas infinito onde a posição é parte do significado. Notas próximas sugerem relação; notas distantes, separação.',
      'Navegue com scroll para zoom e arraste o fundo para se mover. A navegação é similar à de aplicativos de design como Figma.',
      'Crie conexões visuais entre notas arrastando a partir dos pontos nas bordas das notas — setas aparecem ligando os cartões.',
      'Use clusters de notas para representar projetos, áreas de vida, ou qualquer agrupamento que faça sentido para você.',
      'Dica: use o Spatial para mapear projetos no início — depois, as conexões aparecem automaticamente no Graph.',
    ],
  },

  /* ── 5 · Graph ───────────────────────────────────────────────── */
  {
    id:        'graph',
    label:     'Graph',
    icon:      '◎',
    iconColor: '#c4b6ff',
    mode:      'graph',
    title:     'Graph — sua rede de conhecimento',
    subtitle:  'Veja os padrões do seu pensamento',
    desc:
      'Todas as suas notas visualizadas como nós em uma rede. Conexões surgem automaticamente de backlinks `[[nome]]` e revelam estruturas que você não sabia que existiam.',
    tips: [
      { icon: '[[', text: 'Crie backlinks escrevendo `[[nome da nota]]` em qualquer editor. A conexão aparece no Graph imediatamente.' },
      { icon: '🔍', text: 'Clique em qualquer nó para abrir a nota correspondente sem sair do Graph.' },
      { icon: '⦿',  text: 'Nós maiores são hubs — notas muito conectadas que são centrais no seu pensamento.' },
      { icon: '🎨', text: 'Nós de cores diferentes representam tipos de nota: diário, conceito, projeto, referência.' },
    ],
    written: [
      'O modo Graph transforma backlinks em conexões visuais. Quanto mais você escreve e linka, mais rica fica a rede.',
      'Para criar uma conexão, escreva `[[Nome da Nota]]` em qualquer nota. O Excursus autocompleta enquanto você digita.',
      'O grafo é interativo: arraste nós para reorganizar, use scroll para zoom, clique para abrir a nota.',
      'Com o tempo, o Graph revela clusters de ideias relacionadas, hubs de conhecimento e lacunas no seu pensamento — notas isoladas que precisam de mais conexões.',
      'Use o Graph para descoberta: percorra os nós e releia notas antigas que você esqueceu. Muitas vezes surgem conexões inesperadas.',
    ],
  },

  /* ── 6 · AI ──────────────────────────────────────────────────── */
  {
    id:        'ai',
    label:     'AI',
    icon:      '✦',
    iconColor: '#ff9d77',
    mode:      'ai',
    title:     'AI — sua assistente de ideias',
    subtitle:  'Converse com suas próprias notas',
    desc:
      'Faça perguntas, peça resumos, expanda ideias e explore conexões — tudo com contexto das suas notas. Configure sua chave Gemini nas Configurações para começar.',
    tips: [
      { icon: '🔑', text: 'Configure a chave Gemini API nas Configurações → IA. Você obtém a chave em aistudio.google.com.' },
      { icon: '💬', text: 'Pergunte "o que escrevi sobre [tema] esta semana?" para buscar entre suas notas.' },
      { icon: '✍',  text: 'Peça para expandir uma ideia, reescrever um parágrafo ou criar um esboço a partir de tópicos.' },
      { icon: '🔗', text: 'A IA tem acesso às suas notas mais recentes como contexto — ela sabe o que você escreveu.' },
    ],
    written: [
      'O modo AI usa o modelo Gemini do Google para criar um assistente contextualizado com suas notas.',
      'Para ativar, obtenha uma chave API gratuita em aistudio.google.com e cole nas Configurações → Inteligência Artificial.',
      'A IA tem acesso às suas notas recentes como contexto — ela pode responder perguntas sobre o que você escreveu, fazer resumos e identificar padrões.',
      'Use a IA para: desbloquear escrita travada, resumir notas longas, criar estruturas de projetos, transformar anotações caóticas em documentos organizados.',
      'Privacidade: as notas enviadas à IA são enviadas apenas quando você faz uma pergunta, e somente o contexto relevante é incluído.',
    ],
  },

  /* ── 7 · Zen ─────────────────────────────────────────────────── */
  {
    id:        'zen',
    label:     'Zen',
    icon:      '◌',
    iconColor: '#f0bd8b',
    mode:      'zen',
    title:     'Zen — escrita sem distrações',
    subtitle:  'Só você e as palavras',
    desc:
      'Um modo de escrita imersiva onde a interface desaparece. Fundo neutro, tipografia otimizada, silêncio visual total. Para quando o texto é a única coisa que importa.',
    tips: [
      { icon: '⎋',  text: 'Pressione `Esc` para sair do modo Zen a qualquer momento.' },
      { icon: '📖', text: 'A largura da coluna de texto é limitada para facilitar a leitura — entre 60 e 75 caracteres por linha.' },
      { icon: '🌙', text: 'O modo Zen usa o tema selecionado nas configurações — experimente o tema claro para uma sensação de papel.' },
      { icon: '⏱',  text: 'Perfeito para sessões de escrita cronometradas (método Pomodoro): entre no Zen e escreva sem olhar para nada.' },
    ],
    written: [
      'O modo Zen remove toda a interface — barra de navegação, painéis laterais, menus — deixando apenas o editor e o texto.',
      'A tipografia é otimizada para escrita longa: fonte maior, espaçamento entre linhas maior, largura de coluna confortável.',
      'Você ainda tem acesso a todo o poder do editor (markdown, `/` para blocos, backlinks) — a diferença é visual, não funcional.',
      'Use o modo Zen para: escrever diários, textos longos, cartas, artigos, ou qualquer escrita que exige foco profundo.',
      'Dica: combine Zen com música instrumental e um timer de 25 minutos para sessões de escrita focada (Pomodoro).',
    ],
  },

  /* ── 8 · Atalhos & dicas ─────────────────────────────────────── */
  {
    id:        'shortcuts',
    label:     'Atalhos',
    icon:      '⌨',
    iconColor: '#cec5c1',
    title:     'Atalhos essenciais',
    subtitle:  'Mais velocidade, menos cliques',
    desc:
      'O Excursus foi desenhado para ser usado com o teclado. Esses atalhos vão acelerar drasticamente seu fluxo de trabalho.',
    tips: [
      { icon: '/',    text: '`/` — abre o menu de blocos em qualquer editor.' },
      { icon: '[[',   text: '`[[` — começa um backlink com autocompletar.' },
      { icon: 'Ctrl', text: '`Ctrl + B` negrito · `Ctrl + I` itálico · `Ctrl + K` link.' },
      { icon: '⌥',   text: '`Alt + 1-7` — alterna entre os modos da barra superior.' },
      { icon: '⎋',   text: '`Esc` — sai do modo Zen e fecha modais.' },
      { icon: '↵',   text: '`Enter` em uma lista de tarefas cria o próximo item; `Tab` indenta.' },
    ],
    written: [
      'Os atalhos de teclado são a forma mais rápida de navegar no Excursus.',
      'No editor, `/` é o atalho mais importante: abre o menu de blocos para inserir qualquer tipo de conteúdo.',
      '`[[` inicia um backlink com autocompletar — o Excursus sugere notas existentes enquanto você digita.',
      'Para formatação: `Ctrl+B` (negrito), `Ctrl+I` (itálico), `Ctrl+U` (sublinhado), `Ctrl+K` (link).',
      'Para navegar entre modos: use os botões da barra superior ou os atalhos de teclado correspondentes.',
    ],
  },

  /* ── 9 · Pronto! ─────────────────────────────────────────────── */
  {
    id:        'done',
    label:     'Concluído',
    icon:      '✓',
    iconColor: '#7dd3a3',
    title:     'Você está pronto!',
    subtitle:  'Comece a explorar',
    desc:
      'Você pode rever este tutorial a qualquer momento nas Configurações → Tutorial. Cada modo tem seu guia individual, com versão animada e versão escrita.',
    tips: [
      { icon: '⚙',  text: 'Nas Configurações, personalize tema, fonte, cor de acento e escala de texto.' },
      { icon: '📚', text: 'Guias escritos detalhados estão disponíveis em Configurações → Tutorial.' },
      { icon: '✨', text: 'A primeira nota já está te esperando. Que tal escrever o que você está pensando agora?' },
    ],
    written: [],
  },
]

/* Passos que aparecem na lista de re-assistir nas Settings (exclui welcome e done) */
export const REWATCHABLE_STEPS = TUTORIAL_STEPS.filter(
  s => s.id !== 'welcome' && s.id !== 'done'
)
