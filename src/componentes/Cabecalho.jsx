"use client";

import { useEffect, useState } from "react";
import { NOME_MES } from "@/lib/formato";
import { BASE, ZOOMS, ZOOM_PADRAO, LS_ZOOM } from "@/lib/constantes";
import { TABELAS_AJUDA } from "@/lib/ajuda";
import Presenca from "./Presenca";

/**
 * Controle de zoom. Usa a propriedade `zoom` do CSS, e não `transform:scale`,
 * porque `scale` desloca tudo que é `position:fixed` — os modais e a gaveta do
 * Admin sairiam do lugar. `zoom` refaz o layout de verdade, então a barra de
 * filtros continua grudando onde deve.
 */
function Zoom() {
  const [z, setZ] = useState(ZOOM_PADRAO);
  // Enquanto não tiver lido o que estava salvo, este componente não escreve
  // nada. Sem esta trava ele nasce em 100%, apaga o valor guardado e desfaz o
  // trabalho do script que roda antes da primeira pintura — a página saltava
  // de tamanho toda vez que era recarregada.
  const [lido, setLido] = useState(false);

  useEffect(() => {
    try {
      const salvo = Number(localStorage.getItem(LS_ZOOM));
      if (ZOOMS.includes(salvo)) setZ(salvo);
    } catch {}
    setLido(true);
  }, []);

  // Quem aplica é a folha (`body{zoom:var(--zoom,1)}`), e não este componente:
  // assim o mesmo caminho serve ao script do layout, e não existem duas fontes
  // da verdade para o mesmo número.
  useEffect(() => {
    if (!lido) return;
    document.documentElement.style.setProperty("--zoom", z / 100);
    try { localStorage.setItem(LS_ZOOM, String(z)); } catch {}
  }, [z, lido]);

  // A altura real da janela, em pixels. Precisa vir daqui porque dentro de um
  // elemento com zoom as unidades de viewport deixam de valer: o Chrome mexe em
  // `vh` por conta própria e o resultado sai encolhido duas vezes. Com este
  // número a grade continua do tamanho do monitor, e diminuir o zoom passa a
  // mostrar mais linhas em vez das mesmas linhas menores.
  useEffect(() => {
    const mede = () => document.documentElement.style.setProperty("--tela", `${window.innerHeight}px`);
    mede();
    window.addEventListener("resize", mede);
    return () => window.removeEventListener("resize", mede);
  }, []);

  const i = ZOOMS.indexOf(z);
  const anda = (passo) => setZ(ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + passo))]);

  return (
    <div className="zoom" role="group" aria-label="Zoom da página">
      <button className="zbtn" onClick={() => anda(-1)} disabled={i <= 0}
        title="Diminuir — cabe mais coluna na tela" aria-label="Diminuir zoom">−</button>
      <button className="zval mono" onClick={() => setZ(ZOOM_PADRAO)}
        title="Zoom da página. Clique para voltar a 100%">{z}%</button>
      <button className="zbtn" onClick={() => anda(1)} disabled={i >= ZOOMS.length - 1}
        title="Aumentar — texto maior" aria-label="Aumentar zoom">+</button>
    </div>
  );
}

export default function Cabecalho({
  meses, mesAtual, mesSel, setMesSel, contaMes,
  perfil, podeEditar, ehAdmin, aoLogin, aoAdmin, vista, setVista, foraDaPauta = 0,
  eu, gente = [], aoAjuda,
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
      {/* Três colunas: esquerda, centro, direita. As laterais valem 1fr cada,
          e é isso que põe o grupo do meio no centro de verdade — em fluxo
          simples ele escorregava conforme o número de meses à esquerda e o
          tamanho do nome de quem estava logado à direita, duas coisas que
          mudam sozinhas. Sendo colunas, também não há como uma passar por
          cima da outra. */}
      <div className="wrap hrow">
        <div className="hlado">
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

        <Presenca eu={eu} gente={gente} />
        </div>

        {/* As quatro consultas: duas abrem tabela aqui mesmo, duas abrem tela
            nova. Ficam no meio porque não são ação sobre a pauta — são o que
            se olha quando bate a dúvida, e por isso não competem com os botões
            de trabalho da direita. */}
        <div className="hmid">
          <button className="hbtn ico" onClick={() => aoAjuda?.("artes")}
            title={`${TABELAS_AJUDA.artes.botao} — como contamos as peças`}
            aria-label={TABELAS_AJUDA.artes.botao}>🎨</button>

          <button className="hbtn ico" onClick={() => aoAjuda?.("esforco")}
            title={`${TABELAS_AJUDA.esforco.botao} — o que cada nível quer dizer`}
            aria-label={TABELAS_AJUDA.esforco.botao}>⚡️</button>

          <a className="hbtn ico" href={`${BASE}/manual/`} target="_blank" rel="noopener noreferrer"
            title="Manual da plataforma — abre em outra guia" aria-label="Manual">❓</a>

          <a className="hbtn ico" href={`${BASE}/cliente/`} target="_blank" rel="noopener noreferrer"
            title="Visão do cliente — abre em outra guia" aria-label="Visão do cliente">🏢</a>
        </div>

        {/* Em tela estreita os rótulos (.rot) somem e ficam só os ícones — é o
            que faz este lado caber sem empurrar o grupo do meio para fora do
            centro. O `title` continua explicando cada botão no passar do mouse,
            então nada de fato se perde. */}
        <div className="hlado dir">
        <button className={`hbtn ${podeEditar ? "on" : ""}`} onClick={aoLogin}
          title={podeEditar ? `Editando como ${perfil.usuario}` : perfil ? `${perfil.usuario} — sem permissão de edição` : "Entrar para poder editar"}>
          {podeEditar ? "✎" : perfil ? "👤" : "🔒"}
          <span className="rot">
            {podeEditar ? `Editando · ${perfil.usuario}` : perfil ? `${perfil.usuario} · sem edição` : "Só leitura"}
          </span>
        </button>

        {podeEditar && (
          <button className="hbtn" onClick={aoAdmin} title="Cadastros e histórico">
            ⚙<span className="rot">Admin</span>
          </button>
        )}

        <button
          className={`hbtn ${vista === "rel" ? "on" : ""}`}
          onClick={() => setVista(vista === "rel" ? "pauta" : "rel")}
          title={vista === "rel" ? "Voltar à pauta" : "Relatórios do mês"}
        >
          {vista === "rel" ? "←" : "📊"}
          <span className="rot">{vista === "rel" ? "Voltar à pauta" : "Relatórios"}</span>
        </button>

        <button
          className={`hbtn ${vista === "azure" ? "on" : ""}`}
          onClick={() => setVista(vista === "azure" ? "pauta" : "azure")}
          title="Cards abertos no Azure que não estão na pauta"
        >
          {vista === "azure" ? "←" : "⚖"}
          <span className="rot">{vista === "azure" ? "Voltar à pauta" : "Azure"}</span>
          {vista !== "azure" && foraDaPauta > 0 && (
            <span className="bolha vm" title={`${foraDaPauta} card${foraDaPauta === 1 ? "" : "s"} aberto${foraDaPauta === 1 ? "" : "s"} no Azure fora da pauta`}>
              {foraDaPauta}
            </span>
          )}
        </button>

        <button className="hbtn ico" onClick={trocaTema} title="Alternar tema" aria-label="Alternar tema">◐</button>

        <Zoom />
        </div>
      </div>
    </header>
  );
}
