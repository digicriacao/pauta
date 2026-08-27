import { fmtBR, fmtBRL, diffDias } from "@/lib/formato";

/**
 * Todo o cálculo dos relatórios em um lugar só, longe do JSX.
 * Recebe o recorte já filtrado e devolve números prontos para desenhar.
 */

const soma = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
const pct = (parte, todo) => (todo ? Math.round((parte / todo) * 100) : 0);

/** Agrupa por uma chave de texto e ordena do maior para o menor. */
function agrupa(itens, chave, valor = () => 1) {
  const mapa = new Map();
  for (const p of itens) {
    const k = chave(p);
    if (!k) continue;
    mapa.set(k, (mapa.get(k) || 0) + (valor(p) || 0));
  }
  return [...mapa].map(([rot, v]) => ({ rot, v })).sort((a, b) => b.v - a.v);
}

/** Mantém os N maiores e junta o resto em "Outros" — nunca inventa cor nova. */
export function topN(dados, n = 7) {
  if (dados.length <= n) return dados;
  const cabeca = dados.slice(0, n);
  const resto = dados.slice(n).reduce((s, d) => s + d.v, 0);
  return resto ? [...cabeca, { rot: "Outros", v: resto, outros: true }] : cabeca;
}

export function nomes(cfg) {
  return {
    rec: (p) =>
      cfg.recursos.find((r) => r.nome_azure === p.azure_assigned_to)?.nome_pauta || p.azure_assigned_to || "",
    dem: (p) => cfg.demandantes.find((d) => d.id === p.demandante_id)?.nome || "",
    tipo: (p) => cfg.tipos.find((t) => t.id === p.tipo_id)?.nome || "",
    st: (p) => cfg.status.find((s) => s.id === p.status_interno_id)?.nome || "",
  };
}

/** Em que situação está cada pedido: a leitura mais grossa possível do mês. */
export function situacaoDe(p, cfg) {
  const s = cfg.status.find((x) => x.id === p.status_interno_id);
  if (s?.cancelamento) return "cancelado";
  if (s?.pausa) return "parado";
  if (p.entregue) return "entregue";
  return "andamento";
}

export const SITUACOES = [
  { id: "entregue",  nome: "Entregue",     cor: "var(--ok)" },
  { id: "andamento", nome: "Em andamento", cor: "var(--info)" },
  { id: "parado",    nome: "Parado",       cor: "var(--none)" },
  { id: "cancelado", nome: "Cancelado",    cor: "var(--alerta)" },
];

export function calcula(base, cfg) {
  const nm = nomes(cfg);
  const n = base.length;

  const porSituacao = Object.fromEntries(
    SITUACOES.map((s) => [s.id, base.filter((p) => situacaoDe(p, cfg) === s.id)])
  );

  const artes = (arr) => soma(arr, (p) => p.qtd_artes ?? 1);
  const esforco = (arr) => soma(arr, (p) => Number(p.esforco) || 0);

  // Dias com entrega prevista, e quanto já foi entregue em cada um.
  const dias = [...new Set(base.map((p) => p.data_entrega).filter(Boolean))].sort();
  const porDia = dias.map((d) => {
    const doDia = base.filter((p) => p.data_entrega === d);
    return {
      rot: fmtBRL(d), curto: fmtBR(d), iso: d,
      v: doDia.length,
      entregues: doDia.filter((p) => p.entregue).length,
    };
  });

  // Curva acumulada: o previsto sobe sempre, o entregue mostra o quanto falta.
  let ap = 0;
  let ae = 0;
  const acumulado = porDia.map((d) => {
    ap += d.v;
    ae += d.entregues;
    return { rot: d.rot, curto: d.curto, previsto: ap, entregue: ae };
  });

  const prazos = base
    .map((p) => diffDias(p.data_solicitacao, p.data_entrega))
    .filter((d) => d !== null && d >= 0);
  const prazoMedio = prazos.length ? Math.round(prazos.reduce((s, d) => s + d, 0) / prazos.length) : null;

  const atritoDem = agrupa(
    [...porSituacao.parado, ...porSituacao.cancelado],
    nm.dem
  ).map((d) => ({
    rot: d.rot,
    valores: [
      porSituacao.parado.filter((p) => nm.dem(p) === d.rot).length,
      porSituacao.cancelado.filter((p) => nm.dem(p) === d.rot).length,
    ],
  }));

  const recursos = agrupa(base, nm.rec);

  return {
    n,
    porSituacao,
    situacao: SITUACOES.map((s) => ({
      rot: s.nome, cor: s.cor, v: porSituacao[s.id].length,
      pct: pct(porSituacao[s.id].length, n),
    })),

    entregues: porSituacao.entregue.length,
    parados: porSituacao.parado.length,
    cancelados: porSituacao.cancelado.length,
    paradosSemMotivo: porSituacao.parado.filter((p) => !(p.motivo_pausa || "").trim()).length,
    canceladosSemMotivo: porSituacao.cancelado.filter((p) => !(p.motivo_cancelamento || "").trim()).length,

    artesFeitas: artes(porSituacao.entregue),
    artesTotal: artes(base),
    esforcoTotal: esforco(base),
    ajustes: base.filter((p) => /ajuste/i.test(nm.tipo(p))).length,
    semCard: base.filter((p) => !p.azure_id).length,
    prazoMedio,

    porDia,
    acumulado,
    pico: porDia.reduce((m, d) => (d.v > m.v ? d : m), { v: 0, rot: "—" }),

    recursos,
    recursosTop: topN(recursos),
    artesPorRecurso: topN(agrupa(base, nm.rec, (p) => p.qtd_artes ?? 1)),
    esforcoPorRecurso: topN(agrupa(base, nm.rec, (p) => Number(p.esforco) || 0)),
    demandantes: topN(agrupa(base, nm.dem)),
    demandantesTodos: agrupa(base, nm.dem),

    porTipo: cfg.tipos
      .map((t) => ({ rot: t.nome, cor: t.cor, v: base.filter((p) => p.tipo_id === t.id).length }))
      .filter((d) => d.v),
    porStatus: cfg.status
      .map((s) => ({ rot: s.nome, cor: s.cor, v: base.filter((p) => p.status_interno_id === s.id).length }))
      .filter((d) => d.v),

    atritoDem,
    pct,
  };
}
