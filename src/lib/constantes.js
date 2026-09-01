/**
 * Colunas da grade.
 *  dono  — quem escreve: 'azure' nunca é editável na tela.
 *  ord   — chave de ordenação; sem isso, o cabeçalho não é clicável.
 *  dirPadrao — como a coluna ordena na primeira vez que é clicada.
 */
export const COLUNAS = [
  { id: "data_solicitacao",  rotulo: "📅 Solicitação", largura: 142, dono: "azure+app", ord: "data_solicitacao",  dirPadrao: "desc" },
  { id: "azure_id",          rotulo: "Link Azure",     largura: 130, dono: "app"   },
  { id: "pasta_codigo",      rotulo: "📁",             largura: 96,  dono: "azure" },
  { id: "campanha",          rotulo: "Cliente",        largura: 138, dono: "azure", ord: "campanha",           dirPadrao: "asc", dica: "Vem do campo Campanha do card" },
  { id: "demandante_id",     rotulo: "Demandante",     largura: 134, dono: "app",   ord: "demandante",         dirPadrao: "asc"  },
  { id: "titulo",            rotulo: "Pedido",         largura: 304, dono: "azure" },
  { id: "qtd_artes",         rotulo: "🎨",             largura: 74,  dono: "app",   ord: "qtd_artes",          dirPadrao: "desc", dica: "Quantidade de artes" },
  { id: "esforco",           rotulo: "⚡️",             largura: 74,  dono: "azure", ord: "esforco",            dirPadrao: "desc", dica: "Esforço — vem do campo Effort do card" },
  { id: "tipo_id",           rotulo: "Tipo",           largura: 126, dono: "app",   ord: "tipo",               dirPadrao: "asc"  },
  { id: "data_entrega",      rotulo: "📅 Entrega",     largura: 118, dono: "azure", ord: "data_entrega",       dirPadrao: "asc"  },
  { id: "azure_state",       rotulo: "🔵 Azure",       largura: 176, dono: "azure", ord: "azure_state",        dirPadrao: "asc"  },
  { id: "status_interno_id", rotulo: "🟠 Interno",     largura: 208, dono: "app",   ord: "status_interno",     dirPadrao: "asc"  },
  { id: "entrega_em",        rotulo: "🕐 Entrega",     largura: 178, dono: "app",   ord: "entrega_em",         dirPadrao: "asc"  },
  { id: "entregue",          rotulo: "✓ Check",        largura: 78,  dono: "app"   },
  { id: "recurso",           rotulo: "Recurso",        largura: 118, dono: "azure", ord: "recurso",            dirPadrao: "asc"  },
  { id: "observacao",        rotulo: "📝 Obs",         largura: 190, dono: "app"   },
  { id: "acoes",             rotulo: "",               largura: 36,  dono: "app"   },
];

export const ORDEM_PADRAO = { campo: "data_solicitacao", dir: "desc" };

/** Estados do Azure, como aparecem lá, e de onde cada um vem. */
export const ESTADOS_AZURE = [
  { nome: "EM REFINAMENTO",     cor: "#8C8494", de: ["New", "Refinement"] },
  { nome: "EM PAUTA",           cor: "#D97706", de: ["Ready"] },
  { nome: "EM DESENVOLVIMENTO", cor: "#EA580C", de: ["Active"] },
  { nome: "EM VALIDAÇÃO",       cor: "#2563EB", de: ["Validation"] },
  { nome: "ENTREGUE",           cor: "#059669", de: ["Done", "Closed", "Resolved"] },
];

export const MAPA_ESTADO = ESTADOS_AZURE.reduce((acc, e) => {
  e.de.forEach((k) => (acc[k] = e.nome));
  return acc;
}, {});

/** Sem acento, sem caixa, sem espaço sobrando. */
const chaveEstado = (s) =>
  String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/\s+/g, " ").trim();

/**
 * O estado como ele aparece na tela, valendo para os dois jeitos de o Azure
 * nomear a coluna.
 *
 * `MAPA_ESTADO` só conhece os nomes internos do processo padrão ("Ready",
 * "Active"). Quando o processo usa nomes próprios em português — "Em Pauta",
 * "Em Desenvolvimento" — o mapa devolve nada, e é o plano B que responde. A
 * grade sempre teve esse plano B; o medidor não tinha, e por isso apareceu
 * zerado para todo mundo. Quem for comparar estado use SEMPRE esta função.
 */
