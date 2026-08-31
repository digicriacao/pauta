"use client";

import { NOME_MES } from "@/lib/formato";
import { BASE } from "@/lib/constantes";

export default function Cabecalho({
  meses, mesAtual, mesSel, setMesSel, contaMes,
  perfil, podeEditar, ehAdmin, aoLogin, aoAdmin, vista, setVista, foraDaPauta = 0,
}) {
  const i = meses.indexOf(mesAtual);
  const anteriores = meses.slice(0, Math.max(0, i - 1));
  const visiveis = meses.slice(Math.max(0, i - 1));

  function trocaTema() {
    const raiz = document.documentElement;
    const atual = raiz.getAttribute("data-theme");
    const escuro = atual
      ? atual === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    const novo = escuro ? "light" : "dark";
    raiz.setAttribute("data-theme", novo);
    try { localStorage.setItem("pauta.v2.tema", novo); } catch {}
  }

  return (
    <header>
      <div className="wrap hrow">
        <div className="brand">
          {/* <img> puro, não next/image: com `unoptimized` o Next não põe o
              prefixo do repositório no src, e no GitHub Pages isso dá 404. */}
          <img className="logo logo-light" src={`${BASE}/logo-rosa.png`} alt="Digi" width="90" height="25" />
          <img className="logo logo-dark" src={`${BASE}/logo-claro.png`} alt="Digi" width="90" height="25" />
          <span className="brand-name">Pauta</span>
        </div>
        <div className="meses">
          <span className="ano">{mesSel.slice(0, 4)}</span>
          {anteriores.length > 0 && (
            <select
              className="mes-ant"
              value={anteriores.includes(mesSel) ? mesSel : ""}
              onChange={(e) => e.target.value && setMesSel(e.target.value)}
            >
              <option value="">Anteriores</option>
              {anteriores.map((m) => (
                <option key={m} value={m}>
                  {NOME_MES[+m.slice(5, 7) - 1]} · {contaMes(m)}
                </option>
              ))}
            </select>
          )}
          {visiveis.map((m) => {
            const n = contaMes(m);
            return (
              <button
                key={m}
                className={`mes ${n ? "tem" : ""}`}
                aria-current={m === mesSel}
                onClick={() => setMesSel(m)}
              >
                {NOME_MES[+m.slice(5, 7) - 1]}
                {n > 0 && <span className="n">{n}</span>}
              </button>
            );
          })}
        </div>

        <button className={`hbtn ${podeEditar ? "on" : ""}`} onClick={aoLogin} style={{ marginLeft: "auto" }}>
          {podeEditar ? `✎ Editando · ${perfil.usuario}` : perfil ? `👤 ${perfil.usuario} · sem edição` : "🔒 Só leitura"}
        </button>

        {ehAdmin && <button className="hbtn" onClick={aoAdmin}>⚙ Admin</button>}

        <button
          className={`hbtn ${vista === "rel" ? "on" : ""}`}
          onClick={() => setVista(vista === "rel" ? "pauta" : "rel")}
        >
          {vista === "rel" ? "← Voltar à pauta" : "📊 Relatórios"}
        </button>

        <button
          className={`hbtn ${vista === "azure" ? "on" : ""}`}
          onClick={() => setVista(vista === "azure" ? "pauta" : "azure")}
          title="Cards abertos no Azure que não estão na pauta"
        >
          {vista === "azure" ? "← Voltar à pauta" : "⚖ Azure"}
          {vista !== "azure" && foraDaPauta > 0 && (
            <span className="bolha vm" title={`${foraDaPauta} card${foraDaPauta === 1 ? "" : "s"} aberto${foraDaPauta === 1 ? "" : "s"} no Azure fora da pauta`}>
              {foraDaPauta}
            </span>
          )}
        </button>

        <button className="hbtn ico" onClick={trocaTema} title="Alternar tema" aria-label="Alternar tema">◐</button>
      </div>
    </header>
  );
}
