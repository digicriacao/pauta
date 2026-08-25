/**
 * Tudo que fala com o Azure DevOps. Roda SÓ no servidor — o PAT nunca sai daqui.
 */

const ORG = process.env.AZURE_ORG || "digidevs";
const PROJETO = process.env.AZURE_PROJECT || "SQUAD PULSE";
const CAMPO_ENTREGA = process.env.AZURE_CAMPO_ENTREGA || "Microsoft.VSTS.Scheduling.DueDate";
const API = "7.1";

function cabecalhos() {
  const pat = process.env.AZURE_PAT;
  if (!pat) throw new Error("AZURE_PAT não configurado");
  return {
    Authorization: "Basic " + Buffer.from(":" + pat).toString("base64"),
    "Content-Type": "application/json",
  };
}

export { urlCard, idDoLink } from "./azure-cliente";

/**
 * Acha a pasta da demanda no SharePoint dentro da descrição do card.
 *
 * A descrição vem como HTML e costuma trazer três links — ASSETS, BRIEFING e
 * a pasta da campanha. A pasta é a única cujo texto começa com "A" + número
 * (ex.: "A51172_Ranking_Unicred"). Guardamos a URL inteira e exibimos só o
 * código "A51172". Quando mais de uma âncora casa, vale a que estiver mais
 * perto da palavra "pasta".
 */
export function extraiPasta(descricaoHtml) {
  if (!descricaoHtml) return { codigo: null, url: null };
  const html = String(descricaoHtml);
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const achados = [];
  let m;
  while ((m = re.exec(html))) {
    const texto = m[2].replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
    const cod = texto.match(/\bA[\s_-]?(\d{4,})/i);
    if (!cod) continue;
    const antes = html.slice(Math.max(0, m.index - 90), m.index).toLowerCase();
    achados.push({
      codigo: "A" + cod[1],
      url: m[1],
      perto: /pasta/.test(antes.replace(/<[^>]*>/g, " ")),
    });
  }
  if (!achados.length) return { codigo: null, url: null };
  const escolhido = achados.find((a) => a.perto) || achados[achados.length - 1];
  return { codigo: escolhido.codigo, url: escolhido.url };
}

const soData = (v) => (v ? String(v).slice(0, 10) : null);

/** Achata o work item do Azure no formato que a tabela `pedidos` espera. */
export function normaliza(item) {
  const f = item.fields || {};
  const pasta = extraiPasta(f["System.Description"]);
  return {
    azure_id: item.id,
    titulo: f["System.Title"] || null,
    azure_state: f["System.State"] || null,
    azure_assigned_to: f["System.AssignedTo"]?.displayName || null,
    azure_changed_at: f["System.ChangedDate"] || null,
    data_solicitacao: soData(f["System.CreatedDate"]),
    data_entrega: soData(f[CAMPO_ENTREGA]),
    pasta_codigo: pasta.codigo,
    pasta_url: pasta.url,
    tags: (f["System.Tags"] || "").split(";").map((t) => t.trim()).filter(Boolean),
  };
}

export async function buscaCard(id) {
  const url = `https://dev.azure.com/${ORG}/_apis/wit/workitems/${id}?$expand=all&api-version=${API}`;
  const r = await fetch(url, { headers: cabecalhos(), cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Azure ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}

/** Ids alterados desde `desde` (ISO). Filtra pelo cliente por tag ou por título. */
export async function idsAlterados(desde, tagCliente) {
  const modo = process.env.AZURE_FILTRO_CLIENTE || "titulo";
  const filtroCliente =
    modo === "tag"
      ? `AND [System.Tags] CONTAINS '${tagCliente}'`
      : `AND [System.Title] CONTAINS '[${tagCliente}]'`;
  const wiql = `
    SELECT [System.Id] FROM WorkItems
    WHERE [System.TeamProject] = '${PROJETO}'
      AND [System.ChangedDate] >= '${desde}'
      ${filtroCliente}
      AND [System.State] NOT IN ('Removed')
    ORDER BY [System.ChangedDate] ASC`;
  const url = `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJETO)}/_apis/wit/wiql?api-version=${API}`;
  const r = await fetch(url, {
    method: "POST",
    headers: cabecalhos(),
    body: JSON.stringify({ query: wiql }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`WIQL ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return (j.workItems || []).map((w) => w.id);
}

/** O Azure aceita no máximo 200 ids por chamada. */
export async function buscaCardsEmLote(ids) {
  const saida = [];
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const url = `https://dev.azure.com/${ORG}/_apis/wit/workitemsbatch?api-version=${API}`;
    const r = await fetch(url, {
      method: "POST",
      headers: cabecalhos(),
      body: JSON.stringify({ ids: lote, $expand: "all" }),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`Batch ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    saida.push(...(j.value || []));
  }
  return saida;
}
