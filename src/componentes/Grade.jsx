"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { COLUNAS, LS_LARGURAS, MAPA_ESTADO, corEstado } from "@/lib/constantes";
import { fmtBR, paraInputLocal, deInputLocal, hojeISO } from "@/lib/formato";
import { urlCard, idDoLink } from "@/lib/azure-cliente";

const mix = (cor, pct) => `color-mix(in srgb, ${cor} ${pct}, var(--surface))`;

function Chip({ valor, opcoes, aoMudar, desabilitado }) {
  const item = opcoes.find((o) => o.id === valor);
  const cor = item?.cor || "var(--none)";
  return (
    <span className="chipwrap">
      <select
        className="chip"
        value={valor ?? ""}
        disabled={desabilitado}
        onChange={(e) => aoMudar(e.target.value ? Number(e.target.value) : null)}
        style={{
          background: item ? mix(cor, "var(--chip-a)") : "transparent",
          color: item ? cor : "var(--faint)",
          boxShadow: `inset 0 0 0 1px ${item ? mix(cor, "var(--chip-b)") : "var(--line-strong)"}`,
        }}
      >
        <option value=""></option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>{o.nome}</option>
        ))}
      </select>
    </span>
  );
}

function Linha({ p, cfg, podeEditar, salvar, remover, marcar }) {
  const dis = !podeEditar;
  const estado = MAPA_ESTADO[p.azure_state] || (p.azure_state ? p.azure_state.toUpperCase() : "");
  const recurso = cfg.recursos.find((r) => r.nome_azure === p.azure_assigned_to);

  return (
    <tr className={p.entregue ? "feito" : ""}>
      <td>
        <input
          className={`cell${p.data_solicitacao ? "" : " vazio"}`} type="date" disabled={dis}
          value={p.data_solicitacao || ""}
          onChange={(e) => salvar(p.id, { data_solicitacao: e.target.value || null })}
        />
      </td>
      <td>
        <span className="link">
          <a href={urlCard(p.azure_id)} target="_blank" rel="noopener noreferrer">#{p.azure_id} ↗</a>
        </span>
      </td>
      <td>
        {p.pasta_codigo ? (
          <span className="link">
            <a className="pasta" href={p.pasta_url || "#"} target="_blank" rel="noopener noreferrer"
               title={p.pasta_url || "Sem link de pasta na descrição do card"}>
              📁 {p.pasta_codigo}
            </a>
          </span>
        ) : (
          <div className="ro empty">—</div>
        )}
      </td>
      <td>
        <select className="cell" value={p.demandante_id ?? ""} disabled={dis}
          onChange={(e) => salvar(p.id, { demandante_id: e.target.value ? Number(e.target.value) : null })}>
          <option value=""></option>
          {cfg.demandantes.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
      </td>
      <td className="pedido">
        <div className="ro" title={p.titulo || ""}>{p.titulo || <em>sem título</em>}</div>
      </td>
      <td>
        <input className="qtd" type="number" min="0" step="1" inputMode="numeric" disabled={dis}
          defaultValue={p.qtd_artes ?? 1}
          title="Quantidade de artes deste pedido"
          onBlur={(e) => {
            const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
            e.target.value = n;
            if (n !== (p.qtd_artes ?? 1)) salvar(p.id, { qtd_artes: n });
          }} />
      </td>
      <td>
        <Chip valor={p.tipo_id} opcoes={cfg.tipos} desabilitado={dis}
          aoMudar={(v) => salvar(p.id, { tipo_id: v })} />
      </td>
      <td>
        {p.data_entrega
          ? <div className="ro mono">{fmtBR(p.data_entrega)}</div>
          : <div className="ro empty">vem do card</div>}
      </td>
      <td>
        {estado
          ? <span className="azchip"><i style={{ background: corEstado(estado) }} />{estado}</span>
          : <div className="ro empty">—</div>}
      </td>
      <td>
        <Chip valor={p.status_interno_id} opcoes={cfg.status} desabilitado={dis}
          aoMudar={(v) => {
            const st = cfg.status.find((s) => s.id === v);
            salvar(p.id, { status_interno_id: v, entregue: !!st?.entrega });
          }} />
      </td>
      <td>
        <input className={`cell${p.entrega_em ? "" : " vazio"}`} type="datetime-local" disabled={dis}
          value={paraInputLocal(p.entrega_em)}
          onChange={(e) => salvar(p.id, { entrega_em: deInputLocal(e.target.value) })} />
      </td>
      <td>
        <button className={`chk ${p.entregue ? "on" : ""}`} disabled={dis}
          title={p.entregue ? "Entregue — clique para reabrir" : "Marcar como entregue"}
          onClick={() => marcar(p)}>✓</button>
      </td>
      <td>
        {p.azure_assigned_to
          ? <div className="ro" title={`Azure: ${p.azure_assigned_to}`}>{recurso?.nome_pauta || p.azure_assigned_to}</div>
          : <div className="ro empty">—</div>}
      </td>
      <td>
        <input className="cell" type="text" placeholder="…" disabled={dis} defaultValue={p.observacao || ""}
          onBlur={(e) => {
            if ((e.target.value || "") !== (p.observacao || "")) salvar(p.id, { observacao: e.target.value || null });
          }} />
      </td>
      <td>
        <button className="del" disabled={dis} title="Remover linha" onClick={() => remover(p)}>×</button>
      </td>
    </tr>
  );
}

export default function Grade({ pedidos, cfg, podeEditar, salvar, remover, aoColar, aviso, ordem, aoOrdenar }) {
  const [larguras, setLarguras] = useState({});
  const arraste = useRef(null);
  const [colando, setColando] = useState("");

  useEffect(() => {
    try { setLarguras(JSON.parse(localStorage.getItem(LS_LARGURAS) || "{}") || {}); } catch {}
  }, []);

  const larg = useCallback((c) => larguras[c.id] || c.largura, [larguras]);

  useEffect(() => {
    const move = (e) => {
      if (!arraste.current) return;
      const { id, x0, w0 } = arraste.current;
      setLarguras((l) => ({ ...l, [id]: Math.max(56, w0 + (e.clientX - x0)) }));
    };
    const solta = () => {
      if (!arraste.current) return;
      arraste.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setLarguras((l) => {
        try { localStorage.setItem(LS_LARGURAS, JSON.stringify(l)); } catch {}
        return l;
      });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", solta);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", solta); };
  }, []);

  function pegaBorda(e, c) {
    e.preventDefault();
    e.stopPropagation();
    arraste.current = { id: c.id, x0: e.clientX, w0: larg(c) };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  async function marcar(p) {
    const stEntrega = cfg.status.find((s) => s.entrega);
    const stProducao = cfg.status.find((s) => !s.entrega) || null;
    const virou = !p.entregue;
    await salvar(p.id, {
      entregue: virou,
      status_interno_id: virou ? stEntrega?.id ?? p.status_interno_id : stProducao?.id ?? null,
    });
  }

  const total = COLUNAS.reduce((s, c) => s + larg(c), 0);

  return (
    <div className="gridwrap">
      <table className="grade" style={{ minWidth: total }}>
        <colgroup>
          {COLUNAS.map((c) => <col key={c.id} style={{ width: larg(c) }} />)}
        </colgroup>
        <thead>
          <tr>
            {COLUNAS.map((c, i) => {
              const ativa = c.ord && ordem.campo === c.ord;
              return (
                <th
                  key={c.id}
                  className={`${c.dono === "azure" ? "az" : ""} ${c.ord ? "ord" : ""}`}
                  aria-sort={ativa ? (ordem.dir === "asc" ? "ascending" : "descending") : undefined}
                  title={c.ord ? "Clique para ordenar por esta coluna" : undefined}
                  onClick={() => c.ord && aoOrdenar(c)}
                >
                  {c.rotulo}
                  {ativa && <span className="seta">{ordem.dir === "asc" ? "▲" : "▼"}</span>}
                  {i < COLUNAS.length - 1 && (
                    <span className="rz" onMouseDown={(e) => pegaBorda(e, c)} />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* linha nova, sempre no topo: é onde se cola o link do card */}
          <tr className="novo">
            <td><input className="cell" type="date" defaultValue={hojeISO()} disabled /></td>
            <td>
              <span className="link">
                <input
                  className="paste" placeholder="Colar link card" disabled={!podeEditar} value={colando}
                  onChange={(e) => {
                    const v = e.target.value;
                    setColando(v);
                    const id = idDoLink(v);
                    if (id) { setColando(""); aoColar(id); }
                  }}
                />
              </span>
            </td>
            {COLUNAS.slice(2).map((c) => (
              <td key={c.id}>{c.id === "titulo" ? <div className="ro empty">vem do card</div> : null}</td>
            ))}
          </tr>
          {pedidos.map((p) => (
            <Linha key={p.id} p={p} cfg={cfg} podeEditar={podeEditar}
              salvar={async (id, campos) => {
                const r = await salvar(id, campos);
                if (r?.erro) aviso(`Não deu para salvar: ${r.erro}`);
              }}
              remover={async (ped) => {
                const r = await remover(ped.id);
                if (r?.erro) aviso(`Não deu para remover: ${r.erro}`);
              }}
              marcar={marcar} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
