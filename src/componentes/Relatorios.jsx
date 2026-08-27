"use client";

import { useMemo, useState } from "react";
import { PALETA } from "@/lib/constantes";
import { fmtBR, fmtBRL, csvCampo } from "@/lib/formato";

/* ── gráficos ────────────────────────────────────────────────────────────── */

function BarrasV({ dados, alt = 180, dica }) {
  const max = Math.max(1, ...dados.map((d) => d.v));
  return (
    <div className="vchart" style={{ "--alt": `${alt}px` }}>
      <div className="veixo">
        <span>{max}</span><span>{Math.round(max / 2)}</span><span>0</span>
      </div>
      <div className="vcols">
        {dados.map((d) => (
          <div className="colb" key={d.rot}
            onMouseMove={(e) => dica(`${d.rot} · <b>${d.v}</b> ${d.v === 1 ? "pedido" : "pedidos"}`, e)}
            onMouseLeave={() => dica(null)}>
            <span className="vb">{d.v >= max * 0.7 ? d.v : ""}</span>
            <span className="bb" style={{ height: `${Math.max(2, (d.v / max) * 100)}%` }} />
            <span className="lb">{d.curto}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarrasH({ dados, cores, dica }) {
  const total = dados.reduce((s, d) => s + d.v, 0) || 1;
  const max = Math.max(1, ...dados.map((d) => d.v));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 10 }}>
      {dados.map((d, i) => (
        <div className="brow" key={d.rot}
          onMouseMove={(e) => dica(`${d.rot} · <b>${d.v}</b> · ${Math.round((d.v / total) * 100)}%`, e)}
          onMouseLeave={() => dica(null)}>
          <span className="hlab">{d.rot}</span>
          <span className="hbar">
            <i style={{ background: cores[i] || PALETA[6], width: `${Math.max(1.5, (d.v / max) * 100)}%` }} />
          </span>
          <span className="mono hnum">
            {d.v}<span style={{ color: "var(--faint)" }}> · {Math.round((d.v / total) * 100)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

const Legenda = ({ itens, cores }) => (
  <div className="legend">
    {itens.map((t, i) => (
      <span key={t}><i style={{ background: cores[i] || PALETA[6] }} />{t}</span>
    ))}
  </div>
);

/* ── tela ────────────────────────────────────────────────────────────────── */

export default function Relatorios({ pedidos, cfg, mesSel, aviso, dica }) {
  const [f, setF] = useState({ dem: "", tipo: "", status: "", rec: "", de: "", ate: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const nomeRec = (p) =>
    cfg.recursos.find((r) => r.nome_azure === p.azure_assigned_to)?.nome_pauta || p.azure_assigned_to || "";
  const nomeDem = (p) => cfg.demandantes.find((d) => d.id === p.demandante_id)?.nome || "";
  const nomeTipo = (p) => cfg.tipos.find((t) => t.id === p.tipo_id)?.nome || "";
  const nomeSt = (p) => cfg.status.find((s) => s.id === p.status_interno_id)?.nome || "";

  const base = useMemo(
    () =>
      pedidos.filter(
        (p) =>
          (!f.dem || nomeDem(p) === f.dem) &&
          (!f.tipo || nomeTipo(p) === f.tipo) &&
          (!f.status || nomeSt(p) === f.status) &&
          (!f.rec || nomeRec(p) === f.rec) &&
          (!f.de || (p.data_entrega || "") >= f.de) &&
          (!f.ate || (p.data_entrega || "") <= f.ate)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pedidos, f, cfg]
  );

  const n = base.length || 1;
  const porDia = [...new Set(base.map((p) => p.data_entrega).filter(Boolean))].sort()
    .map((d) => ({ rot: fmtBRL(d), curto: fmtBR(d), v: base.filter((p) => p.data_entrega === d).length }));
  const somaArtes = (arr) => arr.reduce((s2, p) => s2 + (p.qtd_artes ?? 1), 0);
  const artesPorRec = [...new Set(base.map(nomeRec).filter(Boolean))]
    .map((x) => ({ rot: x, v: somaArtes(base.filter((p) => nomeRec(p) === x)) }))
    .sort((a, b) => b.v - a.v);
  const porTipo = cfg.tipos
    .map((t) => ({ rot: t.nome, cor: t.cor, v: base.filter((p) => p.tipo_id === t.id).length }))
    .filter((d) => d.v);
  const porSt = cfg.status
    .map((s) => ({ rot: s.nome, cor: s.cor, v: base.filter((p) => p.status_interno_id === s.id).length }))
    .filter((d) => d.v);
  const recTodos = [...new Set(base.map(nomeRec).filter(Boolean))]
    .map((x) => ({ rot: x, v: base.filter((p) => nomeRec(p) === x).length }))
    .sort((a, b) => b.v - a.v);
  const rec = recTodos.slice(0, 6);
  if (recTodos.length > 6) rec.push({ rot: "Outros", v: recTodos.slice(6).reduce((s, d) => s + d.v, 0) });
  const dem = [...new Set(base.map(nomeDem).filter(Boolean))]
    .map((x) => ({ rot: x, v: base.filter((p) => nomeDem(p) === x).length }))
    .sort((a, b) => b.v - a.v);
  const pico = porDia.reduce((m, d) => (d.v > m.v ? d : m), { v: 0, rot: "—" });
  const ajustes = base.filter((p) => /ajuste/i.test(nomeTipo(p))).length;
  const entregues = base.filter((p) => p.entregue).length;
  const artes = base.filter((p) => p.entregue).reduce((s2, p) => s2 + (p.qtd_artes ?? 1), 0);
  const artesTotal = base.reduce((s2, p) => s2 + (p.qtd_artes ?? 1), 0);

  async function exporta(tipo) {
    if (tipo !== "xls") {
      aviso(
        tipo === "pdf"
          ? "O PDF é montado no servidor a partir deste mesmo recorte. Ainda não está ligado."
          : "O PPT é montado no servidor a partir deste mesmo recorte. Ainda não está ligado."
      );
      return;
    }
    const cab = ["Solicitação","Card","Pasta","Demandante","Pedido","Artes","Esforço","Tipo","Entrega","Azure","Interno","Entrega combinada","Entregue","Recurso","Obs","Motivo da pausa","Motivo do cancelamento"];
    const linha = (p) => [
      fmtBRL(p.data_solicitacao), "#" + p.azure_id, p.pasta_codigo || "",
      nomeDem(p), p.titulo, p.qtd_artes ?? 1, p.esforco ?? "", nomeTipo(p), fmtBRL(p.data_entrega), p.azure_state, nomeSt(p),
      p.entrega_em || "", p.entregue ? "sim" : "não", nomeRec(p), p.observacao || "", p.motivo_pausa || "", p.motivo_cancelamento || "",
    ];
    const csv = "﻿" + [cab, ...base.map(linha)].map((l) => l.map(csvCampo).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pauta-${mesSel}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
    aviso(`Planilha gerada: ${base.length} linhas, ${cab.length} colunas, ${artesTotal} artes.`);
  }

  const kpi = (k, v, s) => (
    <div className="kpi" key={k}><span className="k">{k}</span><span className="v">{v}</span><span className="s">{s}</span></div>
  );

  return (
    <section>
      <div className="relbar">
        <select className="f" value={f.dem} onChange={set("dem")}>
          <option value="">Demandante</option>
          {cfg.demandantes.map((d) => <option key={d.id}>{d.nome}</option>)}
        </select>
        <select className="f" value={f.tipo} onChange={set("tipo")}>
          <option value="">Tipo</option>
          {cfg.tipos.map((t) => <option key={t.id}>{t.nome}</option>)}
        </select>
        <select className="f" value={f.status} onChange={set("status")}>
          <option value="">Status interno</option>
          {cfg.status.map((s) => <option key={s.id}>{s.nome}</option>)}
        </select>
        <select className="f" value={f.rec} onChange={set("rec")}>
          <option value="">Recurso</option>
          {recTodos.map((r) => <option key={r.rot}>{r.rot}</option>)}
        </select>
        <input className="f" type="date" value={f.de} onChange={set("de")} title="Entrega a partir de" />
        <input className="f" type="date" value={f.ate} onChange={set("ate")} title="Entrega até" />
        <button className="chipclear" onClick={() => setF({ dem: "", tipo: "", status: "", rec: "", de: "", ate: "" })}>limpar</button>
        <span className="spacer" />
        <span className="exp">
          <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)" }}>
            Exportar
          </span>
          <button className="hbtn" onClick={() => exporta("xls")}>Excel</button>
          <button className="hbtn" onClick={() => exporta("ppt")}>PPT</button>
          <button className="hbtn" onClick={() => exporta("pdf")}>PDF</button>
        </span>
      </div>

      <div className="kpis">
        {kpi("Pedidos no recorte", base.length, base.length === pedidos.length ? "mês inteiro" : `de ${pedidos.length} no mês`)}
        {kpi("Entregues", entregues, `${Math.round((entregues / n) * 100)}% do recorte`)}
        {kpi("Ajustes", ajustes, `${Math.round((ajustes / n) * 100)}% é refação`)}
        {kpi("Artes no mês", artes, `de ${artesTotal} previstas`)}
        {kpi("Dia mais cheio", pico.v, pico.rot)}
        {kpi("Pessoas envolvidas", recTodos.length, `${dem.length} demandantes`)}
      </div>

      <div className="charts">
        <div className="card wide">
          <div className="ch-h"><h3>Entregas por dia</h3><span className="sub">{porDia.length} dias com entrega</span></div>
          {porDia.length ? <BarrasV dados={porDia} dica={dica} /> : <p style={{ color: "var(--faint)", fontSize: 13 }}>Nada no recorte.</p>}
        </div>
        <div className="card">
          <div className="ch-h"><h3>Carga por recurso</h3><span className="sub">quem está segurando o mês</span></div>
          <Legenda itens={rec.map((d) => d.rot)} cores={PALETA} />
          <BarrasH dados={rec} cores={PALETA} dica={dica} />
        </div>
        <div className="card">
          <div className="ch-h"><h3>Pedidos por demandante</h3><span className="sub">de onde vem a demanda</span></div>
          <Legenda itens={dem.map((d) => d.rot)} cores={PALETA} />
          <BarrasH dados={dem} cores={PALETA} dica={dica} />
        </div>
        <div className="card">
          <div className="ch-h"><h3>Distribuição por tipo</h3><span className="sub">mesmas cores da grade</span></div>
          <BarrasH dados={porTipo} cores={porTipo.map((d) => d.cor)} dica={dica} />
        </div>
        <div className="card">
          <div className="ch-h"><h3>Status interno</h3><span className="sub">onde os pedidos estão parados</span></div>
          <BarrasH dados={porSt} cores={porSt.map((d) => d.cor)} dica={dica} />
        </div>
      </div>

      <div className="card">
        <div className="ch-h"><h3>Resumo por recurso</h3><span className="sub">a mesma base em tabela — é isso que sai no Excel</span></div>
        <table className="res">
          <thead>
            <tr>
              <th>Recurso</th><th className="num">Pedidos</th><th className="num">Artes</th>
              <th className="num">Ajustes</th><th className="num">Entregues</th>
              <th className="num">% do recorte</th><th style={{ width: 150 }} />
            </tr>
          </thead>
          <tbody>
            {recTodos.map((d) => {
              const rs = base.filter((p) => nomeRec(p) === d.rot);
              const pct = Math.round((d.v / n) * 100);
              return (
                <tr key={d.rot}>
                  <td>{d.rot}</td>
                  <td className="num">{d.v}</td>
                  <td className="num">{rs.reduce((s2, p) => s2 + (p.qtd_artes ?? 1), 0)}</td>
                  <td className="num">{rs.filter((p) => /ajuste/i.test(nomeTipo(p))).length}</td>
                  <td className="num">{rs.filter((p) => p.entregue).length}</td>
                  <td className="num">{pct}%</td>
                  <td><span className="bar-inline" style={{ width: `${Math.max(2, pct)}%` }} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
