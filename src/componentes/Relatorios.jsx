"use client";

import { useEffect, useMemo, useState } from "react";
import { PALETA, BLOCOS_RELATORIO, GRUPOS_BLOCOS, LS_BLOCOS } from "@/lib/constantes";
import { fmtBR, fmtBRL, csvCampo } from "@/lib/formato";
import { calcula, nomes, situacaoDe } from "@/lib/relatorio";
import { BarrasV, BarrasH, BarraSituacao, BarrasEmpilhadas, LinhaAcumulada, Legenda } from "./Graficos";

const TODOS = BLOCOS_RELATORIO.map((b) => b.id);
const VAZIO = { cli: "", dem: "", tipo: "", status: "", rec: "", de: "", ate: "", parados: true, cancelados: true };

export default function Relatorios({ pedidos, cfg, mesSel, aviso, dica }) {
  const [f, setF] = useState(VAZIO);
  const [blocos, setBlocos] = useState(TODOS);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const nm = useMemo(() => nomes(cfg), [cfg]);

  // Cada pessoa guarda o próprio recorte de blocos.
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(LS_BLOCOS) || "null");
      if (Array.isArray(salvo)) setBlocos(salvo.filter((id) => TODOS.includes(id)));
    } catch {}
  }, []);

  const alterna = (id) =>
    setBlocos((atual) => {
      const nova = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
      try { localStorage.setItem(LS_BLOCOS, JSON.stringify(nova)); } catch {}
      return nova;
    });

  const defineBlocos = (lista) => {
    setBlocos(lista);
    try { localStorage.setItem(LS_BLOCOS, JSON.stringify(lista)); } catch {}
  };

  const tem = (id) => blocos.includes(id);

  const base = useMemo(
    () =>
      pedidos.filter((p) => {
        const sit = situacaoDe(p, cfg);
        if (sit === "parado" && !f.parados) return false;
        if (sit === "cancelado" && !f.cancelados) return false;
        return (
          (!f.cli || nm.cli(p) === f.cli) &&
          (!f.dem || nm.dem(p) === f.dem) &&
          (!f.tipo || nm.tipo(p) === f.tipo) &&
          (!f.status || nm.st(p) === f.status) &&
          (!f.rec || nm.rec(p) === f.rec) &&
          (!f.de || (p.data_entrega || "") >= f.de) &&
          (!f.ate || (p.data_entrega || "") <= f.ate)
        );
      }),
    [pedidos, f, cfg, nm]
  );

  const d = useMemo(() => calcula(base, cfg), [base, cfg]);
  const n = d.n || 1;

  /* ── exportação: sai exatamente o que está ligado ───────────────────────── */

  function planilha() {
    const linhas = [];
    const secao = (titulo, cab, dados) => {
      if (!dados.length) return;
      if (linhas.length) linhas.push([]);
      linhas.push([titulo]);
      linhas.push(cab);
      dados.forEach((l) => linhas.push(l));
    };

    linhas.push([`Relatório da pauta · ${f.cli || "todos os clientes"} · ${mesSel}`]);
    linhas.push([`${d.n} pedidos no recorte`, `filtros: ${resumoFiltros() || "nenhum"}`]);

    if (tem("kpis")) secao("Indicadores", ["Indicador", "Valor", "Detalhe"], indicadores().map((k) => [k.k, k.v, k.s]));
    if (tem("cliente")) secao("Pedidos por cliente", ["Cliente", "Pedidos"], d.clientes.map((x) => [x.rot, x.v]));
    if (tem("situacao")) secao("Situação do recorte", ["Situação", "Pedidos", "%"], d.situacao.map((s) => [s.rot, s.v, `${s.pct}%`]));
    if (tem("dia")) secao("Entregas por dia", ["Dia", "Previstas", "Entregues"], d.porDia.map((x) => [x.rot, x.v, x.entregues]));
    if (tem("acumulado")) secao("Curva acumulada", ["Dia", "Previsto acumulado", "Entregue acumulado"], d.acumulado.map((x) => [x.rot, x.previsto, x.entregue]));
    if (tem("recurso")) secao("Carga por recurso", ["Recurso", "Pedidos"], d.recursos.map((x) => [x.rot, x.v]));
    if (tem("artesRec")) secao("Artes por recurso", ["Recurso", "Artes"], d.artesPorRecurso.map((x) => [x.rot, x.v]));
    if (tem("esforcoRec")) secao("Esforço por recurso", ["Recurso", "Esforço"], d.esforcoPorRecurso.map((x) => [x.rot, x.v]));
    if (tem("demandante")) secao("Pedidos por demandante", ["Demandante", "Pedidos"], d.demandantesTodos.map((x) => [x.rot, x.v]));
    if (tem("tipo")) secao("Distribuição por tipo", ["Tipo", "Pedidos"], d.porTipo.map((x) => [x.rot, x.v]));
    if (tem("status")) secao("Status interno", ["Status", "Pedidos"], d.porStatus.map((x) => [x.rot, x.v]));
    if (tem("atrito")) secao("Parados e cancelados por demandante", ["Demandante", "Parados", "Cancelados"], d.atritoDem.map((x) => [x.rot, x.valores[0], x.valores[1]]));

    if (tem("tabCliente")) {
      secao("Resumo por cliente", ["Cliente", "Pedidos", "Artes", "Esforço", "Entregues", "Parados", "Cancelados", "% do recorte"],
        d.clientes.map((c) => {
          const l = linhaCliente(c);
          return [l.rot, l.pedidos, l.artes, l.esforco, l.entregues, l.parados, l.cancelados, `${l.pct}%`];
        }));
    }
    if (tem("tabRecurso")) {
      secao("Resumo por recurso", ["Recurso", "Pedidos", "Artes", "Esforço", "Ajustes", "Entregues", "Parados", "Cancelados", "% do recorte"],
        d.recursos.map((r) => {
          const l = linhaRecurso(r);
          return [l.rot, l.pedidos, l.artes, l.esforco, l.ajustes, l.entregues, l.parados, l.cancelados, `${l.pct}%`];
        }));
    }
    if (tem("tabParados")) {
      secao("Parados", ["Solicitação", "Card", "Cliente", "Demandante", "Pedido", "Motivo da pausa"],
        d.porSituacao.parado.map((p) => [fmtBRL(p.data_solicitacao), p.azure_id ? "#" + p.azure_id : "", nm.cli(p), nm.dem(p), p.titulo, p.motivo_pausa || ""]));
    }
    if (tem("tabCancel")) {
      secao("Cancelados", ["Solicitação", "Card", "Cliente", "Demandante", "Pedido", "Motivo do cancelamento"],
        d.porSituacao.cancelado.map((p) => [fmtBRL(p.data_solicitacao), p.azure_id ? "#" + p.azure_id : "", nm.cli(p), nm.dem(p), p.titulo, p.motivo_cancelamento || ""]));
    }
    if (tem("tabDetalhe")) {
      secao("Planilha detalhada",
        ["Solicitação","Card","Pasta","Cliente","Demandante","Pedido","Artes","Esforço","Tipo","Entrega","Azure","Interno","Entrega combinada","Entregue","Recurso","Obs","Motivo da pausa","Motivo do cancelamento"],
        base.map((p) => [
          fmtBRL(p.data_solicitacao), p.azure_id ? "#" + p.azure_id : "", p.pasta_codigo || "",
          nm.cli(p), nm.dem(p), p.titulo, p.qtd_artes ?? 1, p.esforco ?? "", nm.tipo(p), fmtBRL(p.data_entrega),
          p.azure_state || "", nm.st(p), p.entrega_em || "", p.entregue ? "sim" : "não",
          nm.rec(p), p.observacao || "", p.motivo_pausa || "", p.motivo_cancelamento || "",
        ]));
    }
    return linhas;
  }

  function exporta(tipo) {
    if (tipo !== "xls") {
      aviso(`O ${tipo === "pdf" ? "PDF" : "PPT"} é montado no servidor a partir deste mesmo recorte. Ainda não está ligado.`);
      return;
    }
    if (!blocos.length) return aviso("Escolha ao menos um bloco em “Blocos” — o arquivo sairia vazio.");
    const linhas = planilha();
    const csv = "﻿" + linhas.map((l) => l.map(csvCampo).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${mesSel}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
    const secoes = blocos.length;
    aviso(`Planilha gerada: ${secoes} ${secoes === 1 ? "bloco" : "blocos"}, ${d.n} pedidos no recorte.`);
  }

  /* ── pedaços da tela ────────────────────────────────────────────────────── */

  function resumoFiltros() {
    const p = [];
    if (f.cli) p.push(`cliente ${f.cli}`);
    if (f.dem) p.push(`demandante ${f.dem}`);
    if (f.tipo) p.push(`tipo ${f.tipo}`);
    if (f.status) p.push(`status ${f.status}`);
    if (f.rec) p.push(`recurso ${f.rec}`);
    if (f.de) p.push(`entrega desde ${fmtBRL(f.de)}`);
    if (f.ate) p.push(`entrega até ${fmtBRL(f.ate)}`);
    if (!f.parados) p.push("sem parados");
    if (!f.cancelados) p.push("sem cancelados");
    return p.join(", ");
  }

  function indicadores() {
    return [
      { k: "Pedidos no recorte", v: d.n, s: d.n === pedidos.length ? "mês inteiro" : `de ${pedidos.length} no mês` },
      { k: "Entregues", v: d.entregues, s: `${d.pct(d.entregues, n)}% do recorte` },
      { k: "Artes entregues", v: d.artesFeitas, s: `de ${d.artesTotal} previstas` },
      { k: "Esforço somado", v: d.esforcoTotal || "—", s: "campo Effort dos cards" },
      { k: "Ajustes", v: d.ajustes, s: `${d.pct(d.ajustes, n)}% é refação` },
      { k: "Parados", v: d.parados, s: d.paradosSemMotivo ? `${d.paradosSemMotivo} sem motivo` : "todos justificados" },
      { k: "Cancelados", v: d.cancelados, s: d.canceladosSemMotivo ? `${d.canceladosSemMotivo} sem motivo` : "todos justificados" },
      { k: "Prazo médio", v: d.prazoMedio === null ? "—" : `${d.prazoMedio}d`, s: "da solicitação à entrega" },
      { k: "Dia mais cheio", v: d.pico.v, s: d.pico.rot },
      { k: "Pessoas envolvidas", v: d.recursos.length, s: `${d.demandantesTodos.length} demandantes` },
      { k: "Clientes no recorte", v: d.clientes.length, s: d.clientes[0] ? `maior: ${d.clientes[0].rot}` : "—" },
    ];
  }

  function linhaCliente(c) {
    const cs = base.filter((p) => nm.cli(p) === c.rot);
    return {
      rot: c.rot,
      pedidos: c.v,
      artes: cs.reduce((s, p) => s + (p.qtd_artes ?? 1), 0),
      esforco: cs.reduce((s, p) => s + (Number(p.esforco) || 0), 0),
      entregues: cs.filter((p) => situacaoDe(p, cfg) === "entregue").length,
      parados: cs.filter((p) => situacaoDe(p, cfg) === "parado").length,
      cancelados: cs.filter((p) => situacaoDe(p, cfg) === "cancelado").length,
      pct: d.pct(c.v, n),
    };
  }

  function linhaRecurso(r) {
    const rs = base.filter((p) => nm.rec(p) === r.rot);
    return {
      rot: r.rot,
      pedidos: r.v,
      artes: rs.reduce((s, p) => s + (p.qtd_artes ?? 1), 0),
      esforco: rs.reduce((s, p) => s + (Number(p.esforco) || 0), 0),
      ajustes: rs.filter((p) => /ajuste/i.test(nm.tipo(p))).length,
      entregues: rs.filter((p) => situacaoDe(p, cfg) === "entregue").length,
      parados: rs.filter((p) => situacaoDe(p, cfg) === "parado").length,
      cancelados: rs.filter((p) => situacaoDe(p, cfg) === "cancelado").length,
      pct: d.pct(r.v, n),
    };
  }

  const Cartao = ({ id, titulo, sub, largo, children }) =>
    tem(id) ? (
      <div className={`card${largo ? " wide" : ""}`}>
        <div className="ch-h"><h3>{titulo}</h3><span className="sub">{sub}</span></div>
        {children}
      </div>
    ) : null;

  const listaOuVazio = (dados, conteudo, msg = "Nada no recorte.") =>
    dados.length ? conteudo : <p className="nada">{msg}</p>;

  const ligados = blocos.length;

  return (
    <section>
      <div className="relbar">
        <select className="f" value={f.cli} onChange={set("cli")}>
          <option value="">Cliente</option>
          {d.clientes.map((c) => <option key={c.rot}>{c.rot}</option>)}
        </select>
        <select className="f" value={f.dem} onChange={set("dem")}>
          <option value="">Demandante</option>
          {cfg.demandantes.map((x) => <option key={x.id}>{x.nome}</option>)}
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
          {d.recursos.map((r) => <option key={r.rot}>{r.rot}</option>)}
        </select>
        <input className="f" type="date" value={f.de} onChange={set("de")} title="Entrega a partir de" />
        <input className="f" type="date" value={f.ate} onChange={set("ate")} title="Entrega até" />

        <label className="tog" title="Contar os pedidos parados neste recorte">
          <input type="checkbox" checked={f.parados} onChange={(e) => setF({ ...f, parados: e.target.checked })} />
          parados
        </label>
        <label className="tog" title="Contar os pedidos cancelados neste recorte">
          <input type="checkbox" checked={f.cancelados} onChange={(e) => setF({ ...f, cancelados: e.target.checked })} />
          cancelados
        </label>

        <button className="chipclear" onClick={() => setF(VAZIO)}>limpar</button>

        <details className="blocos">
          <summary className="hbtn">▤ Blocos <b className="mono">{ligados}/{TODOS.length}</b></summary>
          <div className="blocos-pop">
            <div className="bl-topo">
              <span>O que aparece aqui é o que sai no arquivo.</span>
              <span className="bl-acoes">
                <button className="chipclear" onClick={() => defineBlocos(TODOS)}>tudo</button>
                <button className="chipclear" onClick={() => defineBlocos([])}>nada</button>
              </span>
            </div>
            {GRUPOS_BLOCOS.map((g) => (
              <div className="bl-grupo" key={g}>
                <h4>{g}</h4>
                {BLOCOS_RELATORIO.filter((b) => b.grupo === g).map((b) => (
                  <label className="bl-item" key={b.id}>
                    <input type="checkbox" checked={tem(b.id)} onChange={() => alterna(b.id)} />
                    {b.nome}
                    {b.soExport && <em>só no arquivo</em>}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </details>

        <span className="spacer" />
        <span className="exp">
          <span className="exp-rot">Exportar</span>
          <button className="hbtn" onClick={() => exporta("xls")}>Excel</button>
          <button className="hbtn" onClick={() => exporta("ppt")}>PPT</button>
          <button className="hbtn" onClick={() => exporta("pdf")}>PDF</button>
        </span>
      </div>

      {!ligados && (
        <div className="card"><p className="nada">
          Nenhum bloco ligado. Abra <b>Blocos</b> e escolha o que quer ver — é a mesma escolha que define o arquivo exportado.
        </p></div>
      )}

      {tem("kpis") && (
        <div className="kpis kpis-rel">
          {indicadores().map((k) => (
            <div className="kpi" key={k.k}>
              <span className="k">{k.k}</span><span className="v">{k.v}</span><span className="s">{k.s}</span>
            </div>
          ))}
        </div>
      )}

      <div className="charts">
        <Cartao id="cliente" titulo="Pedidos por cliente" sub="como o mês se reparte entre as contas" largo>
          {listaOuVazio(d.clientesTop, <>
            <Legenda itens={d.clientesTop.map((x) => x.rot)} cores={PALETA} />
            <BarrasH dados={d.clientesTop} cores={PALETA} dica={dica} unidade="pedidos" />
          </>, "Nenhum card do recorte tem Campanha preenchida.")}
        </Cartao>

        <Cartao id="situacao" titulo="Situação do recorte" sub="como o mês está fechando" largo>
          {listaOuVazio(base, <BarraSituacao partes={d.situacao} dica={dica} />)}
        </Cartao>

        <Cartao id="dia" titulo="Entregas por dia" sub={`${d.porDia.length} dias com entrega`} largo>
          {listaOuVazio(d.porDia, <BarrasV dados={d.porDia} dica={dica} />)}
        </Cartao>

        <Cartao id="acumulado" titulo="Curva acumulada" sub="o previsto e o que já saiu" largo>
          <Legenda itens={["Previsto", "Entregue"]} cores={["var(--line-strong)", "var(--accent)"]} />
          {listaOuVazio(d.acumulado, <LinhaAcumulada dados={d.acumulado} dica={dica} />)}
        </Cartao>

        <Cartao id="recurso" titulo="Carga por recurso" sub="quem está segurando o mês">
          {listaOuVazio(d.recursosTop, <>
            <Legenda itens={d.recursosTop.map((x) => x.rot)} cores={PALETA} />
            <BarrasH dados={d.recursosTop} cores={PALETA} dica={dica} unidade="pedidos" />
          </>)}
        </Cartao>

        <Cartao id="artesRec" titulo="Artes por recurso" sub="volume real de peça, não de card">
          {listaOuVazio(d.artesPorRecurso, <BarrasH dados={d.artesPorRecurso} cores={PALETA} dica={dica} unidade="artes" />)}
        </Cartao>

        <Cartao id="esforcoRec" titulo="Esforço por recurso" sub="somatório do Effort dos cards">
          {listaOuVazio(d.esforcoPorRecurso.filter((x) => x.v),
            <BarrasH dados={d.esforcoPorRecurso.filter((x) => x.v)} cores={PALETA} dica={dica} />,
            "Nenhum card do recorte tem Effort preenchido.")}
        </Cartao>

        <Cartao id="demandante" titulo="Pedidos por demandante" sub="de onde vem a demanda">
          {listaOuVazio(d.demandantes, <>
            <Legenda itens={d.demandantes.map((x) => x.rot)} cores={PALETA} />
            <BarrasH dados={d.demandantes} cores={PALETA} dica={dica} unidade="pedidos" />
          </>)}
        </Cartao>

        <Cartao id="tipo" titulo="Distribuição por tipo" sub="mesmas cores da grade">
          {listaOuVazio(d.porTipo, <BarrasH dados={d.porTipo} cores={d.porTipo.map((x) => x.cor)} dica={dica} />)}
        </Cartao>

        <Cartao id="status" titulo="Status interno" sub="onde os pedidos estão">
          {listaOuVazio(d.porStatus, <BarrasH dados={d.porStatus} cores={d.porStatus.map((x) => x.cor)} dica={dica} />)}
        </Cartao>

        <Cartao id="atrito" titulo="Parados e cancelados por demandante" sub="onde a demanda trava">
          {listaOuVazio(d.atritoDem, <>
            <Legenda itens={["Parado", "Cancelado"]} cores={["var(--none)", "var(--alerta)"]} />
            <BarrasEmpilhadas
              linhas={d.atritoDem}
              series={[{ nome: "Parado", cor: "var(--none)" }, { nome: "Cancelado", cor: "var(--alerta)" }]}
              dica={dica}
            />
          </>, "Nada parado nem cancelado no recorte — é a melhor notícia possível.")}
        </Cartao>
      </div>

      {tem("tabCliente") && (
        <div className="card">
          <div className="ch-h"><h3>Resumo por cliente</h3><span className="sub">de quem é o mês</span></div>
          <table className="res">
            <thead>
              <tr>
                <th>Cliente</th><th className="num">Pedidos</th><th className="num">Artes</th>
                <th className="num">Esforço</th><th className="num">Entregues</th>
                <th className="num">Parados</th><th className="num">Cancelados</th>
                <th className="num">% do recorte</th><th style={{ width: 130 }} />
              </tr>
            </thead>
            <tbody>
              {d.clientes.map((c) => {
                const l = linhaCliente(c);
                return (
                  <tr key={l.rot}>
                    <td>{l.rot}</td>
                    <td className="num">{l.pedidos}</td>
                    <td className="num">{l.artes}</td>
                    <td className="num">{l.esforco || "—"}</td>
                    <td className="num">{l.entregues}</td>
                    <td className="num">{l.parados || "—"}</td>
                    <td className="num">{l.cancelados || "—"}</td>
                    <td className="num">{l.pct}%</td>
                    <td><span className="bar-inline" style={{ width: `${Math.max(2, l.pct)}%` }} /></td>
                  </tr>
                );
              })}
              {!d.clientes.length && (
                <tr><td colSpan={9}><p className="nada">Nenhum card do recorte tem Campanha preenchida.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tem("tabRecurso") && (
        <div className="card">
          <div className="ch-h"><h3>Resumo por recurso</h3><span className="sub">a mesma base em tabela</span></div>
          <table className="res">
            <thead>
              <tr>
                <th>Recurso</th><th className="num">Pedidos</th><th className="num">Artes</th>
                <th className="num">Esforço</th><th className="num">Ajustes</th><th className="num">Entregues</th>
                <th className="num">Parados</th><th className="num">Cancelados</th>
                <th className="num">% do recorte</th><th style={{ width: 130 }} />
              </tr>
            </thead>
            <tbody>
              {d.recursos.map((r) => {
                const l = linhaRecurso(r);
                return (
                  <tr key={l.rot}>
                    <td>{l.rot}</td>
                    <td className="num">{l.pedidos}</td>
                    <td className="num">{l.artes}</td>
                    <td className="num">{l.esforco || "—"}</td>
                    <td className="num">{l.ajustes}</td>
                    <td className="num">{l.entregues}</td>
                    <td className="num">{l.parados || "—"}</td>
                    <td className="num">{l.cancelados || "—"}</td>
                    <td className="num">{l.pct}%</td>
                    <td><span className="bar-inline" style={{ width: `${Math.max(2, l.pct)}%` }} /></td>
                  </tr>
                );
              })}
              {!d.recursos.length && (
                <tr><td colSpan={10}><p className="nada">Nenhum recurso atribuído no recorte.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {["tabParados", "tabCancel"].map((id) => {
        if (!tem(id)) return null;
        const parados = id === "tabParados";
        const itens = parados ? d.porSituacao.parado : d.porSituacao.cancelado;
        const campo = parados ? "motivo_pausa" : "motivo_cancelamento";
        return (
          <div className="card" key={id}>
            <div className="ch-h">
              <h3>{parados ? "Parados" : "Cancelados"}</h3>
              <span className="sub">{itens.length} no recorte · o motivo se escreve na área própria</span>
            </div>
            <table className="res">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Solicitação</th><th style={{ width: 110 }}>Card</th>
                  <th style={{ width: 140 }}>Cliente</th>
                  <th style={{ width: 150 }}>Demandante</th><th>Pedido</th>
                  <th>{parados ? "Motivo da pausa" : "Motivo do cancelamento"}</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{fmtBR(p.data_solicitacao)}</td>
                    <td className="mono">{p.azure_id ? `#${p.azure_id}` : "—"}</td>
                    <td>{nm.cli(p) || "—"}</td>
                    <td>{nm.dem(p) || "—"}</td>
                    <td>{p.titulo}</td>
                    <td className={(p[campo] || "").trim() ? "" : "sem-motivo"}>
                      {(p[campo] || "").trim() || "sem motivo preenchido"}
                    </td>
                  </tr>
                ))}
                {!itens.length && (
                  <tr><td colSpan={6}><p className="nada">Nada {parados ? "parado" : "cancelado"} no recorte.</p></td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </section>
  );
}
