// ============================================================================
// azure-pendentes — o confronto entre o Azure e a pauta
//
// Devolve os cards que estão ABERTOS no Azure (qualquer estado que não seja
// final) e que NÃO existem na pauta. É a rede de segurança do sync: se um card
// nasceu antes da primeira sincronização, se alguém apagou a linha à mão ou se
// um lote falhou, é aqui que isso aparece.
//
// Para publicar SEM terminal: painel do Supabase › Edge Functions ›
// "Deploy a new function" › Via Editor › cole este arquivo inteiro e dê o nome
// `azure-pendentes`. O arquivo é autocontido de propósito — o editor do painel
// é de arquivo único.
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

const preflight = (req: Request) =>
  req.method === "OPTIONS" ? new Response("ok", { headers: cors }) : null;

/* ── Azure DevOps — o PAT só existe aqui dentro ────────────────────── */
const ORG = Deno.env.get("AZURE_ORG") ?? "digidevs";
const PROJETO = Deno.env.get("AZURE_PROJECT") ?? "SQUAD PULSE";
const CAMPO_ENTREGA = Deno.env.get("AZURE_CAMPO_ENTREGA") ?? "Microsoft.VSTS.Scheduling.TargetDate";
const CAMPO_ESFORCO = Deno.env.get("AZURE_CAMPO_ESFORCO") ?? "Microsoft.VSTS.Scheduling.Effort";
const CAMPO_CLIENTE = Deno.env.get("AZURE_CAMPO_CLIENTE") ?? "Custom.Campanha";
const API = "7.1";

/** Só interessa o tipo de card que vira pedido na pauta. */
const TIPO_CARD = Deno.env.get("AZURE_TIPO_CARD") ?? "Criação";

/** Estados que significam "acabou". Tudo que não está aqui conta como aberto. */
const FINAIS = (Deno.env.get("AZURE_ESTADOS_FINAIS") ?? "Done,Closed,Resolved,Removed")
  .split(",").map((s) => s.trim()).filter(Boolean);

function cabecalhos(): HeadersInit {
  const pat = Deno.env.get("AZURE_PAT");
  if (!pat) throw new Error("AZURE_PAT não configurado nos secrets da função");
  return { Authorization: "Basic " + btoa(":" + pat), "Content-Type": "application/json" };
}

const soData = (v: unknown) => (v ? String(v).slice(0, 10) : null);

const numeroOuNulo = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// deno-lint-ignore no-explicit-any
const textoDoCampo = (v: any) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "object") return (v.displayName ?? v.name ?? v.value ?? null);
  return String(v);
};

/** Só o que a tela do confronto precisa mostrar — nada de descrição inteira. */
// deno-lint-ignore no-explicit-any
function resumo(item: any) {
  const f = item.fields ?? {};
  return {
    azure_id: item.id as number,
    titulo: f["System.Title"] ?? null,
    azure_state: f["System.State"] ?? null,
    azure_assigned_to: f["System.AssignedTo"]?.displayName ?? null,
    azure_changed_at: f["System.ChangedDate"] ?? null,
    data_solicitacao: soData(f["System.CreatedDate"]),
    data_entrega: soData(f[CAMPO_ENTREGA]),
    esforco: numeroOuNulo(f[CAMPO_ESFORCO]),
    campanha: textoDoCampo(f[CAMPO_CLIENTE]),
    tipo: f["System.WorkItemType"] ?? null,
  };
}

/** Ids de tudo que está aberto no projeto. */
async function idsAbertos(): Promise<number[]> {
  const lista = FINAIS.map((s) => `'${s.replace(/'/g, "''")}'`).join(",");
  const tipo = TIPO_CARD
    ? `AND [System.WorkItemType] = '${TIPO_CARD.replace(/'/g, "''")}'`
    : "";
  const wiql = `
    SELECT [System.Id] FROM WorkItems
    WHERE [System.TeamProject] = '${PROJETO}'
      ${tipo}
      AND [System.State] NOT IN (${lista})
    ORDER BY [System.ChangedDate] DESC`;
  const url = `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJETO)}/_apis/wit/wiql?api-version=${API}`;
  const r = await fetch(url, { method: "POST", headers: cabecalhos(), body: JSON.stringify({ query: wiql }) });
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
      body: JSON.stringify({
        ids: ids.slice(i, i + 200),
        fields: [
          "System.Id", "System.Title", "System.State", "System.AssignedTo",
          "System.ChangedDate", "System.CreatedDate", "System.WorkItemType",
          CAMPO_ENTREGA, CAMPO_ESFORCO, CAMPO_CLIENTE,
        ],
      }),
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
    const perfil = await editorDaRequisicao(req);
    if (!perfil) return erro("Só editores podem conferir o Azure.", 403);

    const ids = await idsAbertos();
    if (!ids.length) {
      return responde({ abertos: 0, naPauta: 0, faltando: [], estadosFinais: FINAIS, tipo: TIPO_CARD });
    }

    // Quem já está na pauta sai da lista. A comparação é por lotes porque o
    // `in` do Postgres não gosta de listas gigantes.
    const sb = admin();
    const conhecidos = new Set<number>();
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await sb
        .from("pedidos").select("azure_id").in("azure_id", ids.slice(i, i + 500));
      (data ?? []).forEach((p: { azure_id: number }) => conhecidos.add(p.azure_id));
    }

    const faltantes = ids.filter((id) => !conhecidos.has(id));
    const cards = faltantes.length ? await buscaCardsEmLote(faltantes) : [];

    return responde({
      abertos: ids.length,
      naPauta: conhecidos.size,
      faltando: cards.map(resumo),
      estadosFinais: FINAIS,
      tipo: TIPO_CARD,
    });
  } catch (e) {
    console.error("[azure-pendentes]", e);
    return erro(String((e as Error).message ?? e), 500);
  }
});
