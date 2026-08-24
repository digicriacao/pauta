import { supabaseAdmin } from "@/lib/supabase-admin";
import { idsAlterados, buscaCardsEmLote, normaliza } from "@/lib/azure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/sync — roda de 10 em 10 minutos pela Vercel (vercel.json).
 *
 * A regra que faz o sync ser seguro: ele só escreve nas colunas de que o
 * Azure é dono. Demandante, tipo, status interno, hora combinada e observação
 * são da plataforma e não são tocados aqui — por isso não existe conflito.
 */
const CAMPOS_DO_AZURE = [
  "titulo",
  "azure_state",
  "azure_assigned_to",
  "azure_changed_at",
  "data_solicitacao",
  "data_entrega",
  "pasta_codigo",
  "pasta_url",
];

/**
 * Deixa passar dois tipos de chamada:
 *  1. o agendador, com o CRON_SECRET;
 *  2. um admin logado apertando "Sincronizar agora" na tela.
 * Qualquer outra coisa leva 401.
 */
async function autorizado(req) {
  const cabecalho = req.headers.get("authorization") || "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  if (!token) return false;

  const segredo = process.env.CRON_SECRET;
  if (segredo && token === segredo) return true;

  try {
    const admin = supabaseAdmin();
    const { data } = await admin.auth.getUser(token);
    if (!data?.user) return false;
    const { data: perfil } = await admin.from("perfis").select("papel").eq("id", data.user.id).maybeSingle();
    return perfil?.papel === "admin";
  } catch {
    return false;
  }
}

export async function GET(req) {
  // Falha fechado: sem CRON_SECRET configurado, o agendador não roda.
  if (!process.env.CRON_SECRET) {
    return Response.json({ erro: "CRON_SECRET não configurado no ambiente." }, { status: 503 });
  }
  if (!(await autorizado(req))) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }

  let admin, log;
  try {
    admin = supabaseAdmin();
    ({ data: log } = await admin.from("sync_log").insert({}).select().single());
  } catch (e) {
    return Response.json({ erro: String(e.message || e) }, { status: 500 });
  }
  const resumo = { lidos: 0, criados: 0, atualizados: 0 };

  try {
    const { data: clientes } = await admin.from("clientes").select("id, tag_azure").eq("ativo", true);
    if (!clientes?.length) throw new Error("Nenhum cliente ativo cadastrado.");

    const { data: ultimo } = await admin
      .from("sync_log")
      .select("inicio")
      .not("fim", "is", null)
      .is("erro", null)
      .order("inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Volta 2h além do último sync: o ChangedDate do Azure tem atraso de índice.
    const desde = new Date(
      ultimo ? new Date(ultimo.inicio).getTime() - 2 * 3600e3 : Date.now() - 60 * 86400e3
    ).toISOString();

    for (const cliente of clientes) {
      if (!cliente.tag_azure) continue;
      const ids = await idsAlterados(desde, cliente.tag_azure);
      if (!ids.length) continue;

      const cards = await buscaCardsEmLote(ids);
      resumo.lidos += cards.length;

      const { data: existentes } = await admin
        .from("pedidos")
        .select("id, azure_id, azure_state")
        .in("azure_id", ids);
      const porId = new Map((existentes || []).map((p) => [p.azure_id, p]));

      const novos = [];
      for (const bruto of cards) {
        const c = normaliza(bruto);
        const antigo = porId.get(c.azure_id);
        const campos = Object.fromEntries(CAMPOS_DO_AZURE.map((k) => [k, c[k]]));

        if (antigo) {
          await admin.from("pedidos").update(campos).eq("id", antigo.id);
          resumo.atualizados++;
          if (antigo.azure_state !== c.azure_state) {
            await admin.from("eventos").insert({
              pedido_id: antigo.id,
              campo: "azure_state",
              de: antigo.azure_state,
              para: c.azure_state,
              origem: "sync",
            });
          }
        } else {
          novos.push({ cliente_id: cliente.id, azure_id: c.azure_id, ...campos });
        }

        await admin.from("azure_raw").upsert({
          azure_id: c.azure_id,
          payload: bruto,
          sincronizado_em: new Date().toISOString(),
        });
      }

      if (novos.length) {
        const { error } = await admin.from("pedidos").insert(novos);
        if (error) throw error;
        resumo.criados += novos.length;
      }
    }

    await admin.from("sync_log").update({ fim: new Date().toISOString(), ...resumo }).eq("id", log?.id ?? -1);
    return Response.json({ ok: true, ...resumo });
  } catch (e) {
    console.error("[sync]", e);
    await admin
      .from("sync_log")
      .update({ fim: new Date().toISOString(), ...resumo, erro: String(e.message || e) })
      .eq("id", log?.id ?? -1);
    return Response.json({ ok: false, erro: String(e.message || e), ...resumo }, { status: 500 });
  }
}
