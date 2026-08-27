/**
 * Colunas da grade.
 *  dono  — quem escreve: 'azure' nunca é editável na tela.
 *  ord   — chave de ordenação; sem isso, o cabeçalho não é clicável.
 *  dirPadrao — como a coluna ordena na primeira vez que é clicada.
 */
export const COLUNAS = [
  { id: "data_solicitacao",  rotulo: "📅 Solicitação", largura: 134, dono: "azure+app", ord: "data_solicitacao",  dirPadrao: "desc" },
  { id: "azure_id",          rotulo: "Link Azure",     largura: 130, dono: "app"   },
  { id: "pasta_codigo",      rotulo: "📁",             largura: 96,  dono: "azure" },
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
  { id: "nome",       rotulo: "Régua",  largura: 360, ord: "nome",   dirPadrao: "asc" },
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

/* ── Cancelados ─────────────────────────────────────────────────────────────
   É a mesma tabela `pedidos`, filtrada pelo status marcado como cancelamento.
   Por isso a linha "se autopreenche" ao mudar o status na home: é a mesma linha. */
export const COLUNAS_CANCELADOS = [
  { id: "data_solicitacao",    rotulo: "📅 Solicitação",         largura: 130, ord: "data_solicitacao", dirPadrao: "desc" },
  { id: "azure_id",            rotulo: "Link Azure",             largura: 128 },
  { id: "demandante_id",       rotulo: "Demandante",             largura: 150, ord: "demandante", dirPadrao: "asc" },
  { id: "titulo",              rotulo: "Pedido",                 largura: 340 },
  { id: "status_interno_id",   rotulo: "🟠 Interno",             largura: 180 },
  { id: "motivo_cancelamento", rotulo: "Motivo do cancelamento", largura: 380 },
];

export const LS_LARGURAS = "pauta.v2.larguras";
export const LS_ORDEM = "pauta.v2.ordem";

/** Prefixo do caminho no GitHub Pages — precisa entrar à mão em <img src>. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
