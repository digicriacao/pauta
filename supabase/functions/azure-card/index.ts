// ============================================================================
// azure-card — lê um card do Azure quando alguém cola o link
// Edge Function do Supabase (Deno). Substitui a rota que antes rodava na Vercel.
//
// Para publicar SEM terminal: painel do Supabase › Edge Functions ›
// "Deploy a new function" › Via Editor › cole este arquivo inteiro.
// O arquivo é autocontido de propósito — o editor do painel é de arquivo único.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ── CORS e respostas ─────────────────────────────────────────────── */
const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ORIGEM_PERMITIDA") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const responde = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const erro = (msg: string, status = 400) => responde({ erro: msg }, status);

/** Toda função precisa responder ao OPTIONS que o navegador manda antes. */
const preflight = (req: Request) =>
  req.method === "OPTIONS" ? new Response("ok", { headers: cors }) : null;

/* ── Azure DevOps — o PAT só existe aqui dentro ─────────────────────────────────────────────── */
const ORG = Deno.env.get("AZURE_ORG") ?? "digidevs";
const PROJETO = Deno.env.get("AZURE_PROJECT") ?? "SQUAD PULSE";
const CAMPO_ENTREGA = Deno.env.get("AZURE_CAMPO_ENTREGA") ?? "Microsoft.VSTS.Scheduling.TargetDate";
const API = "7.1";

function cabecalhos(): HeadersInit {
  const pat = Deno.env.get("AZURE_PAT");
  if (!pat) throw new Error("AZURE_PAT não configurado nos secrets da função");
  return {
    Authorization: "Basic " + btoa(":" + pat),
    "Content-Type": "application/json",
  };
}

const urlCard = (id: number | string) =>
  `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJETO)}/_workitems/edit/${id}`;

/**
 * Acha a pasta da demanda no SharePoint dentro da descrição do card.
 *
 * A descrição costuma trazer três links — ASSETS, BRIEFING e a pasta da
 * campanha. A pasta é a única cujo texto começa com "A" + número
 * (ex.: "A51172_Ranking_Unicred"). Guardamos a URL inteira e mostramos só o
 * código. Havendo mais de uma candidata, vale a que estiver mais perto da
 * palavra "pasta".
 */
function extraiPasta(descricaoHtml?: string) {
  if (!descricaoHtml) return { codigo: null, url: null };
  const html = String(descricaoHtml);
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const achados: { codigo: string; url: string; perto: boolean }[] = [];
  let m: RegExpExecArray | null;
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
  const escolhido = achados.find((a) => a.perto) ?? achados[achados.length - 1];
  return { codigo: escolhido.codigo, url: escolhido.url };
}

const soData = (v: unknown) => (v ? String(v).slice(0, 10) : null);

/** Achata o work item no formato que a tabela `pedidos` espera. */
// deno-lint-ignore no-explicit-any
function normaliza(item: any) {
  const f = item.fields ?? {};
  const pasta = extraiPasta(f["System.Description"]);
  return {
    azure_id: item.id as number,
    titulo: f["System.Title"] ?? null,
    azure_state: f["System.State"] ?? null,
    azure_assigned_to: f["System.AssignedTo"]?.displayName ?? null,
    azure_changed_at: f["System.ChangedDate"] ?? null,
    data_solicitacao: soData(f["System.CreatedDate"]),
    data_entrega: soData(f[CAMPO_ENTREGA]),
    pasta_codigo: pasta.codigo,
    pasta_url: pasta.url,
  };
}

async function buscaCard(id: number) {
  const url = `https://dev.azure.com/${ORG}/_apis/wit/workitems/${id}?$expand=all&api-version=${API}`;
  const r = await fetch(url, { headers: cabecalhos() });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Azure ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}

/** Ids alterados desde `desde` (ISO). Filtra o cliente por tag ou por título. */
async function idsAlterados(desde: string, cliente: string): Promise<number[]> {
  const modo = Deno.env.get("AZURE_FILTRO_CLIENTE") ?? "titulo";
  // Três jeitos de dizer "este card é da Prudential":
  //   campo  → um campo próprio do card (ex.: Campanha) — o mais confiável
  //   tag    → as Tags do work item
  //   titulo → o marcador [Prudential] no título, como no Pulse v1
  const campoCliente = Deno.env.get("AZURE_CAMPO_CLIENTE") ?? "Custom.Campanha";
  const filtro =
    modo === "campo"
      ? `AND [${campoCliente}] CONTAINS '${cliente}'`
      : modo === "tag"
      ? `AND [System.Tags] CONTAINS '${cliente}'`
      : `AND [System.Title] CONTAINS '[${cliente}]'`;
  const wiql = `
    SELECT [System.Id] FROM WorkItems
    WHERE [System.TeamProject] = '${PROJETO}'
      AND [System.ChangedDate] >= '${desde}'
      ${filtro}
      AND [System.State] NOT IN ('Removed')
    ORDER BY [System.ChangedDate] ASC`;
  const url = `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJETO)}/_apis/wit/wiql?api-version=${API}`;
  const r = await fetch(url, {
    method: "POST",
    headers: cabecalhos(),
    body: JSON.stringify({ query: wiql }),
  });
  if (!r.ok) throw new Error(`WIQL ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  // deno-lint-ignore no-explicit-any
  return (j.workItems ?? []).map((w: any) => w.id);
}

/** O Azure aceita no máximo 200 ids por chamada. */
async function buscaCardsEmLote(ids: number[]) {
  // deno-lint-ignore no-explicit-any
  const saida: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const url = `https://dev.azure.com/${ORG}/_apis/wit/workitemsbatch?api-version=${API}`;
    const r = await fetch(url, {
      method: "POST",
      headers: cabecalhos(),
      body: JSON.stringify({ ids: ids.slice(i, i + 200), $expand: "all" }),
    });
    if (!r.ok) throw new Error(`Batch ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    saida.push(...(j.value ?? []));
  }
  return saida;
}

/* ── quem pode chamar ─────────────────────────────────────────────── */
function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Só editor logado. Sem isso, qualquer um leria work items pelo nosso PAT. */
async function editorDaRequisicao(req: Request) {
  const cabecalho = req.headers.get("authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  if (!token) return null;
  const sb = admin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: perfil } = await sb
    .from("perfis").select("id, usuario, papel").eq("id", data.user.id).maybeSingle();
  return perfil && ["editor", "admin"].includes(perfil.papel) ? perfil : null;
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    const corpo = await req.json().catch(() => ({}));
    const numero = Number(String(corpo?.id ?? "").replace(/\D/g, ""));
    if (!numero) return erro("Informe o número do card.");

    const perfil = await editorDaRequisicao(req);
    if (!perfil) return erro("Só editores podem puxar cards.", 403);

    const bruto = await buscaCard(numero);
    if (!bruto) return erro(`Card #${numero} não existe ou o PAT não enxerga.`, 404);

    const sb = admin();
    await sb.from("azure_raw").upsert({
      azure_id: numero,
      payload: bruto,
      sincronizado_em: new Date().toISOString(),
    });

    const { data: jaTem } = await sb
      .from("pedidos").select("id, titulo").eq("azure_id", numero).maybeSingle();

    return responde({ card: normaliza(bruto), jaNaPauta: jaTem ?? null });
  } catch (e) {
    console.error("[azure-card]", e);
    return erro(String((e as Error).message ?? e), 502);
  }
});
