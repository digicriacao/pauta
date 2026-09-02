"use client";

import { useEffect, useRef, useState } from "react";
import { hojeISO } from "@/lib/formato";
import {
  PERIODOS, PERIODO_VAZIO, periodoAtivo, rotuloPeriodo, detalhePeriodo, faixaDe,
} from "@/lib/periodo";

/**
 * O recorte de data da barra de filtros.
 *
 * É uma caixa de marcar e um calendário no mesmo controle, e não dois: ligar e
 * desligar "o que sai hoje" tem de ser um clique, mas escolher outro dia não
 * pode custar um filtro à parte. Então a caixa liga o recorte (em "hoje", que é
 * o que se usa o dia inteiro) e o 📅 abre onde se troca o período.
 */
export default function FiltroData({ periodo, aoMudar }) {
  const [aberto, setAberto] = useState(false);
  const [desloca, setDesloca] = useState(0);
  const caixa = useRef(null);
  const menu = useRef(null);
  const hoje = hojeISO();
  const ativo = periodoAtivo(periodo, hoje);

  // Fecha ao clicar fora e no Esc — um menu que só fecha no próprio botão vira
  // um menu esquecido aberto por cima da grade.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e) => { if (caixa.current && !caixa.current.contains(e.target)) setAberto(false); };
    const tecla = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    window.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  /* O menu abre ancorado à esquerda do controle, e o controle anda de lugar
     conforme a barra de filtros quebra de linha. Medir e puxar de volta é o
     único jeito de ele nunca sair pela borda — a comparação é contra a própria
     barra, e não contra a janela, para o zoom da página não entrar na conta. */
  useEffect(() => {
    if (!aberto) { setDesloca(0); return; }
    const m = menu.current;
    const barra = caixa.current?.closest(".toolbar");
    if (!m || !barra) return;
    const rm = m.getBoundingClientRect();
    const rb = barra.getBoundingClientRect();
    const sobra = rm.right - rb.right;
    const falta = rb.left - rm.left;
    if (sobra > 0) setDesloca(-Math.ceil(sobra));
    else if (falta > 0) setDesloca(Math.ceil(falta));
  }, [aberto]);

  /** A caixa liga e desliga. Ligando sem período escolhido, vale hoje. */
  function alternar() {
    if (ativo) return aoMudar(PERIODO_VAZIO);
    aoMudar(periodo?.modo === "dia" && periodo.dia ? periodo : { modo: "hoje", dia: "" });
  }

  function escolher(modo) {
    aoMudar({ modo, dia: "" });
    setAberto(false);
  }

  function escolherDia(dia) {
    if (!dia) return aoMudar(PERIODO_VAZIO);
    aoMudar({ modo: "dia", dia });
  }

  /** As datas da semana ficam no próprio item: "semana" sozinho não diz qual. */
  function rotuloFaixa(modo) {
    const r = faixaDe({ modo }, hoje);
    if (!r) return "";
    const curto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
    return `${curto(r.de)} a ${curto(r.ate)}`;
  }

  return (
    <div className={`fcheck fdata ${ativo ? "on" : ""}`} ref={caixa}>
      <input
        type="checkbox" checked={ativo} onChange={alternar}
        aria-label={ativo ? `Filtro de data ligado em ${rotuloPeriodo(periodo)}` : "Filtrar por data"}
      />
      <span className="fdata-rot" onClick={alternar} title={detalhePeriodo(periodo, hoje)}>
        👁 {rotuloPeriodo(periodo)}
      </span>
      <button
        type="button" className="fdata-cal" aria-expanded={aberto} aria-haspopup="true"
        title="Escolher o período: hoje, amanhã, a semana ou um dia no calendário"
        onClick={() => setAberto((v) => !v)}
      >
        📅
      </button>

      {aberto && (
        <div className="fdata-pop" role="menu" ref={menu}
          style={desloca ? { marginLeft: `${desloca}px` } : undefined}>
          <p className="fdata-tit">Mostrar o que entrega em</p>

          {PERIODOS.map((o) => (
            <button
              key={o.id} type="button" role="menuitem"
              className={`fdata-op ${periodo?.modo === o.id ? "on" : ""}`}
              onClick={() => escolher(o.id)}
            >
              {o.rotulo}
              {o.id === "semana" && (
                <span className="fdata-faixa">{rotuloFaixa(o.id)}</span>
              )}
            </button>
          ))}

          <label className={`fdata-dia ${periodo?.modo === "dia" ? "on" : ""}`}>
            <span>Um dia</span>
            <input
              type="date" value={periodo?.modo === "dia" ? periodo.dia : ""}
              onChange={(e) => escolherDia(e.target.value)}
            />
          </label>

          <div className="fdata-pe">
            <span>{detalhePeriodo(periodo, hoje)}</span>
            {ativo && (
              <button type="button" className="chipclear"
                onClick={() => { aoMudar(PERIODO_VAZIO); setAberto(false); }}>
                sem filtro de data
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
