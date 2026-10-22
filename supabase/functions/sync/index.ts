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
const CAMPO_ENTREGA = Deno.env.get("AZURE_CAMPO_ENTREGA") ?? "Microsoft.VSTS.Scheduling.TargetDate";
const CAMPO_ESFORCO = Deno.env.get("AZURE_CAMPO_ESFORCO") ?? "Microsoft.VSTS.Scheduling.Effort";
const CAMPO_CLIENTE = Deno.env.get("AZURE_CAMPO_CLIENTE") ?? "Custom.Campanha";
/* Tipo de work item que interessa. Sem este recorte a varredura traz TODO o
   projeto — tarefa, bug, epic — e a pauta enche de card que não e de criacao.
   Para trazer tudo de propósito, deixe o secret com uma string vazia. */
const TIPO_CARD = Deno.env.get("AZURE_TIPO_CARD") ?? "Criação";
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

/** O Effort do card vem number, string ou vazio — a coluna aceita só número. */
const numeroOuNulo = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Picklist devolve texto; campo de identidade devolve objeto. Aceita os dois. */
// deno-lint-ignore no-explicit-any
const textoDoCampo = (v: any) => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "object") return (v.displayName ?? v.name ?? v.value ?? null);
  return String(v);
};

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
    /* Quem abriu o card. Vem do mesmo tipo de campo do AssignedTo — um
       objeto de identidade —, então também é o `displayName` que interessa.
       É coluna do Azure, então o sync pode escrever nela. */
    azure_criado_por: f["System.CreatedBy"]?.displayName ?? null,
    azure_changed_at: f["System.ChangedDate"] ?? null,
    data_solicitacao: soData(f["System.CreatedDate"]),
    data_entrega: soData(f[CAMPO_ENTREGA]),
    esforco: numeroOuNulo(f[CAMPO_ESFORCO]),
    campanha: textoDoCampo(f[CAMPO_CLIENTE]),
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

/**
 * Ids alterados desde `desde` (ISO).
 *
 * A pauta virou multicliente: em vez de uma consulta por cliente cadastrado,
 * traz TODO o projeto e deixa o campo Campanha dizer de quem é cada card.
 * Cliente novo aparece sozinho, sem ninguém precisar cadastrar nada antes.
 *
 * Para voltar ao recorte de um cliente só, preencha AZURE_FILTRO_CAMPANHA com
 * o valor que a Campanha precisa conter.
 */