export const estadoDe = (p) =>
  MAPA_ESTADO[p?.azure_state] || chaveEstado(p?.azure_state);

/** Um estado é um dos nomes desta lista? Compara sem acento e sem caixa, e
 *  aceita tanto o nome de tela quanto o nome interno do Azure. */
export function estadoEstaEm(pedido, nomes) {
  const alvo = chaveEstado(estadoDe(pedido));
  if (!alvo) return false;
  return nomes.some((nome) => {
    if (chaveEstado(nome) === alvo) return true;
    const e = ESTADOS_AZURE.find((x) => x.nome === nome);
    return (e?.de || []).some((cru) => chaveEstado(cru) === alvo);
  });
}

export const corEstado = (nome) =>
  ESTADOS_AZURE.find((e) => e.nome === nome)?.cor || "var(--none)";

/** Posição do estado no fluxo — é assim que a coluna 🔵 Azure ordena. */
export const posEstado = (nome) => {
  const i = ESTADOS_AZURE.findIndex((e) => e.nome === nome);
  return i === -1 ? 99 : i;
};

/** Paleta categórica dos relatórios — validada para daltonismo em claro e escuro. */
export const PALETA = ["var(--c1)","var(--c2)","var(--c3)","var(--c4)","var(--c5)","var(--c6)","var(--c7)"];

/* ── Réguas ─────────────────────────────────────────────────────────────────
   Área separada da pauta. Nada aqui vem do Azure: tudo é escrito à mão. */
export const COLUNAS_REGUAS = [
  { id: "cliente",    rotulo: "Cliente", largura: 160, ord: "cliente", dirPadrao: "asc" },
  { id: "nome",       rotulo: "Régua",  largura: 340, ord: "nome",   dirPadrao: "asc" },
  { id: "link",       rotulo: "Link",   largura: 300 },
  { id: "status",     rotulo: "Status", largura: 190, ord: "status", dirPadrao: "asc" },
  { id: "observacao", rotulo: "📝 Obs", largura: 320 },
  { id: "acoes",      rotulo: "",       largura: 36  },
];

export const STATUS_REGUA = [
  { id: "radar",      nome: "No radar",    cor: "#D97706" },
  { id: "producao",   nome: "Em produção", cor: "#2563EB" },
  { id: "finalizado", nome: "Finalizado",  cor: "#059669" },
];

export const corRegua = (id) => STATUS_REGUA.find((s) => s.id === id)?.cor || "var(--none)";

/** Posição no fluxo — é assim que a coluna Status ordena. */
export const posRegua = (id) => {
  const i = STATUS_REGUA.findIndex((s) => s.id === id);
  return i === -1 ? 99 : i;
};

/* ── Filas: Parados e Cancelados ────────────────────────────────────────────
   As duas são a mesma tabela `pedidos`, filtrada pela marcação do status
   interno. Por isso a linha "se autopreenche" ao trocar o status na home: é a
   mesma linha, vista de outro ângulo. A única diferença entre as duas áreas é
   qual marcação filtra e em que coluna o motivo é escrito. */
const COLUNAS_FILA = [
  { id: "data_solicitacao",  rotulo: "📅 Solicitação", largura: 130, ord: "data_solicitacao", dirPadrao: "desc" },
  { id: "azure_id",          rotulo: "Link Azure",     largura: 128 },
  { id: "campanha",          rotulo: "Cliente",        largura: 138, ord: "campanha", dirPadrao: "asc" },
  { id: "demandante_id",     rotulo: "Demandante",     largura: 150, ord: "demandante", dirPadrao: "asc" },
  { id: "titulo",            rotulo: "Pedido",         largura: 340 },
  { id: "status_interno_id", rotulo: "🟠 Interno",     largura: 180 },
];

export const FILAS = {
  parados: {
    chave: "parados",
    botao: "Parados",
    marca: "pausa",                 // coluna booleana em status_internos
    campoMotivo: "motivo_pausa",
    rotuloMotivo: "Motivo da pausa",
    dicaMotivo: "por que parou?",
    cor: "#8C8494",
    bolha: "cz",
    singular: "parado",
    plural: "parados",
    vazio: "Nada parado. Um pedido chega aqui quando o status interno vira PARADO na pauta.",
    classeLinha: "parada",
  },
  cancelados: {
    chave: "cancelados",
    botao: "Cancelados",
    marca: "cancelamento",
    campoMotivo: "motivo_cancelamento",
    rotuloMotivo: "Motivo do cancelamento",
    dicaMotivo: "por que foi cancelado?",
    cor: "#DC2626",
    bolha: "vm",
    singular: "cancelado",
    plural: "cancelados",
    vazio: "Nada cancelado. Um pedido chega aqui quando o status interno vira CANCELADO na pauta.",
    classeLinha: "cancelada",
  },
};

