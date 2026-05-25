-- ================================================================
-- Seed: notas de teste para validar pg_trgm suggestions
-- Execute no Supabase SQL Editor (Dashboard → SQL Editor)
-- ================================================================

DO $$
DECLARE
  v_uid UUID;
BEGIN
  -- Pega o user_id pelo e-mail
  SELECT id INTO v_uid
  FROM auth.users
  WHERE email = 'assis.christiansales@gmail.com'
  LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado. Verifique o e-mail.';
  END IF;

  -- ── CLUSTER: Programação ──────────────────────────────────────

  INSERT INTO notes (id, user_id, title, folder, content, content_plain, pos_x, pos_y, word_count, created_at, updated_at) VALUES
  (
    'seed-prog-01', v_uid,
    'TypeScript: tipos avançados',
    'dev',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"TypeScript: tipos avançados"}]},{"type":"paragraph","content":[{"type":"text","text":"Tipos avançados no TypeScript permitem criar abstrações poderosas. Union types combinam múltiplos tipos em um. Generics tornam funções e classes reutilizáveis com qualquer tipo. Conditional types permitem inferência baseada em condições em tempo de compilação."}]},{"type":"paragraph","content":[{"type":"text","text":"Utility types como Partial, Required, Pick e Omit são essenciais para manipular interfaces sem duplicar código. Mapped types permitem transformar cada propriedade de um tipo de forma sistemática."}]},{"type":"paragraph","content":[{"type":"text","text":"Template literal types abrem possibilidade de tipos baseados em strings. Discriminated unions são padrão fundamental para modelar estados de forma segura. Type guards refinam o tipo dentro de um bloco condicional."}]}]}',
    'TypeScript tipos avançados Union types combinam múltiplos tipos em um Generics tornam funções e classes reutilizáveis com qualquer tipo Conditional types permitem inferência baseada em condições em tempo de compilação Utility types como Partial Required Pick e Omit são essenciais para manipular interfaces sem duplicar código Mapped types permitem transformar cada propriedade de um tipo de forma sistemática Template literal types abrem possibilidade de tipos baseados em strings Discriminated unions são padrão fundamental para modelar estados de forma segura Type guards refinam o tipo dentro de um bloco condicional',
    100, 100, 98,
    now() - interval '10 days', now() - interval '10 days'
  ),
  (
    'seed-prog-02', v_uid,
    'Padrões de design em React',
    'dev',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Padrões de design em React"}]},{"type":"paragraph","content":[{"type":"text","text":"Compound components permitem criar APIs flexíveis onde os filhos compartilham estado implicitamente com o pai. O padrão render props passou a ser substituído por hooks customizados, que encapsulam lógica de forma mais elegante e composível."}]},{"type":"paragraph","content":[{"type":"text","text":"Context API resolve prop drilling, mas deve ser usada com cuidado para não causar re-renders desnecessários. Zustand e Jotai são alternativas mais leves para gerenciamento de estado global em React."}]},{"type":"paragraph","content":[{"type":"text","text":"O padrão de composição é preferível à herança em React. Componentes pequenos e focados são mais fáceis de testar e reutilizar. Separar lógica de apresentação com hooks customizados melhora a manutenibilidade do código."}]}]}',
    'Padrões de design em React Compound components permitem criar APIs flexíveis onde os filhos compartilham estado implicitamente com o pai render props passou a ser substituído por hooks customizados que encapsulam lógica de forma mais elegante e composível Context API resolve prop drilling mas deve ser usada com cuidado para não causar re-renders desnecessários Zustand e Jotai são alternativas mais leves para gerenciamento de estado global em React O padrão de composição é preferível à herança em React Componentes pequenos e focados são mais fáceis de testar e reutilizar',
    300, 100, 102,
    now() - interval '9 days', now() - interval '9 days'
  ),
  (
    'seed-prog-03', v_uid,
    'Clean Code em JavaScript',
    'dev',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Clean Code em JavaScript"}]},{"type":"paragraph","content":[{"type":"text","text":"Nomes de variáveis e funções devem ser descritivos e revelar intenção. Evite abreviações obscuras. Funções devem fazer uma coisa só e fazê-la bem. Funções pequenas são mais fáceis de testar, reutilizar e entender."}]},{"type":"paragraph","content":[{"type":"text","text":"DRY — Don''t Repeat Yourself — é um princípio central. Mas cuidado com abstrações prematuras: duplicação é melhor que uma abstração errada. YAGNI: não adicione funcionalidade que não é necessária agora."}]},{"type":"paragraph","content":[{"type":"text","text":"Comentários devem explicar o porquê, não o quê. Código limpo se explica por si mesmo. Testes automatizados são a rede de segurança que permite refatorar com confiança. TypeScript ajuda a tornar o código autoexplicativo via tipos."}]}]}',
    'Clean Code JavaScript Nomes de variáveis e funções devem ser descritivos e revelar intenção Evite abreviações obscuras Funções devem fazer uma coisa só e fazê-la bem Funções pequenas são mais fáceis de testar reutilizar e entender DRY Don''t Repeat Yourself é um princípio central cuidado com abstrações prematuras duplicação é melhor que uma abstração errada YAGNI não adicione funcionalidade que não é necessária Comentários devem explicar o porquê não o quê Código limpo se explica por si mesmo Testes automatizados são a rede de segurança TypeScript ajuda a tornar o código autoexplicativo via tipos',
    500, 100, 115,
    now() - interval '8 days', now() - interval '8 days'
  ),
  (
    'seed-prog-04', v_uid,
    'Performance em React: memo e otimizações',
    'dev',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Performance em React: memo e otimizações"}]},{"type":"paragraph","content":[{"type":"text","text":"React.memo previne re-renders desnecessários em componentes funcionais quando as props não mudam. useMemo memoriza valores computacionalmente caros. useCallback estabiliza referências de funções passadas como props para componentes memorizados."}]},{"type":"paragraph","content":[{"type":"text","text":"Antes de otimizar, meça. Use o React Profiler para identificar gargalos reais. Otimização prematura gera código mais complexo sem necessidade. A maioria dos problemas de performance vem de renderizações em cascata no topo da árvore de componentes."}]},{"type":"paragraph","content":[{"type":"text","text":"Code splitting com React.lazy e Suspense reduz o bundle inicial. Virtualização de listas longas com react-window evita renderizar elementos fora da viewport. Imagens com lazy loading e formatos modernos como WebP melhoram o LCP."}]}]}',
    'Performance React memo otimizações React.memo previne re-renders desnecessários em componentes funcionais quando as props não mudam useMemo memoriza valores computacionalmente caros useCallback estabiliza referências de funções passadas como props Antes de otimizar meça Use o React Profiler para identificar gargalos reais Otimização prematura gera código mais complexo sem necessidade Code splitting com React.lazy e Suspense reduz o bundle inicial Virtualização de listas longas com react-window evita renderizar elementos fora da viewport',
    700, 100, 108,
    now() - interval '7 days', now() - interval '7 days'
  ),
  (
    'seed-prog-05', v_uid,
    'Arquitetura de estado com Zustand',
    'dev',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Arquitetura de estado com Zustand"}]},{"type":"paragraph","content":[{"type":"text","text":"Zustand é uma solução minimalista de gerenciamento de estado global para React. Sem boilerplate de Redux, sem providers gigantes. O estado é um objeto simples com ações e o componente só re-renderiza quando o slice que ele usa muda."}]},{"type":"paragraph","content":[{"type":"text","text":"Middleware persist sincroniza o estado com localStorage automaticamente. O middleware devtools conecta ao Redux DevTools para debug. Slices permitem dividir o estado em domínios sem criar múltiplos stores."}]},{"type":"paragraph","content":[{"type":"text","text":"Zustand funciona fora de componentes React: qualquer função pode ler ou escrever no estado via getState() e setState(). Isso é ideal para integrar com bibliotecas externas ou lógica assíncrona que não vive em hooks."}]}]}',
    'Arquitetura estado Zustand solução minimalista gerenciamento de estado global React Sem boilerplate de Redux sem providers gigantes O estado é um objeto simples com ações e o componente só re-renderiza quando o slice que ele usa muda Middleware persist sincroniza o estado com localStorage automaticamente O middleware devtools conecta ao Redux DevTools para debug Slices permitem dividir o estado em domínios Zustand funciona fora de componentes React qualquer função pode ler ou escrever no estado via getState e setState',
    900, 100, 112,
    now() - interval '6 days', now() - interval '6 days'
  ),

  -- ── CLUSTER: Produtividade ────────────────────────────────────

  (
    'seed-prod-01', v_uid,
    'Sistema Zettelkasten',
    'produtividade',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Sistema Zettelkasten"}]},{"type":"paragraph","content":[{"type":"text","text":"Zettelkasten é um método de gerenciamento de conhecimento pessoal criado por Niklas Luhmann. A ideia central é capturar ideias em notas atômicas — uma ideia por nota — e conectá-las com links explícitos. A rede de conexões é mais valiosa que qualquer nota individual."}]},{"type":"paragraph","content":[{"type":"text","text":"Notas de literatura capturam ideias de livros e artigos em suas próprias palavras. Notas permanentes sintetizam o que você realmente pensa sobre o assunto. O índice é o ponto de entrada para navegar pelo sistema."}]},{"type":"paragraph","content":[{"type":"text","text":"O poder do Zettelkasten emerge com o tempo: conexões inesperadas entre domínios diferentes geram insights que nenhuma nota isolada produziria. É um método de pensar, não apenas de armazenar informação."}]}]}',
    'Sistema Zettelkasten método de gerenciamento de conhecimento pessoal criado por Niklas Luhmann A ideia central é capturar ideias em notas atômicas uma ideia por nota e conectá-las com links explícitos A rede de conexões é mais valiosa que qualquer nota individual Notas de literatura capturam ideias de livros e artigos em suas próprias palavras Notas permanentes sintetizam o que você realmente pensa sobre o assunto O índice é o ponto de entrada para navegar pelo sistema O poder do Zettelkasten emerge com o tempo conexões inesperadas entre domínios diferentes geram insights',
    100, 400, 118,
    now() - interval '15 days', now() - interval '15 days'
  ),
  (
    'seed-prod-02', v_uid,
    'Deep Work — Cal Newport',
    'produtividade',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Deep Work — Cal Newport"}]},{"type":"paragraph","content":[{"type":"text","text":"Deep work é a capacidade de se concentrar sem distração em uma tarefa cognitivamente exigente. É uma habilidade que está ficando cada vez mais rara e ao mesmo tempo mais valiosa. Shallow work são tarefas logísticas que não exigem concentração intensa."}]},{"type":"paragraph","content":[{"type":"text","text":"Quatro filosofias de deep work: monástica (eliminar o raso completamente), bimodal (alternar períodos longos de foco), rítmica (horário fixo diário de trabalho profundo), jornalística (encaixar onde der). Para a maioria, a rítmica funciona melhor."}]},{"type":"paragraph","content":[{"type":"text","text":"Protocolos práticos: escolha um local dedicado, defina horário e duração, elimine internet e notificações, registre o progresso. Construa rituais que sinalizam ao cérebro que é hora de focar. A capacidade de foco se desenvolve como músculo com prática deliberada."}]}]}',
    'Deep Work Cal Newport capacidade de se concentrar sem distração em uma tarefa cognitivamente exigente habilidade que está ficando cada vez mais rara e ao mesmo tempo mais valiosa Shallow work são tarefas logísticas que não exigem concentração intensa Quatro filosofias de deep work monástica bimodal rítmica jornalística Para a maioria a rítmica funciona melhor Protocolos práticos escolha um local dedicado defina horário e duração elimine internet e notificações registre o progresso Construa rituais que sinalizam ao cérebro que é hora de focar',
    300, 400, 124,
    now() - interval '14 days', now() - interval '14 days'
  ),
  (
    'seed-prod-03', v_uid,
    'Hábitos Atômicos — James Clear',
    'produtividade',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Hábitos Atômicos — James Clear"}]},{"type":"paragraph","content":[{"type":"text","text":"Melhorar 1% por dia resulta em 37x de melhora em um ano. Piora de 1% por dia leva a quase zero. Pequenas melhorias consistentes superam grandes transformações esporádicas. Sistemas batem metas: em vez de focar no objetivo, foque no processo que leva a ele."}]},{"type":"paragraph","content":[{"type":"text","text":"As quatro leis para criar hábitos: tornar óbvio (gatilho), tornar atrativo (desejo), tornar fácil (resposta), tornar satisfatório (recompensa). Para quebrar hábitos ruins, inverta as quatro leis. Habit stacking: anexe o novo hábito a um existente."}]},{"type":"paragraph","content":[{"type":"text","text":"Identidade e hábitos estão conectados: cada ação é um voto para o tipo de pessoa que você quer ser. Em vez de ''quero correr uma maratona'', pense ''sou uma pessoa que corre''. Mudança de identidade sustenta hábitos de longo prazo melhor do que motivação."}]}]}',
    'Hábitos Atômicos James Clear Melhorar 1% por dia resulta em 37x de melhora em um ano Pequenas melhorias consistentes superam grandes transformações esporádicas Sistemas batem metas em vez de focar no objetivo foque no processo As quatro leis para criar hábitos tornar óbvio tornar atrativo tornar fácil tornar satisfatório Para quebrar hábitos ruins inverta as quatro leis Habit stacking anexe o novo hábito a um existente Identidade e hábitos estão conectados cada ação é um voto para o tipo de pessoa que você quer ser mudança de identidade sustenta hábitos de longo prazo',
    500, 400, 130,
    now() - interval '12 days', now() - interval '12 days'
  ),
  (
    'seed-prod-04', v_uid,
    'PKM: capturar, processar, conectar',
    'produtividade',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"PKM: capturar, processar, conectar"}]},{"type":"paragraph","content":[{"type":"text","text":"Personal Knowledge Management é o conjunto de práticas para capturar, organizar e usar informação de forma intencional. O fluxo básico: capturar tudo que parece relevante, processar regularmente separando o útil do ruído, conectar novas ideias às existentes."}]},{"type":"paragraph","content":[{"type":"text","text":"A caixa de entrada (inbox) é temporária — todo item capturado deve ser processado e movido. Notas devem ser escritas com suas próprias palavras, não copiadas. O processo de reescrever consolida o aprendizado e torna a nota realmente sua."}]},{"type":"paragraph","content":[{"type":"text","text":"Ferramentas são secundárias. O que importa é o hábito de revisar, conectar e usar o que você sabe. Uma nota que nunca é relida ou conectada não vale o tempo de escrevê-la. O sistema deve gerar saídas: projetos, decisões, textos, aprendizados."}]}]}',
    'PKM Personal Knowledge Management conjunto de práticas para capturar organizar e usar informação de forma intencional O fluxo básico capturar tudo que parece relevante processar regularmente separando o útil do ruído conectar novas ideias às existentes A caixa de entrada inbox é temporária todo item capturado deve ser processado e movido Notas devem ser escritas com suas próprias palavras não copiadas O processo de reescrever consolida o aprendizado Uma nota que nunca é relida ou conectada não vale o tempo de escrevê-la',
    700, 400, 126,
    now() - interval '11 days', now() - interval '11 days'
  ),
  (
    'seed-prod-05', v_uid,
    'Time blocking e Pomodoro',
    'produtividade',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Time blocking e Pomodoro"}]},{"type":"paragraph","content":[{"type":"text","text":"Time blocking é reservar blocos de tempo no calendário para tarefas específicas antes do dia começar. Elimina a decisão de ''o que fazer agora'' e protege o tempo de trabalho profundo. Cal Newport usa time blocking de forma extrema, planejando cada minuto do dia."}]},{"type":"paragraph","content":[{"type":"text","text":"Pomodoro: 25 minutos de foco total, 5 minutos de pausa. Após 4 pomodoros, pausa longa de 15-30 minutos. A restrição de tempo cria urgência artificial que ajuda a começar. O mais difícil em qualquer tarefa é começar — o Pomodoro resolve isso."}]},{"type":"paragraph","content":[{"type":"text","text":"Combine as duas técnicas: time blocking define quando e o quê, Pomodoro define como. Time blocking funciona melhor para planejamento semanal. Pomodoro funciona melhor na execução diária. Juntos cobrem planejamento e foco na execução."}]}]}',
    'Time blocking Pomodoro reservar blocos de tempo no calendário para tarefas específicas antes do dia começar Elimina a decisão de o que fazer agora e protege o tempo de trabalho profundo Pomodoro 25 minutos de foco total 5 minutos de pausa Após 4 pomodoros pausa longa de 15-30 minutos A restrição de tempo cria urgência artificial que ajuda a começar O mais difícil em qualquer tarefa é começar Combine as duas técnicas time blocking define quando e o quê Pomodoro define como',
    900, 400, 119,
    now() - interval '10 days', now() - interval '10 days'
  ),

  -- ── CLUSTER: Saúde e bem-estar ───────────────────────────────

  (
    'seed-saude-01', v_uid,
    'Sono e performance cognitiva',
    'saude',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Sono e performance cognitiva"}]},{"type":"paragraph","content":[{"type":"text","text":"O sono é o pilar mais subestimado da saúde e da performance. Durante o sono, o cérebro consolida memórias, elimina toxinas via sistema glinfático e restaura a capacidade de concentração. Dormir menos de 7h reduz performance cognitiva de forma mensurável."}]},{"type":"paragraph","content":[{"type":"text","text":"Ritmo circadiano: o corpo tem um relógio biológico sincronizado pela luz. Exposição a luz natural pela manhã e escuridão à noite regula produção de melatonina. Temperatura corporal cai ao adormecer — quarto fresco facilita o sono."}]},{"type":"paragraph","content":[{"type":"text","text":"Higiene do sono: horário consistente mesmo nos fins de semana, sem telas 1h antes de dormir, sem cafeína após 14h, quarto escuro e silencioso. Uma noite de sono ruim recupera-se; privação crônica acumula dívida que não se paga com um fim de semana."}]}]}',
    'Sono performance cognitiva pilar mais subestimado da saúde e da performance Durante o sono o cérebro consolida memórias elimina toxinas via sistema glinfático e restaura a capacidade de concentração Dormir menos de 7h reduz performance cognitiva de forma mensurável Ritmo circadiano o corpo tem um relógio biológico sincronizado pela luz Exposição a luz natural pela manhã e escuridão à noite regula produção de melatonina Temperatura corporal cai ao adormecer quarto fresco facilita o sono Higiene do sono horário consistente mesmo nos fins de semana sem telas 1h antes de dormir sem cafeína após 14h',
    100, 700, 122,
    now() - interval '20 days', now() - interval '20 days'
  ),
  (
    'seed-saude-02', v_uid,
    'Exercício aeróbico e saúde mental',
    'saude',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Exercício aeróbico e saúde mental"}]},{"type":"paragraph","content":[{"type":"text","text":"Exercício aeróbico tem efeito antidepressivo comprovado comparável a medicação em casos leves a moderados. A corrida, ciclismo e natação elevam serotonina, dopamina e BDNF — fator neurotrófico que promove crescimento de neurônios no hipocampo."}]},{"type":"paragraph","content":[{"type":"text","text":"150 minutos de exercício moderado por semana é a recomendação mínima da OMS. 30 minutos de caminhada rápida diária já gera benefícios cognitivos significativos. A consistência supera a intensidade — melhor caminhar todo dia do que malhar intenso uma vez por semana."}]},{"type":"paragraph","content":[{"type":"text","text":"O efeito imediato do exercício no humor dura 2-4 horas. Exercício pela manhã melhora foco e humor o dia todo. Exercício ao ar livre adiciona benefícios da exposição à luz natural e ao contato com a natureza. Criar o hábito é mais difícil que manter."}]}]}',
    'Exercício aeróbico saúde mental efeito antidepressivo comprovado comparável a medicação em casos leves a moderados A corrida ciclismo e natação elevam serotonina dopamina e BDNF fator neurotrófico que promove crescimento de neurônios no hipocampo 150 minutos de exercício moderado por semana é a recomendação mínima da OMS 30 minutos de caminhada rápida diária já gera benefícios cognitivos significativos A consistência supera a intensidade melhor caminhar todo dia do que malhar intenso uma vez por semana O efeito imediato do exercício no humor dura 2-4 horas',
    300, 700, 120,
    now() - interval '18 days', now() - interval '18 days'
  ),
  (
    'seed-saude-03', v_uid,
    'Nutrição, foco e energia',
    'saude',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Nutrição, foco e energia"}]},{"type":"paragraph","content":[{"type":"text","text":"O cérebro consome 20% da energia do corpo apesar de ser 2% da massa. Glicose é o combustível primário, mas picos e quedas bruscas causam névoa mental. Carboidratos complexos, proteínas e gorduras saudáveis fornecem energia estável."}]},{"type":"paragraph","content":[{"type":"text","text":"Desidratação leve de 1-2% já prejudica concentração e memória de trabalho. Beber água consistentemente ao longo do dia é a otimização cognitiva mais barata possível. Cafeína bloqueia receptores de adenosina — por isso dá sensação de alerta, mas não elimina a fadiga real."}]},{"type":"paragraph","content":[{"type":"text","text":"Alimentos que favorecem foco: nozes, peixes gordurosos (ômega-3), ovos (colina), folhas verdes escuras, frutas vermelhas (antioxidantes). Jejum intermitente pode melhorar foco em algumas pessoas via cetose leve, mas não é universal. Comer levemente antes de trabalho cognitivo intenso reduz o efeito de letargia pós-refeição."}]}]}',
    'Nutrição foco energia O cérebro consome 20% da energia do corpo apesar de ser 2% da massa Glicose é o combustível primário mas picos e quedas bruscas causam névoa mental Carboidratos complexos proteínas e gorduras saudáveis fornecem energia estável Desidratação leve de 1-2% já prejudica concentração e memória de trabalho Beber água consistentemente ao longo do dia é a otimização cognitiva mais barata possível Cafeína bloqueia receptores de adenosina Alimentos que favorecem foco nozes peixes gordurosos ômega-3 ovos colina folhas verdes escuras frutas vermelhas antioxidantes',
    500, 700, 128,
    now() - interval '16 days', now() - interval '16 days'
  ),
  (
    'seed-saude-04', v_uid,
    'Meditação e gestão do estresse',
    'saude',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Meditação e gestão do estresse"}]},{"type":"paragraph","content":[{"type":"text","text":"Meditação mindfulness treina a atenção a retornar ao momento presente sem julgamento. 10 minutos diários de prática consistente, após 8 semanas, mostram mudanças mensuráveis na densidade da matéria cinzenta do córtex pré-frontal."}]},{"type":"paragraph","content":[{"type":"text","text":"Estresse crônico eleva cortisol, prejudica memória, sono e sistema imunológico. A resposta de relaxamento é a antítese fisiológica do estresse — pode ser ativada por respiração profunda, meditação, exercício e contato social positivo."}]},{"type":"paragraph","content":[{"type":"text","text":"Para começar: use apps como Headspace ou Insight Timer, comece com 5 minutos, prefira a manhã quando a mente ainda está mais tranquila. Não existe meditação errada — o julgamento sobre estar meditando mal é parte do que a prática treina a soltar."}]}]}',
    'Meditação gestão do estresse mindfulness treina a atenção a retornar ao momento presente sem julgamento 10 minutos diários de prática consistente após 8 semanas mostram mudanças mensuráveis na densidade da matéria cinzenta do córtex pré-frontal Estresse crônico eleva cortisol prejudica memória sono e sistema imunológico A resposta de relaxamento é a antítese fisiológica do estresse pode ser ativada por respiração profunda meditação exercício e contato social positivo Para começar use apps como Headspace ou Insight Timer comece com 5 minutos prefira a manhã',
    700, 700, 116,
    now() - interval '14 days', now() - interval '14 days'
  ),
  (
    'seed-saude-05', v_uid,
    'Rotina matinal e compound effect',
    'saude',
    '{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Rotina matinal e compound effect"}]},{"type":"paragraph","content":[{"type":"text","text":"A manhã é o único período do dia que ninguém vai tomar de você. Decisões são recursos escassos — gastar as primeiras horas em atividades que você escolheu (exercício, leitura, escrita) antes de responder às demandas externas protege o que é mais importante."}]},{"type":"paragraph","content":[{"type":"text","text":"Compound effect: pequenas ações consistentes compostas ao longo do tempo geram resultados desproporcionais. Ler 20 páginas por dia são 7.000 páginas por ano — cerca de 20 a 30 livros. Escrever 200 palavras por dia são 73.000 palavras por ano — um livro."}]},{"type":"paragraph","content":[{"type":"text","text":"Rotina matinal sugerida: acordar sem alarme (significa ir dormir cedo), luz solar nos primeiros 30 minutos, movimento físico, não checar celular por pelo menos 1 hora. O objetivo não é uma rotina perfeita, mas criar um campo de proteção antes do mundo entrar."}]}]}',
    'Rotina matinal compound effect A manhã é o único período do dia que ninguém vai tomar de você Decisões são recursos escassos gastar as primeiras horas em atividades que você escolheu exercício leitura escrita antes de responder às demandas externas Compound effect pequenas ações consistentes compostas ao longo do tempo geram resultados desproporcionais Ler 20 páginas por dia são 7.000 páginas por ano cerca de 20 a 30 livros Escrever 200 palavras por dia são 73.000 palavras por ano Rotina matinal sugerida acordar sem alarme luz solar nos primeiros 30 minutos movimento físico não checar celular',
    900, 700, 134,
    now() - interval '13 days', now() - interval '13 days'
  )
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Notas inseridas com sucesso para o usuário %', v_uid;
END $$;