async function idsAlterados(desde: string): Promise<number[]> {
  const soEsta = Deno.env.get("AZURE_FILTRO_CAMPANHA") ?? "";
  const filtro = soEsta ? `AND [${CAMPO_CLIENTE}] CONTAINS '${soEsta.replace(/'/g, "''")}'` : "";
  const filtroTipo = TIPO_CARD
    ? `AND [System.WorkItemType] = '${TIPO_CARD.replace(/'/g, "''")}'`
    : "";
  const wiql = `
    SELECT [System.Id] FROM WorkItems
    WHERE [System.TeamProject] = '${PROJETO}'
      AND [System.ChangedDate] >= '${desde}'
      ${filtroTipo}
      ${filtro}
      AND [System.State] NOT IN ('Removed')
    ORDER BY [System.ChangedDate] ASC`;
  /* ⚠️ `timePrecision=true` é OBRIGATÓRIO. Sem ele o Azure roda a consulta em
     precisão de DIA e recusa qualquer comparação de data que traga hora — e o
     `desde` é um toISOString(), então traz hora sempre:

       WIQL 400: You cannot supply a time with the date when running a query
       using date precision. The error is caused by «[System.ChangedDate] >= ...»

     Sem este parâmetro a varredura falha em TODAS as execuções, o sync_log só
     acumula linha com erro e nenhum card novo é descoberto. */
  const url = `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJETO)}` +
    `/_apis/wit/wiql?api-version=${API}&timePrecision=true`;
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
      /* ⚠️ `errorPolicy: "omit"` impede que UM card apagado derrube a chamada
         inteira. O padrão do Azure é "fail": basta um id que não existe mais e
         ele reprova o lote de 200 inteiro com
           404 TF401232: Work item NNNNN does not exist. */
      body: JSON.stringify({
        ids: ids.slice(i, i + 200),
        $expand: "all",
        errorPolicy: "omit",
      }),
    });
    if (!r.ok) throw new Error(`Batch ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    /* ⚠️ "omit" NÃO encurta a lista: o Azure devolve `null` na posição de cada
       card que não existe mais. Sem este filtro o primeiro null estoura em
       "Cannot read properties of null (reading 'id')". */
    saida.push(...(j.value ?? []).filter((x: unknown) => x != null));
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
  "titulo", "campanha", "azure_state", "azure_assigned_to", "azure_criado_por",
  "azure_changed_at",
  "data_solicitacao", "data_entrega", "esforco", "pasta_codigo", "pasta_url",
] as const;

/**
 * Liga a campanha do card a um cliente cadastrado, quando existe um.
 * Não achando, o pedido entra com cliente_id nulo e ainda assim aparece na
 * grade com o nome da campanha — cadastrar o cliente é opcional, e serve só
 * para dar apelido, cor e endereço da página pública.
 */
// deno-lint-ignore no-explicit-any
function clienteDaCampanha(campanha: string | null, clientes: any[]) {
  if (!campanha) return null;
  const alvo = campanha.toLowerCase();
  const bate = clientes.find((c) => {
    const chaves = [c.tag_azure, c.nome, c.slug].filter(Boolean).map((x: string) => x.toLowerCase());
    return chaves.some((k: string) => alvo.includes(k));
  });
  return bate?.id ?? null;
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/**
 * Quem está chamando: "cron", "admin", "editor" ou null.
 *
 * A varredura completa é do agendador e do admin — ela cria linhas e conversa
 * com o projeto inteiro. Já o refresco leve (acao "atualizar") só reescreve
 * colunas de que o Azure é dono em linhas que já existem, então editor também
 * pode disparar: é o que mantém a tela viva enquanto a pessoa trabalha.
 */
async function papelDaChamada(req: Request): Promise<string | null> {
  const segredo = Deno.env.get("CRON_SECRET");
  if (!segredo) return null;                     // falha fechado
  if (req.headers.get("x-cron-secret") === segredo) return "cron";

  const cabecalho = req.headers.get("authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  if (!token) return null;
  try {
    const sb = admin();
    const { data } = await sb.auth.getUser(token);
    if (!data?.user) return null;
    const { data: perfil } = await sb
      .from("perfis").select("papel").eq("id", data.user.id).maybeSingle();
    const papel = perfil?.papel ?? null;
    return papel === "admin" || papel === "editor" ? papel : null;
  } catch {
    return null;
  }
}

/* ── refresco leve ────────────────────────────────────────────────────────
   Relê no Azure APENAS os cards que já estão na pauta e reescreve as colunas
   de que o Azure é dono. Não usa WIQL, não cria linha nova e NÃO escreve no
   sync_log — se escrevesse, a janela "desde o último sync" da varredura
   completa andaria para a frente e cards novos deixariam de ser descobertos.

   É o que a tela dispara ao abrir, de cinco em cinco minutos e depois de cada
   troca de status interno. */

/** Comparação campo a campo, para só escrever o que de fato mudou. Sem isto,
 *  cada refresco reescreveria a tabela toda e o Realtime mandaria uma mensagem
 *  por linha para cada navegador aberto, de cinco em cinco minutos. */
function igual(campo: string, a: unknown, b: unknown) {
  if (campo === "azure_changed_at") {
    const t = (v: unknown) => (v ? new Date(String(v)).getTime() : 0);
    return t(a) === t(b);
  }
  if (campo === "esforco") {
    const n = (v: unknown) =>
      v === null || v === undefined || v === "" ? null : Number(v);
    return n(a) === n(b);
  }
  const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return txt(a) === txt(b);
}

// deno-lint-ignore no-explicit-any
async function atualizaExistentes(sb: any, ids?: number[], limpar = false) {
  const resumo: {
    lidos: number; atualizados: number; iguais: number;
    pedidos?: number; sem_card_no_azure?: number; orfaos?: number[];
    fora_do_tipo?: number; apagados?: number; exemplos_fora_do_tipo?: number[];
  } = { lidos: 0, atualizados: 0, iguais: 0 };

  let alvos = (ids ?? []).map(Number).filter((n) => Number.isFinite(n));
  if (!alvos.length) {
    const { data } = await sb
      .from("pedidos").select("azure_id").not("azure_id", "is", null);
    // deno-lint-ignore no-explicit-any
    alvos = [...new Set((data ?? []).map((p: any) => p.azure_id as number))] as number[];
  }
  if (!alvos.length) return resumo;

  const cards = await buscaCardsEmLote(alvos);
  resumo.lidos = cards.length;

  /* Com errorPolicy "omit", o card que não existe mais simplesmente não volta.
     A diferença entre o que pedimos e o que veio são as linhas da pauta que
     apontam para card apagado no Azure — vale dizer quais, porque elas vão
     ficar paradas para sempre e alguém precisa decidir o que fazer. */
  const voltaram = new Set(cards.map((c: { id: number }) => c.id));
  const orfaos = alvos.filter((id) => !voltaram.has(id));
  resumo.pedidos = alvos.length;
  resumo.sem_card_no_azure = orfaos.length;
  resumo.orfaos = orfaos.slice(0, 20);

  const { data: existentes } = await sb
    .from("pedidos")
    .select([
      "id", "azure_id", ...CAMPOS_DO_AZURE,
      // só para saber se alguém já completou a linha à mão
      "demandante_id", "tipo_id", "observacao", "entrega_em",
    ].join(", "))
    .in("azure_id", alvos);
  // deno-lint-ignore no-explicit-any
  const porId = new Map((existentes ?? []).map((p: any) => [p.azure_id, p]));

  /* ── linhas que não são do tipo certo ───────────────────────────────────
     A varredura antiga não filtrava tipo e encheu a pauta de tarefa, bug e
     epic. O tipo do card não é guardado no banco — de propósito, para não
     criar coluna nova — então quem sabe dizer é esta passagem, que já tem o
     card do Azure na mão.

     Sozinha ela só CONTA, em toda chamada: assim o número aparece sem que
     ninguém peça. Apagar exige `limpar: true` no corpo, e mesmo aí só sai
     linha que ninguém completou à mão. */
  const foraDoTipo: number[] = [];
  let apagados = 0;
  // deno-lint-ignore no-explicit-any
  const intocada = (p: any) =>
    p.demandante_id == null && p.tipo_id == null &&
    p.observacao == null && p.entrega_em == null;

  for (const bruto of cards) {
    const c = normaliza(bruto);
    // deno-lint-ignore no-explicit-any
    const antigo: any = porId.get(c.azure_id);
    if (!antigo) continue;                       // refresco nunca cria linha

    const tipoDoCard = bruto?.fields?.["System.WorkItemType"] ?? null;
    if (TIPO_CARD && tipoDoCard !== TIPO_CARD) {
      foraDoTipo.push(c.azure_id);
      if (limpar && intocada(antigo)) {
        await sb.from("pedidos").delete().eq("id", antigo.id);
        apagados++;
      }
      continue;                    // não atualiza o que não deveria estar aqui
    }

    const mudou: Record<string, unknown> = {};
    for (const k of CAMPOS_DO_AZURE) {
      // deno-lint-ignore no-explicit-any
      const novo = (c as any)[k];
      if (!igual(k, antigo[k], novo)) mudou[k] = novo;
    }
    if (!Object.keys(mudou).length) { resumo.iguais++; continue; }

    await sb.from("pedidos").update(mudou).eq("id", antigo.id);
    resumo.atualizados++;
  }

  resumo.fora_do_tipo = foraDoTipo.length;
  resumo.exemplos_fora_do_tipo = foraDoTipo.slice(0, 20);
  if (limpar) resumo.apagados = apagados;
  return resumo;
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  if (!Deno.env.get("CRON_SECRET")) {
    return erro("CRON_SECRET não configurado nos secrets da função.", 503);
  }
  const papel = await papelDaChamada(req);
  if (!papel) return erro("não autorizado", 401);

  // O corpo é opcional: o agendador chama sem nada.
  let corpo: {
    acao?: string; ids?: number[]; desde?: string; limpar?: boolean;
  } = {};
  try { corpo = await req.json(); } catch { /* sem corpo, segue a varredura */ }

  const sb = admin();

  /* ── refresco leve: relê o que já está na pauta ─────────────────────── */
  if (corpo.acao === "atualizar") {
    try {
      /* Apagar exige `limpar: true` E papel de admin ou agendador. O
         navegador do editor nunca apaga: ele manda só `acao: "atualizar"`. */
      const podeLimpar = corpo.limpar === true && papel !== "editor";
      const r = await atualizaExistentes(sb, corpo.ids, podeLimpar);
      return responde({ ok: true, modo: "atualizar", ...r });
    } catch (e) {
      console.error("[sync/atualizar]", e);
      return responde(
        { ok: false, modo: "atualizar", erro: String((e as Error).message ?? e) },
        500,
      );
    }
  }

  /* ── varredura completa: só o agendador e o admin ───────────────────── */
  if (papel === "editor") {
    return erro("a varredura completa é do agendador e do admin", 403);
  }

  const { data: log } = await sb.from("sync_log").insert({}).select().single();
  const resumo = { lidos: 0, criados: 0, atualizados: 0 };

  try {
    // O cadastro de clientes deixou de ser pré-requisito: serve só para ligar
    // a campanha a um cliente conhecido. Vazio, o sync roda igual.
    const { data: clientes } = await sb
      .from("clientes").select("id, nome, slug, tag_azure").eq("ativo", true);

    const { data: ultimo } = await sb
      .from("sync_log").select("inicio")
      .not("fim", "is", null).is("erro", null)
      .order("inicio", { ascending: false }).limit(1).maybeSingle();

    /* Volta 2h além do último sync: o ChangedDate do Azure tem atraso de
       índice.

       O `desde` do corpo é uma escotilha de emergência, para quando a janela
       normal ficou grande demais. Se a varredura passou tempo quebrada, o
       último sucesso pode ser de meses atrás — e uma varredura de meses lê o
       projeto inteiro de uma vez e estoura o tempo da função. Rodar UMA vez
       com um `desde` recente escreve um sucesso novo no sync_log, e daí em
       diante a janela volta a ser curta sozinha. */
    const desde = corpo.desde
      ? new Date(corpo.desde).toISOString()
      : new Date(
        ultimo ? new Date(ultimo.inicio).getTime() - 2 * 3600e3 : Date.now() - 60 * 86400e3,
      ).toISOString();

    const ids = await idsAlterados(desde);
    if (ids.length) {
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
          novos.push({
            cliente_id: clienteDaCampanha(c.campanha, clientes ?? []),
            azure_id: c.azure_id,
            ...campos,
          });
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
