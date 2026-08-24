// ============================================================================
// auth-usuario — login por nome de usuário, cadastro e recuperação
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

/**
 * O Supabase Auth só autentica por e-mail. O de-para usuário → e-mail acontece
 * aqui dentro: o e-mail nunca volta pro navegador, ele existe só para receber
 * o link de recuperação de senha.
 */

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const admin = () =>
  createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
const anon = () =>
  createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
  });

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo inválido.");
  }

  const acao = corpo?.acao;
  const usuario = String(corpo?.usuario ?? "").trim().toLowerCase();

  try {
    const sb = admin();

    if (acao === "entrar") {
      if (!usuario || !corpo.senha) return erro("Informe usuário e senha.");
      const { data: perfil } = await sb
        .from("perfis").select("id, usuario, nome, papel").eq("usuario", usuario).maybeSingle();
      if (!perfil) return erro("Usuário ou senha incorretos.", 401);

      const { data: u } = await sb.auth.admin.getUserById(perfil.id);
      const email = u?.user?.email;
      if (!email) return erro("Usuário ou senha incorretos.", 401);

      const { data, error } = await anon().auth.signInWithPassword({ email, password: corpo.senha });
      if (error) return erro("Usuário ou senha incorretos.", 401);
      return responde({ sessao: data.session, perfil });
    }

    if (acao === "cadastrar") {
      const email = String(corpo?.email ?? "").trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(usuario))
        return erro("Usuário: 3 a 32 caracteres, só letras, números, ponto, hífen ou _.");
      if (String(corpo?.senha ?? "").length < 8)
        return erro("A senha precisa de pelo menos 8 caracteres.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return erro("Informe um e-mail válido para recuperar a senha.");

      const { data: existe } = await sb.from("perfis").select("id").eq("usuario", usuario).maybeSingle();
      if (existe) return erro("Esse usuário já está em uso.");

      // A primeira conta do projeto vira admin; as seguintes entram como leitor,
      // para ninguém ganhar edição só por se cadastrar.
      const { count } = await sb.from("perfis").select("id", { count: "exact", head: true });
      const papel = (count ?? 0) === 0 ? "admin" : "leitor";

      const { data: criado, error: e1 } = await sb.auth.admin.createUser({
        email, password: corpo.senha, email_confirm: true,
        user_metadata: { usuario },
      });
      if (e1) {
        return erro(e1.message.includes("already") ? "Esse e-mail já tem conta." : e1.message);
      }

      const { error: e2 } = await sb.from("perfis")
        .insert({ id: criado.user.id, usuario, nome: corpo.nome ?? usuario, papel });
      if (e2) {
        await sb.auth.admin.deleteUser(criado.user.id);
        return erro("Não foi possível criar o perfil: " + e2.message);
      }

      const { data, error: e3 } = await anon().auth.signInWithPassword({ email, password: corpo.senha });
      if (e3) return responde({ criado: true, papel });
      return responde({ sessao: data.session, perfil: { id: criado.user.id, usuario, papel } });
    }

    if (acao === "recuperar") {
      // Responde sempre igual, exista o usuário ou não — senão isto vira
      // um jeito de descobrir quem tem conta.
      const { data: perfil } = await sb.from("perfis").select("id").eq("usuario", usuario).maybeSingle();
      if (perfil) {
        const { data: u } = await sb.auth.admin.getUserById(perfil.id);
        if (u?.user?.email) {
          await anon().auth.resetPasswordForEmail(u.user.email, {
            redirectTo: (Deno.env.get("URL_SITE") ?? "") + "/nova-senha/",
          });
        }
      }
      return responde({ ok: true });
    }

    return erro("Ação desconhecida.");
  } catch (e) {
    console.error("[auth-usuario]", e);
    return erro("Erro no servidor.", 500);
  }
});
