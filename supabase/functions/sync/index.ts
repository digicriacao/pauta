// ============================================================================
// sync — busca no Azure o que mudou e atualiza a pauta
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
const CAMPO_ENTREGA = Deno.env.get("AZURE_CAMPO_ENTREGA") ?? "Microsoft.VSTS.Scheduling.DueDate";
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
async function idsAlterados(desde: string, tagCliente: string): Promise<number[]> {
  const modo = Deno.env.get("AZURE_FILTRO_CLIENTE") ?? "titulo";
  const filtro =
    modo === "tag"
      ? `AND [System.Tags] CONTAINS '${tagCliente}'`
      : `AND [System.Title] CONTAINS '[${tagCliente}]'`;
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

/* ── o sync ───────────────────────────────────────────────────────── */

/**
 * A regra que faz isto ser seguro: só escreve nas colunas de que o Azure é
 * dono. Demandante, tipo, status interno, hora combinada e observação são da
 * plataforma e não são tocados — por isso não existe conflito.
 */
const CAMPOS_DO_AZURE = [
  "titulo", "azure_state", "azure_assigned_to", "azure_changed_at",
  "data_solicitacao", "data_entrega", "pasta_codigo", "pasta_url",
] as const;

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/**
 * Deixa passar dois tipos de chamada:
 *  1. o agendador (pg_cron), com o CRON_SECRET no cabeçalho x-cron-secret;
 *  2. um admin logado apertando "sincronizar agora".
 */
async function autorizado(req: Request) {
  const segredo = Deno.env.get("CRON_SECRET");
  if (!segredo) return false;                    // falha fechado
  if (req.headers.get("x-cron-secret") === segredo) return true;

  const cabecalho = req.headers.get("authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  if (!token) return false;
  try {
    const sb = admin();
    const { data } = await sb.auth.getUser(token);
    if (!data?.user) return false;
    const { data: perfil } = await sb
      .from("perfis").select("papel").eq("id", data.user.id).maybeSingle();
    return perfil?.papel === "admin";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  if (!Deno.env.get("CRON_SECRET")) {
    return erro("CRON_SECRET não configurado nos secrets da função.", 503);
  }
  if (!(await autorizado(req))) return erro("não autorizado", 401);

  const sb = admin();
  const { data: log } = await sb.from("sync_log").insert({}).select().single();
  const resumo = { lidos: 0, criados: 0, atualizados: 0 };

  try {
    const { data: clientes } = await sb
      .from("clientes").select("id, tag_azure").eq("ativo", true);
    if (!clientes?.length) throw new Error("Nenhum cliente ativo cadastrado.");

    const { data: ultimo } = await sb
      .from("sync_log").select("inicio")
      .not("fim", "is", null).is("erro", null)
      .order("inicio", { ascending: false }).limit(1).maybeSingle();

    // Volta 2h além do último sync: o ChangedDate do Azure tem atraso de índice.
    const desde = new Date(
      ultimo ? new Date(ultimo.inicio).getTime() - 2 * 3600e3 : Date.now() - 60 * 86400e3,
    ).toISOString();

    for (const cliente of clientes) {
      if (!cliente.tag_azure) continue;
      const ids = await idsAlterados(desde, cliente.tag_azure);
      if (!ids.length) continue;

      const cards = await buscaCardsEmLote(ids);
      resumo.lidos += cards.length;

      const { data: existentes } = await sb
        .from("pedidos").select("id, azure_id, azure_state").in("azure_id", ids);
      const porId = new Map((existentes ?? []).map((p) => [p.azure_id, p]));

      // deno-lint-ignore no-explicit-any
      const novos: any[] = [];
      for (const bruto of cards) {
        const c = normaliza(bruto);
        const antigo = porId.get(c.azure_id);
        const campos = Object.fromEntries(
          // deno-lint-ignore no-explicit-any
          CAMPOS_DO_AZURE.map((k) => [k, (c as any)[k]]),
        );

        if (antigo) {
          await sb.from("pedidos").update(campos).eq("id", antigo.id);
          resumo.atualizados++;
          if (antigo.azure_state !== c.azure_state) {
            await sb.from("eventos").insert({
              pedido_id: antigo.id, campo: "azure_state",
              de: antigo.azure_state, para: c.azure_state, origem: "sync",
            });
          }
        } else {
          novos.push({ cliente_id: cliente.id, azure_id: c.azure_id, ...campos });
        }

        await sb.from("azure_raw").upsert({
          azure_id: c.azure_id, payload: bruto,
          sincronizado_em: new Date().toISOString(),
        });
      }

      if (novos.length) {
        const { error } = await sb.from("pedidos").insert(novos);
        if (error) throw error;
        resumo.criados += novos.length;
      }
    }

    await sb.from("sync_log")
      .update({ fim: new Date().toISOString(), ...resumo }).eq("id", log?.id ?? -1);
    return responde({ ok: true, ...resumo });
  } catch (e) {
    console.error("[sync]", e);
    await sb.from("sync_log").update({
      fim: new Date().toISOString(), ...resumo, erro: String((e as Error).message ?? e),
    }).eq("id", log?.id ?? -1);
    return responde({ ok: false, erro: String((e as Error).message ?? e), ...resumo }, 500);
  }
});
