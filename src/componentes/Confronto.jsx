"use client";

import { useMemo, useState } from "react";
import { fmtBR } from "@/lib/formato";
import { urlCard } from "@/lib/azure-cliente";
import { MAPA_ESTADO, corEstado } from "@/lib/constantes";

/**
 * Confronto Azure × pauta.
 *
 * Mostra o card que está aberto no Azure e não existe na pauta. Em regime
 * normal esta lista fica vazia — o sync traz tudo. Ela enche quando um card é
 * mais velho que a primeira sincronização, quando alguém apagou a linha à mão,
 * ou quando um lote do sync falhou. É por isso que a tela existe: é a única
 * forma de descobrir o que o sync não trouxe sem abrir o Azure card a card.
 */
const VAZIO = { cli: "", est: "", resp: "", q: "" };

/** Colunas da lista: `campo` é o que ordena; sem `campo`, não é clicável. */
const COLUNAS = [
  { id: "azure_id",          rotulo: "Card",            largura: 100, campo: "azure_id", num: true },
  { id: "campanha",          rotulo: "Cliente",         largura: 150, campo: "campanha" },
  { id: "titulo",            rotulo: "Pedido",          campo: "titulo" },
  { id: "azure_state",       rotulo: "Estado no Azure", largura: 170, campo: "azure_state" },
  { id: "azure_assigned_to", rotulo: "Responsável",     largura: 140, campo: "azure_assigned_to" },
  { id: "data_solicitacao",  rotulo: "Criado",          largura: 90,  campo: "data_solicitacao" },
  { id: "data_entrega",      rotulo: "Entrega",         largura: 90,  campo: "data_entrega" },
  { id: "acao",              rotulo: "",                largura: 110 },
];