/** As colunas de uma fila: as fixas mais a do motivo, que muda de nome. */
export const colunasFila = (fila) => [
  ...COLUNAS_FILA,
  { id: fila.campoMotivo, rotulo: fila.rotuloMotivo, largura: 380 },
];

/* ── Relatórios ─────────────────────────────────────────────────────────────
   Cada bloco é uma peça do relatório que a pessoa liga e desliga. O que está
   ligado é o que aparece na tela E o que sai na exportação — uma escolha só,
   para o arquivo nunca discordar do que estava sendo visto. */
export const BLOCOS_RELATORIO = [
  { id: "kpis",       grupo: "Topo",     nome: "Indicadores" },
  { id: "cliente",    grupo: "Gráficos", nome: "Pedidos por cliente" },
  { id: "situacao",   grupo: "Gráficos", nome: "Situação do recorte" },
  { id: "dia",        grupo: "Gráficos", nome: "Entregas por dia" },
  { id: "acumulado",  grupo: "Gráficos", nome: "Curva acumulada" },
  { id: "recurso",    grupo: "Gráficos", nome: "Carga por recurso" },
  { id: "artesRec",   grupo: "Gráficos", nome: "Artes por recurso" },
  { id: "esforcoRec", grupo: "Gráficos", nome: "Esforço por recurso" },
  { id: "demandante", grupo: "Gráficos", nome: "Pedidos por demandante" },
  { id: "tipo",       grupo: "Gráficos", nome: "Distribuição por tipo" },
  { id: "status",     grupo: "Gráficos", nome: "Status interno" },
  { id: "atrito",     grupo: "Gráficos", nome: "Parados e cancelados por demandante" },
  { id: "tabCliente", grupo: "Tabelas",  nome: "Resumo por cliente" },
  { id: "tabRecurso", grupo: "Tabelas",  nome: "Resumo por recurso" },
  { id: "tabParados", grupo: "Tabelas",  nome: "Lista de parados" },
  { id: "tabCancel",  grupo: "Tabelas",  nome: "Lista de cancelados" },
  { id: "tabDetalhe", grupo: "Tabelas",  nome: "Planilha detalhada", soExport: true },
];

export const GRUPOS_BLOCOS = ["Topo", "Gráficos", "Tabelas"];

/* ── Medidor de esforço do dia ──────────────────────────────────────────────
   As quatro pessoas que aparecem no painel do topo. O nome é comparado sem
   acento e sem caixa, contra o nome do Azure e contra o apelido da pauta —
   assim "Vinicius", "Vinícius" e "Vini" caem na mesma pessoa. */
export const MEDIDOR_RECURSOS = ["André", "Letícia", "Gabriela", "Vinicius"];

/** Esforço que enche a barra do medidor: 10 é o dia cheio de uma pessoa. */
export const ESFORCO_DIA = 10;

/** O que o medidor soma: os estados do Azure que significam trabalho em mão —
 *  o que já está na fila da pessoa e o que ela está fazendo agora. Ficam pelo
 *  nome que aparece na tela, e não pelo nome cru do Azure ("Ready", "Active"),
 *  porque é este o nome que o time usa quando conversa sobre a coluna. */
export const ESTADOS_MEDIDOR = ["EM PAUTA", "EM DESENVOLVIMENTO"];

/* ── Zoom ───────────────────────────────────────────────────────────────────
   A grade tem dezessete colunas e nem toda tela cabe todas. Em vez de espremer
   uma por uma, a pessoa encolhe a página inteira — o mesmo que o zoom do
   navegador faz, com a diferença de que este fica salvo e vale só aqui. Os
   degraus são poucos de propósito: escolher entre seis opções é um reflexo,
   escolher entre trinta é uma decisão. */
export const ZOOMS = [70, 80, 90, 100, 110, 125];
export const ZOOM_PADRAO = 100;

export const LS_BLOCOS = "pauta.v2.blocos";
export const LS_LARGURAS = "pauta.v2.larguras";
export const LS_ORDEM = "pauta.v2.ordem";
export const LS_ZOOM = "pauta.v2.zoom";

/** Prefixo do caminho no GitHub Pages — precisa entrar à mão em <img src>. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
