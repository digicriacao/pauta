import { supabaseAdmin } from "@/lib/supabase-admin";
import { buscaCard, normaliza } from "@/lib/azure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/azure/51502
 *
 * É o que roda quando alguém cola o link do card na grade. Devolve os campos
 * que o Azure é dono — título, estado, responsável, datas e a pasta do
 * SharePoint — já prontos para preencher a linha.
 *
 * Exige sessão de editor: sem isso, qualquer pessoa com a URL leria work items
 * privados através do nosso PAT.
 */
async function editorDaRequisicao(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: perfil } = await admin
    .from("perfis")
    .select("id, usuario, papel")
    .eq("id", data.user.id)
    .maybeSingle();
  return perfil && ["editor", "admin"].includes(perfil.papel) ? perfil : null;
}

export async function GET(req, { params }) {
  const { id } = await params;
  const numero = Number(String(id).replace(/\D/g, ""));
  if (!numero) return Response.json({ erro: "Id inválido." }, { status: 400 });

  const perfil = await editorDaRequisicao(req);
  if (!perfil) return Response.json({ erro: "Só editores podem puxar cards." }, { status: 403 });

  try {
    const bruto = await buscaCard(numero);
    if (!bruto) return Response.json({ erro: `Card #${numero} não existe ou o PAT não enxerga.` }, { status: 404 });

    const admin = supabaseAdmin();
    await admin.from("azure_raw").upsert({
      azure_id: numero,
      payload: bruto,
      sincronizado_em: new Date().toISOString(),
    });

    const { data: jaTem } = await admin
      .from("pedidos")
      .select("id, titulo")
      .eq("azure_id", numero)
      .maybeSingle();

    return Response.json({ card: normaliza(bruto), jaNaPauta: jaTem || null });
  } catch (e) {
    console.error("[azure/card]", e);
    return Response.json({ erro: String(e.message || e) }, { status: 502 });
  }
}
