"use client";

import { useEffect, useState } from "react";
import { fmtBRL, deInputLocal } from "@/lib/formato";
import {
  MAPA_ESTADO, corEstado, statusPadraoDe, STATUS_PADRAO, ANO_PADRAO, HORA_PADRAO,
} from "@/lib/constantes";

/**
 * A data que a tela já traz preenchida.
 *
 * O campo é um `datetime-local`, e ele não sabe preencher só o ano: ou vem
 * tudo, ou vem nada. Vindo tudo, sobra menos para digitar — e a entrega do
 * card é o palpite mais provável, já que é a data que o Azure combinou. Sem
 * data no card, vale hoje, com o ano fixado em ANO_PADRAO.
 */
function entregaSugerida(card) {
  if (card?.data_entrega) return `${card.data_entrega}T${HORA_PADRAO}`;
  const h = new Date();
  const p = (n) => String(n).padStart(2, "0");
  const mes = h.getMonth() + 1;
  // 29 de fevereiro de um ano bissexto não existe em 2026: o input recusaria.
  const dia = mes === 2 ? Math.min(h.getDate(), 28) : h.getDate();
  return `${ANO_PADRAO}-${p(mes)}-${p(dia)}T${HORA_PADRAO}`;
}

/**
 * O que abre quando alguém cola um link de card: a plataforma inteira escurece
 * atrás e o pedido aparece grande, com o que veio do Azure travado no topo e
 * o que é da casa em branco, esperando ser preenchido.
 */
export default function FocoPedido({ card, cfg, aoConfirmar, aoCancelar, salvando }) {
  const [dem, setDem] = useState("");
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState(() => {
    const p = statusPadraoDe(cfg.status);
    return p ? String(p.id) : "";
  });
  const [hora, setHora] = useState(() => entregaSugerida(card));
  const [obs, setObs] = useState("");

  /* Rede de segurança: se os cadastros ainda não tiverem chegado na hora em que
     a tela montou, o palpite entra assim que chegarem — mas nunca por cima de
     uma escolha já feita. */
  useEffect(() => {
    if (status) return;
    const p = statusPadraoDe(cfg.status);
    if (p) setStatus(String(p.id));
  }, [cfg.status, status]);

  const estado = MAPA_ESTADO[card.azure_state] || card.azure_state || "—";
  const recurso = cfg.recursos.find((r) => r.nome_azure === card.azure_assigned_to);

  function confirmar() {
    const st = cfg.status.find((s) => s.id === Number(status));
    aoConfirmar({
      demandante_id: dem ? Number(dem) : null,
      tipo_id: tipo ? Number(tipo) : null,
      status_interno_id: status ? Number(status) : null,
      entrega_em: deInputLocal(hora),
      observacao: obs || null,
      entregue: !!st?.entrega,
    });
  }

  return (
    <div className="mask on" onClick={(e) => e.target === e.currentTarget && aoCancelar()}>
      <div className="foco" role="dialog" aria-modal="true">
        <div className="foco-h">
          <span className="eyebrow">Card #{card.azure_id} lido do Azure</span>
          <h2>{card.titulo || "Sem título"}</h2>
        </div>

        <div className="foco-az">
          <div><span className="k">📅 Solicitação</span><span className="v mono">{fmtBRL(card.data_solicitacao) || "—"}</span></div>
          <div><span className="k">📅 Entrega</span><span className="v mono">{fmtBRL(card.data_entrega) || "—"}</span></div>
          <div><span className="k">🔵 Azure</span><span className="v" style={{ color: corEstado(estado) }}>{estado}</span></div>
          <div><span className="k">Recurso</span><span className="v">{recurso?.nome_pauta || card.azure_assigned_to || "—"}</span></div>
          <div>
            <span className="k">📁 Pasta</span>
            <span className="v">
              {card.pasta_codigo
                ? <a className="azure" href={card.pasta_url} target="_blank" rel="noopener noreferrer">{card.pasta_codigo} ↗</a>
                : "não achei na descrição"}
            </span>
          </div>
        </div>

        <div className="foco-b">
          <div className="fld">
            <label>Demandante</label>
            <select value={dem} onChange={(e) => setDem(e.target.value)} autoFocus>
              <option value=""></option>
              {cfg.demandantes.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value=""></option>
              {cfg.tipos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>🟠 Status interno</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              title={`Já vem em ${STATUS_PADRAO}. Troque se for outro.`}>
              <option value=""></option>
              {cfg.status.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>🕐 Entrega combinada</label>
            <input type="datetime-local" value={hora} onChange={(e) => setHora(e.target.value)}
              title={card.data_entrega
                ? "Já vem com a entrega do card. Ajuste o dia e a hora se for outra."
                : `O card não traz entrega marcada — o palpite é hoje, em ${ANO_PADRAO}.`} />
            <button type="button" className="fld-limpa" onClick={() => setHora("")}
              hidden={!hora}>limpar a data</button>
          </div>
          <div className="fld full">
            <label>📝 Observação</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)}
              placeholder="Algo que o time precisa saber sobre este pedido…" />
          </div>
        </div>

        <div className="foco-f">
          <button className="btn pri" onClick={confirmar} disabled={salvando}>
            {salvando ? "Salvando…" : "OK, adicionar à pauta"}
          </button>
          <button className="btn" onClick={aoCancelar} disabled={salvando}>Cancelar</button>
          <span className="hintx">O topo veio do card e não se edita aqui.</span>
        </div>
      </div>
    </div>
  );
}