export default function Confronto({ confronto, aoTrazer }) {
  const { dados, estado, msg, conferir } = confronto;
  const [f, setF] = useState(VAZIO);
  const [ordem, setOrdem] = useState({ campo: "azure_id", dir: "desc" });

  const todos = useMemo(() => dados?.faltando || [], [dados]);

  const opcoes = useMemo(() => {
    const unicos = (chave, rotulo = (x) => x) =>
      [...new Set(todos.map((c) => c[chave]).filter(Boolean))]
        .map((v) => ({ v, r: rotulo(v) }))
        .sort((a, b) => String(a.r).localeCompare(String(b.r), "pt"));
    return {
      cli: unicos("campanha"),
      est: unicos("azure_state", (v) => MAPA_ESTADO[v] || v),
      resp: unicos("azure_assigned_to"),
    };
  }, [todos]);

  const faltando = useMemo(() => {
    const busca = f.q.trim().toLowerCase();
    const filtrados = todos.filter(
      (c) =>
        (!f.cli || c.campanha === f.cli) &&
        (!f.est || c.azure_state === f.est) &&
        (!f.resp || c.azure_assigned_to === f.resp) &&
        (!busca ||
          (c.titulo || "").toLowerCase().includes(busca) ||
          String(c.azure_id).includes(busca))
    );
    const col = COLUNAS.find((x) => x.campo === ordem.campo);
    const sinal = ordem.dir === "asc" ? 1 : -1;
    return filtrados.sort((a, b) => {
      const va = a[ordem.campo];
      const vb = b[ordem.campo];
      if (!va && !vb) return 0;
      if (!va) return 1;   // vazio sempre no fim, seja qual for a direção
      if (!vb) return -1;
      const cmp = col?.num ? va - vb : String(va).localeCompare(String(vb), "pt", { numeric: true });
      return cmp * sinal;
    });
  }, [todos, f, ordem]);

  const aoOrdenar = (c) => {
    if (!c.campo) return;
    setOrdem((a) =>
      a.campo === c.campo
        ? { campo: c.campo, dir: a.dir === "asc" ? "desc" : "asc" }
        : { campo: c.campo, dir: c.num ? "desc" : "asc" }
    );
  };

  if (estado === "sem-permissao") {
    return (
      <div className="card">
        <div className="ch-h"><h3>Confronto com o Azure</h3></div>
        <p className="nada">
          Esta conferência lê o Azure com o nosso acesso, então pede login de editor.
          Clique em <b>Só leitura</b> no topo e entre para usá-la.
        </p>
      </div>
    );
  }

  if (estado === "carregando") {
    return (
      <div className="card">
        <div className="ch-h"><h3>Confronto com o Azure</h3><span className="sub">consultando…</span></div>
        <p className="nada">Lendo os cards abertos no Azure e comparando com a pauta…</p>
      </div>
    );
  }

  if (estado === "erro") {
    return (
      <div className="card">
        <div className="ch-h">
          <h3>Confronto com o Azure</h3>
          <button className="hbtn" onClick={conferir}>Tentar de novo</button>
        </div>
        <p className="nada">{msg}</p>
        <p className="nada" style={{ marginTop: 0 }}>
          Se disser que a função não existe, falta publicar a <b>azure-pendentes</b> no Supabase.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="conf-topo">
        <div className="kpis kpis-conf">
          <div className="kpi">
            <span className="k">Abertos no Azure</span>
            <span className="v">{dados.abertos}</span>
            <span className="s">{dados.tipo ? `tipo ${dados.tipo}` : "todos os tipos"} · fora de {(dados.estadosFinais || []).join(", ")}</span>
          </div>
          <div className="kpi">
            <span className="k">Já na pauta</span>
            <span className="v">{dados.naPauta}</span>
            <span className="s">{dados.abertos ? Math.round((dados.naPauta / dados.abertos) * 100) : 0}% do aberto</span>
          </div>
          <div className={`kpi${todos.length ? " kpi-alerta" : ""}`}>
            <span className="k">Fora da pauta</span>
            <span className="v">{todos.length}</span>
            <span className="s">{todos.length ? "precisam entrar" : "nada faltando"}</span>
          </div>
        </div>
        <button className="hbtn" onClick={conferir}>↻ Conferir de novo</button>
      </div>

      <div className="card">
        <div className="ch-h">
          <h3>Cards {dados.tipo ? <em style={{ fontStyle: "normal", color: "var(--accent-ink)" }}>{dados.tipo}</em> : ""} abertos que não estão na pauta</h3>
          <span className="sub">o Azure é a fonte; a pauta deveria espelhar</span>
        </div>

        {!todos.length ? (
          <p className="nada">
            Tudo o que está aberto no Azure já está na pauta. É assim que tem que ser —
            a lista só enche quando o sync perde alguma coisa.
          </p>
        ) : (
          <>
            <div className="conf-barra">
              <select className="f" value={f.cli} onChange={(e) => setF({ ...f, cli: e.target.value })}>
                <option value="">Cliente</option>
                {opcoes.cli.map((o) => <option key={o.v} value={o.v}>{o.r}</option>)}
              </select>
              <select className="f" value={f.est} onChange={(e) => setF({ ...f, est: e.target.value })}>
                <option value="">Estado</option>
                {opcoes.est.map((o) => <option key={o.v} value={o.v}>{o.r}</option>)}
              </select>
              <select className="f" value={f.resp} onChange={(e) => setF({ ...f, resp: e.target.value })}>
                <option value="">Responsável</option>
                {opcoes.resp.map((o) => <option key={o.v} value={o.v}>{o.r}</option>)}
              </select>
              <input className="search" type="search" placeholder="Buscar pedido ou nº…"
                value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
              <button className="chipclear" onClick={() => setF(VAZIO)}>limpar</button>
              <span className="spacer" />
              <span className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>
                {faltando.length === todos.length ? `${todos.length} cards` : `${faltando.length} de ${todos.length}`}
              </span>
            </div>

            <table className="res">
              <thead>
                <tr>
                  {COLUNAS.map((c) => {
                    const ativa = c.campo && ordem.campo === c.campo;
                    return (
                      <th key={c.id} style={c.largura ? { width: c.largura } : undefined}
                        className={c.campo ? "ord" : ""}
                        aria-sort={ativa ? (ordem.dir === "asc" ? "ascending" : "descending") : undefined}
                        title={c.campo ? "Clique para ordenar" : undefined}
                        onClick={() => aoOrdenar(c)}>
                        {c.rotulo}
                        {ativa && <span className="seta">{ordem.dir === "asc" ? "▲" : "▼"}</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {faltando.map((c) => {
                  const estadoBr = MAPA_ESTADO[c.azure_state] || (c.azure_state || "").toUpperCase();
                  return (
                    <tr key={c.azure_id}>
                      <td>
                        <span className="link">
                          <a href={urlCard(c.azure_id)} target="_blank" rel="noopener noreferrer">#{c.azure_id} ↗</a>
                        </span>
                      </td>
                      <td>{c.campanha || <em className="conf-sem">sem campanha</em>}</td>
                      <td title={c.titulo || ""}>{c.titulo || <em>sem título</em>}</td>
                      <td>
                        <span className="azchip">
                          <i style={{ background: corEstado(estadoBr) }} />{estadoBr || "—"}
                        </span>
                      </td>
                      <td>{c.azure_assigned_to || "—"}</td>
                      <td className="mono">{c.data_solicitacao ? fmtBR(c.data_solicitacao) : "—"}</td>
                      <td className="mono">{c.data_entrega ? fmtBR(c.data_entrega) : "—"}</td>
                      <td>
                        <button className="hbtn conf-trazer" onClick={() => aoTrazer(c.azure_id)}>
                          trazer ↓
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!faltando.length && (
                  <tr><td colSpan={COLUNAS.length}>
                    <p className="nada">Nenhum card com esses filtros.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}
