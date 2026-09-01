/**
 * O manual da plataforma, como dado.
 *
 * Fica em um arquivo só, e não espalhado em JSX, por dois motivos: a busca
 * precisa varrer o texto inteiro (o que só dá para fazer se o texto for
 * string), e quem for corrigir uma frase amanhã não deveria precisar entender
 * React para isso.
 *
 * Cada tópico tem blocos. Os tipos são: "p" (parágrafo), "ul" (lista),
 * "ol" (lista numerada), "nota" (aviso destacado) e "tab" (tabela, a primeira
 * linha é o cabeçalho).
 */

export const MANUAL = [
  /* ── Começar ───────────────────────────────────────────────────────────── */
  {
    id: "o-que-e",
    grupo: "Começar",
    titulo: "O que é a Pauta",
    corpo: [
      ["p", "A Pauta é a substituta da planilha. Ela mostra, em uma tela só, tudo o que a criação tem para entregar: o que entrou, de qual cliente, quem está tocando, quanto esforço tem no dia e o que sai hoje."],
      ["p", "Ela não substitui o Azure. O Azure continua sendo onde o card nasce e onde o estado do trabalho é registrado — a Pauta espelha isso e acrescenta o que o Azure não guarda: demandante, tipo, status interno, hora combinada de entrega, número de artes, observação, motivo de pausa e motivo de cancelamento."],
      ["nota", "Regra que explica quase tudo: se a informação existe no card, quem manda é o card. A plataforma só cuida do que é dela."],
    ],
  },
  {
    id: "entrar",
    grupo: "Começar",
    titulo: "Entrar, sair e o que cada papel pode fazer",
    corpo: [
      ["p", "O botão no canto direito do cabeçalho mostra em que pé você está. Sem login, ele diz “Só leitura”: dá para ver tudo, mas nada é editável. Depois de entrar, ele passa a mostrar seu usuário."],
      ["tab", [
        ["Papel", "O que pode fazer"],
        ["Leitor", "Ver a pauta, os relatórios, as réguas, os parados e os cancelados. Não altera nada."],
        ["Editor", "Tudo o que o leitor faz, mais editar as linhas, criar e apagar pedidos, mexer nos cadastros e abrir o confronto com o Azure."],
        ["Admin", "Tudo o que o editor faz, mais editar as tabelas de referência, ver o histórico de alterações e mudar o papel das outras pessoas."],
      ]],
      ["p", "O login é por usuário e senha. Se esquecer a senha, o próprio modal de login manda o e-mail de recuperação — o endereço fica guardado no servidor e nunca aparece na tela."],
    ],
  },
  {
    id: "tema-zoom",
    grupo: "Começar",
    titulo: "Tema, zoom e o que fica salvo no seu navegador",
    corpo: [
      ["p", "O botão ◐ alterna entre tema claro e escuro. Ao lado dele fica o zoom: use − e + para encolher ou aumentar a página inteira até que todas as colunas caibam na sua tela. Clicar no número volta para 100%."],
      ["p", "Algumas preferências ficam guardadas só no seu navegador, e por isso não acompanham você em outro computador:"],
      ["ul", [
        "o tema claro ou escuro,",
        "o nível de zoom,",
        "a largura de cada coluna,",
        "por qual coluna a grade está ordenada,",
        "quais blocos do relatório estão ligados,",
        "o apelido de bicho que aparece para os colegas quando você está online.",
      ]],
      ["nota", "Limpar os dados do site apaga essas preferências. Nada da pauta em si se perde — isso está no banco."],
    ],
  },

  /* ── A pauta ───────────────────────────────────────────────────────────── */
  {
    id: "grade",
    grupo: "A pauta",
    titulo: "A grade e suas colunas",
    corpo: [
      ["p", "A grade é o centro da plataforma. Cada linha é um pedido; cada coluna, um pedaço da informação."],
      ["tab", [
        ["Coluna", "O que é"],
        ["📅 Solicitação", "Quando o pedido entrou."],
        ["Link Azure", "O número do card, clicável. Quando a linha ainda não tem card, aqui aparece o campo de colar o link."],
        ["📁", "O código da pasta e o link do SharePoint, extraídos da descrição do card."],
        ["Cliente", "Vem do campo Campanha do card."],
        ["Demandante", "Quem pediu. É da plataforma."],
        ["Pedido", "O título do card."],
        ["🎨", "Quantidade de artes. É da plataforma e começa em 0."],
        ["⚡️", "Esforço. Vem do campo Effort do card."],
        ["Tipo", "Classificação da casa (campanha, ajuste, régua, fura-fila…)."],
        ["📅 Entrega", "A data de entrega do card. É ela que decide em qual aba de mês a linha aparece."],
        ["🔵 Azure", "O estado do card no Azure."],
        ["🟠 Interno", "O status da casa, que é o que move as áreas de Parados e Cancelados."],
        ["🕐 Entrega", "A hora combinada da entrega. É o que o cliente vê na visão dele."],
        ["✓ Check", "Marca a linha como entregue."],
        ["Recurso", "Quem está tocando, pelo apelido curto. Vem do card."],
        ["📝 Obs", "Campo livre da casa."],
      ]],
    ],
  },
  {
    id: "quem-manda",
    grupo: "A pauta",
    titulo: "Quem manda em cada coluna",
    corpo: [
      ["p", "Metade das colunas é do Azure e metade é da plataforma. Saber de quem é cada uma evita a maior parte das dúvidas."],
      ["p", "As colunas do Azure aparecem com o cabeçalho em tom diferente e não são editáveis na tela. Se o valor está errado, o lugar de corrigir é o card: na sincronização seguinte a pauta se acerta sozinha."],
      ["ul", [
        "Do Azure: Cliente, Pedido, 📁 Pasta, 📅 Entrega, ⚡️ Esforço, 🔵 Azure e Recurso.",
        "Da plataforma: Demandante, 🎨 artes, Tipo, 🟠 Interno, 🕐 Entrega, ✓ Check, 📝 Obs, e os motivos de pausa e cancelamento.",
      ]],
      ["nota", "O sync nunca sobrescreve o que é da casa. Pode rodar quantas vezes for: observação, status interno e hora combinada não se perdem."],
    ],
  },
  {
    id: "novo-pedido",
    grupo: "A pauta",
    titulo: "Colocar um pedido novo na pauta",
    corpo: [
      ["p", "A primeira linha da grade é sempre a linha nova. Existem dois caminhos, e a diferença entre eles é se o card já existe."],
      ["ol", [
        "Já tem card: cole o link (ou só o número) no campo “Colar link card”. A linha se preenche sozinha com título, cliente, entrega, esforço e responsável.",
        "Ainda não tem card: escreva o nome no campo “Iniciar pedido” e aperte Enter. A linha entra marcada em vermelho, porque está incompleta.",
      ]],
      ["p", "Na linha vermelha aparece um atalho “↗ card”, que abre o formulário de card novo no Azure já com o título preenchido. Depois de criar o card, volte e cole o link no mesmo lugar: a linha deixa de ser vermelha e passa a receber as atualizações do sync."],
    ],
  },
  {
    id: "cores",
    grupo: "A pauta",
    titulo: "O que a cor de cada linha quer dizer",
    corpo: [
      ["p", "A cor de fundo da linha é um aviso, e cada uma pede uma coisa diferente de você."],
      ["tab", [
        ["Cor", "Situação", "O que ela está pedindo"],
        ["Rosa", "Fura-fila", "Ação agora. É o destaque mais forte e passa na frente de qualquer outro."],
        ["Vermelho", "Pedido ainda sem card", "Alguém precisa criar o card e colar o link."],
        ["Cinza", "Parado ou cancelado", "Nada. A linha saiu do fluxo e está ali só para não sumir de vista."],
        ["Riscado", "Cancelado", "É o que separa o cancelado do parado, já que os dois são cinza."],
        ["Apagada", "Entregue", "Já foi. Passar o mouse traz o texto de volta."],
      ]],
      ["nota", "Quando uma linha é duas coisas ao mesmo tempo, vence a mais urgente: fura-fila ganha de tudo."],
    ],
  },
  {
    id: "meses",
    grupo: "A pauta",
    titulo: "As abas de mês",
    corpo: [
      ["p", "As abas no alto separam a pauta por mês, e o número ao lado do nome é quantos pedidos há em cada um. Os meses mais antigos ficam recolhidos na caixinha “Anteriores”."],
      ["nota", "Quem decide o mês é a data de ENTREGA do card. Um pedido que chegou em agosto mas entrega em setembro aparece em setembro. Só quando o card ainda não tem data de entrega é que vale a data de solicitação."],
      ["p", "É por isso que uma linha às vezes “muda de aba” sozinha: alguém mexeu na data de entrega do card no Azure."],
    ],
  },
  {
    id: "filtros",
    grupo: "A pauta",
    titulo: "Filtrar, buscar e ordenar",
    corpo: [
      ["p", "A barra logo abaixo do cabeçalho tem filtros de cliente, demandante, tipo, status interno e recurso, mais um campo de busca livre que procura no título do pedido. Os filtros se somam, e o botão “limpar” zera todos de uma vez."],
      ["p", "Para ordenar, clique no cabeçalho da coluna. O primeiro clique ordena; o segundo inverte. A setinha mostra qual coluna está mandando. A ordenação escolhida fica salva para a próxima vez que você abrir."],
      ["p", "O contador à direita da barra diz quantas linhas você está vendo — e, quando há filtro, quantas de quantas."],
    ],
  },
  {
    id: "larguras",
    grupo: "A pauta",
    titulo: "Mudar a largura das colunas",
    corpo: [
      ["p", "Arraste a borda direita do cabeçalho de qualquer coluna para alargá-la ou encolhê-la. A largura fica salva no seu navegador e vale para as próximas visitas."],
      ["p", "Se mesmo assim faltar espaço, use o zoom no cabeçalho: ele encolhe a página inteira e costuma resolver melhor do que espremer coluna por coluna."],
    ],
  },
  {
    id: "topo",
    grupo: "A pauta",
    titulo: "O resumo e o medidor de esforço",
    corpo: [
      ["p", "No alto da pauta ficam duas coisas. À esquerda, o resumo do mês: quantos pedidos entraram, quantos estão em produção e quantos já saíram. À direita, o medidor de esforço."],
      ["p", "O medidor mostra, para cada pessoa, a soma do esforço dos cards que estão EM PAUTA ou EM DESENVOLVIMENTO no Azure — o que ela tem em mão: o que já foi combinado com ela mais o que está fazendo agora. Card em refinamento ainda não é de ninguém, e card entregue já saiu da conta."],
      ["p", "A barra enche em 10, que é o dia cheio de uma pessoa. Como a conta é da fila inteira, e não do dia, passar de uma barra cheia é o normal de quem tem trabalho combinado para os próximos dias — o que a barra mostra é quem está com muito mais em mão do que os outros."],
      ["p", "Passando de 10, o número e a barra ficam vermelhos: é sinal de que a fila daquela pessoa já passa de um dia de trabalho."],
      ["nota", "Quem aparece no medidor é escolhido no Admin, em Recursos, pela caixinha “medidor”. Ninguém entra ou sai dali por código."],
    ],
  },

  /* ── Contagem ──────────────────────────────────────────────────────────── */
  {
    id: "pecas",
    grupo: "Contagem",
    titulo: "Como contar o número de peças",
    corpo: [
      ["p", "O botão 🎨 do cabeçalho abre a tabela de referência com todos os casos: o que conta como uma peça, o que conta como zero e o que soma uma a mais."],
      ["p", "Os casos que mais geram dúvida:"],
      ["ul", [
        "Ajuste de layout ou de imagem conta 0 — não é peça nova.",
        "Refação conta +1: quando o cliente muda o direcionamento, ou o ajuste passa de 60% da peça, virou trabalho novo.",
        "Arte com desdobramento (mesma imagem, texto parecido) conta 1, e não uma por formato.",
        "Enxoval conta +1, porque são formatos, imagens e textos diferentes.",
      ]],
      ["p", "Quem é admin edita essa tabela direto no modal, e a mudança vale para todo mundo na hora."],
    ],
  },
  {
    id: "esforco",
    grupo: "Contagem",
    titulo: "A escala de esforço",
    corpo: [
      ["p", "O botão ⚡️ do cabeçalho abre a tabela que traduz cada nível de esforço em tipo de atividade e em tempo. O valor em si vem do campo Effort do card, no Azure — a pauta só mostra."],
      ["tab", [
        ["Effort", "Mais ou menos isto"],
        ["1", "Ajuste simples, adaptação de peça existente. De 15 minutos a 1 hora."],
        ["2", "Arte estática com briefing claro, revisão de peça pronta. De 1 a 4 horas."],
        ["3", "Nova peça com redação e layout, variações de campanha. De 4 a 8 horas."],
        ["4", "Conceito criativo ou nova identidade. De 1 a 3 dias úteis."],
        ["5", "Campanha completa do zero. De 3 a 5 dias úteis."],
      ]],
      ["nota", "O medidor do topo enche em 10, que é um dia cheio. Ele soma os cards EM PAUTA e EM DESENVOLVIMENTO de cada pessoa, então mostra a fila dela — não só o dia de hoje."],
    ],
  },

  /* ── Outras áreas ──────────────────────────────────────────────────────── */
  {
    id: "parados",
    grupo: "Outras áreas",
    titulo: "Parados",
    corpo: [
      ["p", "O botão “Parados”, na barra de filtros, abre a lista dos pedidos cujo status interno está marcado como pausa. Não existe cadastro separado: é a mesma linha da pauta, vista de outro ângulo. Trocar o status na grade faz a linha aparecer aqui sozinha."],
      ["p", "A coluna “Motivo da pausa” só existe nesta tela e é onde se escreve por que o pedido parou."],
      ["p", "A bolinha ao lado do nome do botão conta os parados SEM motivo preenchido. O ideal é que ela viva em zero."],
    ],
  },
  {
    id: "cancelados",
    grupo: "Outras áreas",
    titulo: "Cancelados",
    corpo: [
      ["p", "Funciona igual aos Parados, com o status marcado como cancelamento e a coluna “Motivo do cancelamento”."],
      ["p", "Cancelar não apaga. A linha continua na pauta, em cinza e com o título riscado, e continua contando nos relatórios — que é justamente onde dá para ver quanto trabalho foi cancelado e por quem."],
    ],
  },
  {
    id: "reguas",
    grupo: "Outras áreas",
    titulo: "Réguas",
    corpo: [
      ["p", "As réguas são uma área à parte, com tabela própria. Nada aqui vem do Azure: tudo é escrito à mão."],
      ["p", "Cada régua tem cliente, nome, um link (SharePoint, card ou documento), um status próprio — No radar, Em produção ou Finalizado — e um campo de observação."],
      ["p", "As duas bolinhas do botão mostram quantas réguas estão no radar (amarela) e quantas estão em produção (azul)."],
    ],
  },
  {
    id: "relatorios",
    grupo: "Outras áreas",
    titulo: "Relatórios e exportação",
    corpo: [
      ["p", "O botão 📊 Relatórios abre a área de números do mês selecionado: indicadores no topo, uma dúzia de gráficos e algumas tabelas de resumo."],
      ["p", "Cada bloco pode ser ligado e desligado. O que está ligado é ao mesmo tempo o que aparece na tela e o que sai na exportação — de propósito, para o arquivo nunca discordar do que você estava vendo."],
      ["p", "Há filtros de cliente, período, recurso e demandante. A exportação em CSV abre direto no Excel."],
      ["nota", "Exportar em PPT e em PDF ainda não está pronto: os botões existem, mas avisam que a função não foi ligada."],
    ],
  },
  {
    id: "azure",
    grupo: "Outras áreas",
    titulo: "Confronto com o Azure",
    corpo: [
      ["p", "O botão ⚖ Azure responde a uma pergunta só: existe algum card aberto no Azure que não está na pauta?"],
      ["p", "A tela lista os cards do tipo Criação que não estão em estado final e que não têm linha correspondente aqui. Dá para filtrar e ordenar, e cada item tem um atalho para trazer o card para a pauta na hora."],
      ["p", "A bolinha vermelha no botão é quantos cards estão nessa situação. Zero é o número certo."],
    ],
  },
  {
    id: "cliente",
    grupo: "Outras áreas",
    titulo: "A visão do cliente",
    corpo: [
      ["p", "É uma página pública, sem login, que mostra ao cliente só o que interessa a ele: as entregas combinadas para hoje e para os sete dias seguintes, com data, hora e quem pediu."],
      ["p", "O botão de cliente no cabeçalho abre a tela de escolha em uma guia nova. Escolhido o cliente, o endereço passa a ter o nome dele — e é esse endereço, e não o da escolha, que se manda para fora."],
      ["p", "A página se atualiza sozinha a cada minuto. Status interno, recurso, tipo, esforço e observação não passam por ali."],
      ["nota", "A separação entre clientes é da tela, não do banco. Trate o link como algo que se manda a uma pessoa, e não como um cofre."],
    ],
  },
  {
    id: "presenca",
    grupo: "Outras áreas",
    titulo: "Quem está online",
    corpo: [
      ["p", "No cabeçalho aparecem bolinhas com quem está com a pauta aberta neste momento. Cada pessoa ganha um apelido de bicho com cor — “urso verde”, “coruja azul” — sorteado na primeira visita e guardado no navegador."],
      ["p", "Serve para evitar o encontrão: se duas pessoas estão na mesma tela, vale combinar quem mexe no quê. As alterações aparecem para todo mundo na hora, sem recarregar."],
    ],
  },

  /* ── Administração ─────────────────────────────────────────────────────── */
  {
    id: "cadastros",
    grupo: "Administração",
    titulo: "Os cadastros do Admin",
    corpo: [
      ["p", "A engrenagem ⚙ Admin abre a gaveta com os cadastros que alimentam as caixinhas de seleção da grade."],
      ["ul", [
        "Clientes — opcional. Serve para dar apelido, cor e endereço de página pública. O nome que aparece na grade vem da Campanha do card, tenha ou não cadastro.",
        "Demandantes — quem pede.",
        "Tipos — a classificação da casa. É aqui que se cria o tipo fura-fila, que deixa a linha rosa.",
        "Status internos — com as três marcações que movem a interface: entrega, pausa e cancelamento.",
        "Recursos — o de-para entre o nome do Azure e o apelido curto, e a escolha de quem aparece no medidor.",
      ]],
      ["nota", "As três marcações do status interno são o que faz a linha ir parar em Parados ou Cancelados, e o que o ✓ usa para saber qual status significa entregue. Mexer nelas mexe em várias telas ao mesmo tempo."],
    ],
  },
  {
    id: "historico",
    grupo: "Administração",
    titulo: "O histórico de alterações",
    corpo: [
      ["p", "Toda mudança em um pedido é registrada: o que mudou, de que valor para qual, quem fez e quando. Alterações vindas do sync aparecem marcadas como tal."],
      ["p", "O histórico fica no fim da gaveta do Admin e só admin enxerga. Serve para responder “quem mudou essa data?” sem discussão."],
    ],
  },
  {
    id: "sync",
    grupo: "Administração",
    titulo: "O sync com o Azure",
    corpo: [
      ["p", "De dez em dez minutos a plataforma vai ao Azure buscar os cards e atualiza as colunas que são de lá. Ele escreve exatamente sete coisas: título, cliente, estado, responsável, datas, esforço e a pasta."],
      ["p", "Se um card não aparece na pauta, as causas quase sempre são: o card não é do tipo Criação, o card está em estado final, ou ninguém colou o link ainda. O botão ⚖ Azure mostra justamente esses casos."],
      ["nota", "O acesso ao Azure fica guardado no servidor. O navegador nunca fala com o Azure direto — por isso não adianta abrir a pauta “por dentro” para acelerar o sync."],
    ],
  },

  /* ── Dúvidas ───────────────────────────────────────────────────────────── */
  {
    id: "faq",
    grupo: "Dúvidas",
    titulo: "Perguntas frequentes",
    corpo: [
      ["p", "Editei um campo e ele voltou ao que era."],
      ["ul", ["Provavelmente era uma coluna do Azure, que não é editável aqui. Corrija no card."]],
      ["p", "O pedido sumiu da aba do mês."],
      ["ul", ["A data de entrega do card mudou, e a linha foi para o mês da nova entrega. Procure na aba seguinte."]],
      ["p", "Colei um texto e nada apareceu."],
      ["ul", ["Isso acontecia com texto copiado do Word ou do Teams, que vem com quebra de linha. Já foi resolvido: agora a quebra é achatada na colagem. Se ainda acontecer, avise."]],
      ["p", "A linha está vermelha e não sei por quê."],
      ["ul", ["Vermelho é pedido sem card. Cole o link do card no campo da coluna Link Azure."]],
      ["p", "O card existe no Azure mas não está na pauta."],
      ["ul", ["Abra ⚖ Azure: se ele estiver lá, é só clicar para trazer. Se não estiver, confira se o tipo é Criação e se o estado não é final."]],
      ["p", "Não consigo ver todas as colunas."],
      ["ul", ["Use o zoom no cabeçalho, ao lado do botão de tema. Ele encolhe a página inteira."]],
      ["p", "Quero mudar a tabela de peças ou de esforço."],
      ["ul", ["Precisa ser admin. Abra o modal pelo cabeçalho e clique em “Editar tabela”."]],
      ["p", "Apaguei uma linha sem querer."],
      ["ul", ["A exclusão é definitiva na pauta, mas o card continua no Azure — basta colar o link de novo. O histórico do Admin mostra o que foi apagado e por quem."]],
    ],
  },
];

export const GRUPOS_MANUAL = [...new Set(MANUAL.map((t) => t.grupo))];

/** Texto puro de um tópico, para a busca varrer sem saber de formatação. */
export function textoDoTopico(t) {
  const partes = [t.titulo, t.grupo];
  for (const [tipo, conteudo] of t.corpo) {
    if (tipo === "ul" || tipo === "ol") partes.push(conteudo.join(" "));
    else if (tipo === "tab") partes.push(conteudo.flat().join(" "));
    else partes.push(conteudo);
  }
  return partes.join(" ");
}

/** Sem acento e sem caixa: procurar por "pecas" tem de achar "peças". */
export const chave = (s) =>
  String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
