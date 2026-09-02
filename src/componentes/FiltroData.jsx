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
 *
 * Os atalhos e os dois campos de data são a MESMA coisa vista de dois jeitos:
 * os campos mostram sempre a faixa que está valendo, inclusive a que veio de um
 * atalho. Dá para clicar em "Hoje e amanhã" e esticar o "até" mais um dia sem
 * ter de montar a faixa do zero.
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
    aoMudar(periodo?.modo === "faixa" && (periodo.de || periodo.ate)
      ? periodo
      : { modo: "hoje", de: "", ate: "" });
  }

  function escolher(modo) {
    aoMudar({ modo, de: "", ate: "" });
    setAberto(false);
  }

  /* Mexer num dos campos passa a faixa a ser escolhida à mão, partindo do que
     já estava na tela. O menu NÃO fecha aqui: quem está montando uma faixa
     costuma mexer nas duas pontas. */
  function ajustarPonta(ponta, valor) {
    const atual = faixaDe(periodo, hoje) || { de: "", ate: "" };
    const nova = { modo: "faixa", de: atual.de, ate: atual.ate, [ponta]: valor };
    if (!nova.de && !nova.ate) return aoMudar(PERIODO_VAZIO);
    aoMudar(nova);
  }

  /** As datas ficam no próprio item quando ele vale mais de um dia: "semana"
   *  sozinho não diz qual, e "hoje e amanhã" some no fim do mês. */
  function rotuloFaixa(modo) {
    const r = faixaDe({ modo }, hoje);
    if (!r || r.de === r.ate) return "";
    const curto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
    return `${curto(r.de)} a ${curto(r.ate)}`;
  }

  const faixa = faixaDe(periodo, hoje) || { de: "", ate: "" };

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
        title="Escolher o período: hoje, amanhã, os dois juntos, a semana ou uma faixa de dias"
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
              <span className="fdata-faixa">{rotuloFaixa(o.id)}</span>
            </button>
          ))}

          <div className={`fdata-dia ${periodo?.modo === "faixa" ? "on" : ""}`}>
            <label>
              <span>De</span>
              <input type="date" value={faixa.de}
                onChange={(e) => ajustarPonta("de", e.target.value)} />
            </label>
            <label>
              <span>até</span>
              <input type="date" value={faixa.ate}
                onChange={(e) => ajustarPonta("ate", e.target.value)} />
            </label>
          </div>

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
