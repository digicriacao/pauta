"use client";

import { useState } from "react";
import { fmtBRL, paraInputLocal, deInputLocal } from "@/lib/formato";
import { MAPA_ESTADO, corEstado } from "@/lib/constantes";

/**
 * O que abre quando alguém cola um link de card: a plataforma inteira escurece
 * atrás e o pedido aparece grande, com o que veio do Azure travado no topo e
 * o que é da casa em branco, esperando ser preenchido.
 */
export default function FocoPedido({ card, cfg, aoConfirmar, aoCancelar, salvando }) {
  const [dem, setDem] = useState("");
  const [tipo, setTipo] = useState("");
  const [status, setStatus] = useState("");
  const [hora, setHora] = useState("");
  const [obs, setObs] = useState("");

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
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value=""></option>
              {cfg.status.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>🕐 Entrega combinada</label>
            <input type="datetime-local" value={hora} onChange={(e) => setHora(e.target.value)} />
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
