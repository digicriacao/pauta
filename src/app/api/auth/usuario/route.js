import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Login por NOME DE USUÁRIO + senha.
 *
 * O Supabase Auth só sabe autenticar por e-mail, então o de-para
 * usuário → e-mail acontece aqui, no servidor. O e-mail nunca volta pro
 * navegador: quem faz o signIn é esta rota, e o cliente recebe só a sessão.
 * É o e-mail, também, que recebe o link de recuperação de senha.
 */

const anon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

const erro = (msg, status = 400) => Response.json({ erro: msg }, { status });

export async function POST(req) {
  let corpo;
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo inválido.");
  }
  const { acao } = corpo || {};
  const usuario = String(corpo?.usuario || "").trim().toLowerCase();

  try {
    const admin = supabaseAdmin();

    if (acao === "entrar") {
      if (!usuario || !corpo.senha) return erro("Informe usuário e senha.");
      const { data: perfil } = await admin
        .from("perfis")
        .select("id, usuario, nome, papel")
        .eq("usuario", usuario)
        .maybeSingle();
      if (!perfil) return erro("Usuário ou senha incorretos.", 401);

      const { data: u } = await admin.auth.admin.getUserById(perfil.id);
      const email = u?.user?.email;
      if (!email) return erro("Usuário ou senha incorretos.", 401);

      const { data, error } = await anon().auth.signInWithPassword({ email, password: corpo.senha });
      if (error) return erro("Usuário ou senha incorretos.", 401);

      return Response.json({ sessao: data.session, perfil });
    }

    if (acao === "cadastrar") {
      const email = String(corpo?.email || "").trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,32}$/.test(usuario))
        return erro("Usuário: 3 a 32 caracteres, só letras, números, ponto, hífen ou _.");
      if (String(corpo?.senha || "").length < 8) return erro("A senha precisa de pelo menos 8 caracteres.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erro("Informe um e-mail válido para recuperar a senha.");

      const { data: existe } = await admin.from("perfis").select("id").eq("usuario", usuario).maybeSingle();
      if (existe) return erro("Esse usuário já está em uso.");

      // O primeiro cadastro do projeto vira admin; os demais entram como leitor
      // e alguém precisa promover. Assim ninguém ganha edição só por se cadastrar.
      const { count } = await admin.from("perfis").select("id", { count: "exact", head: true });
      const papel = (count || 0) === 0 ? "admin" : "leitor";

      const { data: criado, error: e1 } = await admin.auth.admin.createUser({
        email,
        password: corpo.senha,
        email_confirm: true,
        user_metadata: { usuario },
      });
      if (e1) return erro(e1.message.includes("already") ? "Esse e-mail já tem conta." : e1.message);

      const { error: e2 } = await admin
        .from("perfis")
        .insert({ id: criado.user.id, usuario, nome: corpo.nome || usuario, papel });
      if (e2) {
        await admin.auth.admin.deleteUser(criado.user.id);
        return erro("Não foi possível criar o perfil: " + e2.message);
      }

      const { data, error: e3 } = await anon().auth.signInWithPassword({ email, password: corpo.senha });
      if (e3) return Response.json({ criado: true, papel });
      return Response.json({ sessao: data.session, perfil: { id: criado.user.id, usuario, papel } });
    }

    if (acao === "recuperar") {
      // Responde sempre igual, exista o usuário ou não — senão isso vira
      // um jeito de descobrir quem tem conta.
      const { data: perfil } = await admin.from("perfis").select("id").eq("usuario", usuario).maybeSingle();
      if (perfil) {
        const { data: u } = await admin.auth.admin.getUserById(perfil.id);
        if (u?.user?.email) {
          await anon().auth.resetPasswordForEmail(u.user.email, {
            redirectTo: `${new URL(req.url).origin}/nova-senha`,
          });
        }
      }
      return Response.json({ ok: true });
    }

    return erro("Ação desconhecida.");
  } catch (e) {
    console.error("[auth/usuario]", e);
    return erro("Erro no servidor.", 500);
  }
}
