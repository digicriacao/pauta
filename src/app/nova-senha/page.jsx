"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

/** Página para onde o link de recuperação do e-mail aponta. */
export default function NovaSenha() {
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState("");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    // O Supabase entrega a sessão de recuperação pelo fragmento da URL.
    supabase()?.auth.getSession().then(({ data }) => setPronto(!!data?.session));
  }, []);

  async function salvar() {
    setErro(""); setMsg("");
    if (senha.length < 8) return setErro("A senha precisa de pelo menos 8 caracteres.");
    const { error } = await supabase().auth.updateUser({ password: senha });
    if (error) return setErro(error.message);
    setMsg("Senha trocada. Já pode voltar para a pauta e entrar.");
  }

  return (
    <main className="wrap" style={{ maxWidth: 460, paddingTop: 60 }}>
      <div className="card">
        <h3 style={{ margin: "0 0 4px" }}>Nova senha</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 0 }}>
          {pronto ? "Escolha uma senha nova." : "Abra esta página pelo link que chegou no seu e-mail."}
        </p>
        <div className="fld" style={{ marginTop: 14 }}>
          <label>Senha</label>
          <input type="password" value={senha} disabled={!pronto}
            onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
        </div>
        {erro && <div className="erro" style={{ marginTop: 12 }}>{erro}</div>}
        {msg && (
          <div className="erro" style={{ marginTop: 12, background: "color-mix(in srgb,var(--ok) 14%,var(--surface))", color: "var(--ok)" }}>
            {msg}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="btn pri" onClick={salvar} disabled={!pronto}>Trocar senha</button>
          <a className="btn" href="/" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            Voltar à pauta
          </a>
        </div>
      </div>
    </main>
  );
}
