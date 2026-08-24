"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * Login por usuário + senha. Quem resolve usuário → e-mail é o servidor
 * (/api/auth/usuario) — o e-mail existe só para recuperar a senha e nunca
 * volta pro navegador.
 */
export default function Login({ perfil, podeEditar, aoFechar, aoEntrar, aoSair }) {
  const [modo, setModo] = useState(perfil ? "sessao" : "login");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function chamar(acao, corpo) {
    setErro(""); setOk(""); setOcupado(true);
    try {
      const r = await fetch("/api/auth/usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, usuario, ...corpo }),
      });
      const j = await r.json();
      if (!r.ok) { setErro(j.erro || "Não deu certo."); return null; }
      return j;
    } catch {
      setErro("Sem resposta do servidor.");
      return null;
    } finally {
      setOcupado(false);
    }
  }

  async function entrar(acao) {
    const j = await chamar(acao, acao === "cadastrar" ? { senha, email } : { senha });
    if (!j) return;
    if (j.sessao) {
      await supabase()?.auth.setSession({
        access_token: j.sessao.access_token,
        refresh_token: j.sessao.refresh_token,
      });
      await aoEntrar();
      aoFechar();
    } else if (j.criado) {
      setOk("Conta criada. Peça a um admin para liberar sua edição e entre de novo.");
      setModo("login");
    }
  }

  async function recuperar() {
    const j = await chamar("recuperar", {});
    if (j) setOk("Se esse usuário existir, o link de recuperação já saiu para o e-mail cadastrado.");
  }

  if (modo === "sessao" && perfil) {
    return (
      <div className="mask on" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
        <div className="foco login" role="dialog" aria-modal="true">
          <div className="foco-h">
            <span className="eyebrow">Sessão</span>
            <h2>{podeEditar ? "Você está editando" : "Você está sem permissão de edição"}</h2>
          </div>
          <div className="quem">
            <span className="av2">{perfil.usuario.slice(0, 1).toUpperCase()}</span>
            <span>
              <b>{perfil.usuario}</b>
              <span>{perfil.email || "sem e-mail"} · papel: {perfil.papel}</span>
            </span>
          </div>
          {!podeEditar && (
            <div className="foco-b">
              <div className="erro">
                Sua conta está como <b>{perfil.papel}</b>. Um admin precisa mudar seu papel para
                <b> editor</b> no painel Admin para você poder mexer na pauta.
              </div>
            </div>
          )}
          <div className="foco-f">
            <button className="btn" onClick={async () => { await aoSair(); aoFechar(); }}>Sair</button>
            <button className="btn pri" onClick={aoFechar}>Fechar</button>
          </div>
        </div>
      </div>
    );
  }

  const cad = modo === "cadastro";
  return (
    <div className="mask on" onClick={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="foco login" role="dialog" aria-modal="true">
        <div className="foco-h">
          <span className="eyebrow">{cad ? "Criar acesso" : "Entrar para editar"}</span>
          <h2>{cad ? "Nova conta" : "Quem está editando?"}</h2>
        </div>
        <div className="foco-b">
          <div className="fld">
            <label>Usuário</label>
            <input value={usuario} autoComplete="username" placeholder="ex.: carolina"
              onChange={(e) => setUsuario(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && entrar(cad ? "cadastrar" : "entrar")} />
          </div>
          <div className="fld">
            <label>Senha</label>
            <input type="password" value={senha} placeholder="••••••••"
              autoComplete={cad ? "new-password" : "current-password"}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && entrar(cad ? "cadastrar" : "entrar")} />
          </div>
          {cad && (
            <div className="fld">
              <label>E-mail</label>
              <input type="email" value={email} placeholder="nome@digi.ag" autoComplete="email"
                onChange={(e) => setEmail(e.target.value)} />
              <span style={{ fontSize: "11.5px", color: "var(--faint)" }}>Serve só para recuperar a senha.</span>
            </div>
          )}
          {erro && <div className="erro">{erro}</div>}
          {ok && <div className="erro" style={{ background: "color-mix(in srgb,var(--ok) 14%,var(--surface))", color: "var(--ok)" }}>{ok}</div>}
        </div>
        <div className="foco-f">
          <button className="btn pri" disabled={ocupado} onClick={() => entrar(cad ? "cadastrar" : "entrar")}>
            {ocupado ? "…" : cad ? "Criar e entrar" : "Entrar"}
          </button>
          <button className="btn" onClick={aoFechar}>Cancelar</button>
          {!cad && <button className="alt" onClick={recuperar} disabled={!usuario || ocupado}>Esqueci a senha</button>}
          <button className="alt" style={{ marginLeft: "auto" }} onClick={() => { setErro(""); setOk(""); setModo(cad ? "login" : "cadastro"); }}>
            {cad ? "Já tenho acesso" : "Criar acesso"}
          </button>
        </div>
      </div>
    </div>
  );
}
