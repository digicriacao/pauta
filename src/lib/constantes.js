/** Colunas da grade. `dono` documenta quem escreve: 'azure' nunca é editável. */
export const COLUNAS = [
  { id: "data_solicitacao",  rotulo: "📅 Solicitação", largura: 132, dono: "azure+app" },
  { id: "azure_id",          rotulo: "Link Azure",     largura: 142, dono: "app"   },
  { id: "pasta_codigo",      rotulo: "📁",             largura: 92,  dono: "azure" },
  { id: "demandante_id",     rotulo: "Demandante",     largura: 132, dono: "app"   },
  { id: "titulo",            rotulo: "Pedido",         largura: 286, dono: "azure" },
  { id: "tipo_id",           rotulo: "Tipo",           largura: 124, dono: "app"   },
  { id: "data_entrega",      rotulo: "📅 Entrega",     largura: 112, dono: "azure" },
  { id: "azure_state",       rotulo: "🔵 Azure",       largura: 172, dono: "azure" },
  { id: "status_interno_id", rotulo: "🟠 Interno",     largura: 206, dono: "app"   },
  { id: "entrega_em",        rotulo: "🕐 Entrega",     largura: 174, dono: "app"   },
  { id: "entregue",          rotulo: "✓ Check",        largura: 74,  dono: "app"   },
  { id: "recurso",           rotulo: "Recurso",        largura: 112, dono: "azure" },
  { id: "observacao",        rotulo: "📝 Obs",         largura: 200, dono: "app"   },
  { id: "acoes",             rotulo: "",               largura: 34,  dono: "app"   },
];

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

/** Paleta categórica dos relatórios — validada para daltonismo em claro e escuro. */
export const PALETA = ["var(--c1)","var(--c2)","var(--c3)","var(--c4)","var(--c5)","var(--c6)","var(--c7)"];

export const LS_LARGURAS = "pauta.v2.larguras";
