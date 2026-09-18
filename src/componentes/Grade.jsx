"use client";

import { useState } from "react";
import { COLUNAS, LS_LARGURAS, MAPA_ESTADO, corEstado } from "@/lib/constantes";
import { fmtBR, deInputLocal, hojeISO } from "@/lib/formato";
import { urlCard, urlNovoCard, idDoLink } from "@/lib/azure-cliente";
import { useLarguras } from "@/lib/larguras";
import { nomeCurto } from "@/lib/recursos";
import { Cabecalhos, Colunas, CampoData, CampoTexto } from "./GradeBase";

const mix = (cor, pct) => `color-mix(in srgb, ${cor} ${pct}, var(--surface))`;

/** Campo de colar link. Dispara assim que reconhece um número de card. */
function ColarCard({ aoColar, desabilitado, alerta }) {
  const [txt, setTxt] = useState("");
  return (
    <span className="link">
      <input
        className={`paste${alerta ? " alerta" : ""}`} placeholder="Colar link card"
        disabled={desabilitado} value={txt}
        onChange={(e) => {
          const v = e.target.value;
          setTxt(v);
          const id = idDoLink(v);
          if (id) { setTxt(""); aoColar(id); }
        }}
      />
    </span>
  );
}

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

function Linha({ p, cfg, colunas, podeEditar, salvar, remover, marcar, aoVincular }) {
  const dis = !podeEditar;
  const estado = MAPA_ESTADO[p.azure_state] || (p.azure_state ? p.azure_state.toUpperCase() : "");
  const recurso = nomeCurto(cfg.recursos, p.azure_assigned_to);
  // Pedido anotado à mão, ainda sem card no Azure: linha incompleta.
  const rascunho = !p.azure_id;
  // O status interno pode marcar a linha como parada ou cancelada — as duas
  // saem do fluxo normal e ganham tratamento visual próprio.
  const st = cfg.status.find((s) => s.id === p.status_interno_id);
  // Fura-fila passa na frente de tudo, inclusive do cinza de parado e
  // cancelado: é o único destaque que pede ação agora, não atenção depois.
  const fura = /fura/i.test(cfg.tipos.find((t) => t.id === p.tipo_id)?.nome || "");
  const excecao = fura ? "fura" : st?.cancelamento ? "cancelada" : st?.pausa ? "parada" : "";

  /* As células ficam num mapa por id, e a ORDEM de saída vem de `colunas`.
     Antes eram dezessete <td> soltos em sequência; com o filtro de colunas isso
     não serve mais, porque esconder a quinta coluna exige não desenhar a quinta
     célula — e não dá para contar posição num JSX escrito à mão. O mapa também
     garante que célula e cabeçalho nunca saiam de sincronia: os dois passam a
     ler a mesma lista. */
  const celulas = {
    data_solicitacao: (
      <td key="data_solicitacao">
        <CampoData valor={p.data_solicitacao} desabilitado={dis}
          aoMudar={(v) => salvar(p.id, { data_solicitacao: v || null })} />
      </td>
    ),
    azure_id: (
      <td key="azure_id">
        {rascunho
          ? <ColarCard alerta desabilitado={dis} aoColar={(id) => aoVincular(p, id)} />
          : <span className="link">
              <a href={urlCard(p.azure_id)} target="_blank" rel="noopener noreferrer">#{p.azure_id} ↗</a>
            </span>}
      </td>
    ),
    pasta_codigo: (
      <td key="pasta_codigo">
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
    ),
    campanha: (
      <td key="campanha">
        {/* Cliente = campo Campanha do card. Só a linha sem card aceita digitar. */}
        {rascunho ? (
          <CampoTexto valor={p.campanha} desabilitado={dis} placeholder="cliente"
            lista="clientes-pauta" dica="Enquanto não houver card, escreva o cliente à mão"
            aoSalvar={(v) => salvar(p.id, { campanha: v })} />
        ) : p.campanha ? (
          <div className="ro cliente" title={`Campanha no card: ${p.campanha}`}>{p.campanha}</div>
        ) : (
          <div className="ro empty">sem campanha</div>
        )}
      </td>
    ),
    demandante_id: (
      <td key="demandante_id">
        <select className="cell" value={p.demandante_id ?? ""} disabled={dis}
          onChange={(e) => salvar(p.id, { demandante_id: e.target.value ? Number(e.target.value) : null })}>
          <option value=""></option>
          {cfg.demandantes.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
      </td>
    ),
    titulo: (
      <td key="titulo" className="pedido">
        {rascunho ? (
          <span className="rasc">
            <CampoTexto classe="titulo" valor={p.titulo} desabilitado={dis}
              placeholder="nome do pedido" permiteVazio={false}
              aoSalvar={(v) => salvar(p.id, { titulo: v })} />
            <a className="abrir-card" href={urlNovoCard(p.titulo, p.campanha)}
               target="_blank" rel="noopener noreferrer"
               title="Abre o formulário de card novo no Azure, já com este título">
              ↗ card
            </a>
          </span>
        ) : (
          <div className="ro" title={p.titulo || ""}>{p.titulo || <em>sem título</em>}</div>
        )}
      </td>
    ),
    qtd_artes: (
      <td key="qtd_artes">
        <input className="qtd" type="number" min="0" step="1" inputMode="numeric" disabled={dis}
          defaultValue={p.qtd_artes ?? 0}
          title="Quantidade de artes deste pedido"
          onBlur={(e) => {
            const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
            e.target.value = n;
            if (n !== (p.qtd_artes ?? 0)) salvar(p.id, { qtd_artes: n });
          }} />
      </td>
    ),
    esforco: (
      <td key="esforco">
        {p.esforco === null || p.esforco === undefined
          ? <div className="ro empty">—</div>
          : <div className="ro mono" title="Esforço registrado no card">{p.esforco}</div>}
      </td>
    ),
    tipo_id: (
      <td key="tipo_id">
        <Chip valor={p.tipo_id} opcoes={cfg.tipos} desabilitado={dis}
          aoMudar={(v) => salvar(p.id, { tipo_id: v })} />
      </td>
    ),
    data_entrega: (
      <td key="data_entrega">
        {p.data_entrega
          ? <div className="ro mono">{fmtBR(p.data_entrega)}</div>
          : <div className="ro empty">vem do card</div>}
      </td>
    ),
    azure_state: (
      <td key="azure_state">
        {estado
          ? <span className="azchip"><i style={{ background: corEstado(estado) }} />{estado}</span>
          : <div className="ro empty">—</div>}
      </td>
    ),
    status_interno_id: (
      <td key="status_interno_id">
        <Chip valor={p.status_interno_id} opcoes={cfg.status} desabilitado={dis}
          aoMudar={(v) => {
            const st = cfg.status.find((s) => s.id === v);
            salvar(p.id, { status_interno_id: v, entregue: !!st?.entrega });
          }} />
      </td>
    ),
    entrega_em: (
      <td key="entrega_em">
        <CampoData hora valor={p.entrega_em} desabilitado={dis}
          aoMudar={(v) => salvar(p.id, { entrega_em: deInputLocal(v) })} />
      </td>
    ),
    entregue: (
      <td key="entregue">
        <button className={`chk ${p.entregue ? "on" : ""}`} disabled={dis}
          title={p.entregue ? "Entregue — clique para reabrir" : "Marcar como entregue"}
          onClick={() => marcar(p)}>✓</button>
      </td>
    ),
    recurso: (
      <td key="recurso">
        {p.azure_assigned_to
          ? <div className="ro" title={`Azure: ${p.azure_assigned_to}`}>{recurso}</div>
          : <div className="ro empty">—</div>}
      </td>
    ),
    observacao: (
      <td key="observacao">
        <CampoTexto valor={p.observacao} desabilitado={dis} placeholder="…"
          aoSalvar={(v) => salvar(p.id, { observacao: v })} />
      </td>
    ),
    acoes: (
      <td key="acoes">
        <button className="del" disabled={dis} title="Remover linha" onClick={() => remover(p)}>×</button>
      </td>
    ),
  };

  return (
    <tr className={`${p.entregue ? "feito" : ""} ${rascunho ? "rascunho" : ""} ${excecao}`}>
      {colunas.map((c) => celulas[c.id])}
    </tr>
  );
}

export default function Grade({ pedidos, cfg, clientes = [], colunas = COLUNAS, podeEditar, salvar, remover, aoColar, aoIniciar, aoVincular, aviso, ordem, aoOrdenar }) {
  const { larg, pegaBorda } = useLarguras(LS_LARGURAS);
  const [nomeNovo, setNomeNovo] = useState("");

  async function marcar(p) {
    const stEntrega = cfg.status.find((s) => s.entrega);
    const stProducao = cfg.status.find((s) => !s.entrega && !s.cancelamento && !s.pausa) || null;
    const virou = !p.entregue;
    await salvar(p.id, {
      entregue: virou,
      status_interno_id: virou ? stEntrega?.id ?? p.status_interno_id : stProducao?.id ?? null,
    });
  }

  const total = colunas.reduce((s, c) => s + larg(c), 0);

  return (
    <div className="gridwrap">
      <datalist id="clientes-pauta">
        {clientes.map((c) => <option key={c} value={c} />)}
      </datalist>
      <table className="grade" style={{ minWidth: total, width: "100%" }}>
        <Colunas colunas={colunas} larg={larg} />
        <Cabecalhos colunas={colunas} larg={larg} pegaBorda={pegaBorda} ordem={ordem} aoOrdenar={aoOrdenar} />
        <tbody>
          {/* linha nova, sempre no topo: é onde se cola o link do card */}
          <tr className="novo">
            {/* Mesma lógica das células da Linha: o que existe aqui é a data de
                hoje, o campo de colar e o de iniciar pedido; o resto é célula
                vazia, e todos saem na ordem de `colunas`. */}
            {colunas.map((c) => {
              if (c.id === "data_solicitacao") {
                return <td key={c.id}><span className="ro mono">{fmtBR(hojeISO())}</span></td>;
              }
              if (c.id === "azure_id") {
                return <td key={c.id}><ColarCard desabilitado={!podeEditar} aoColar={aoColar} /></td>;
              }
              if (c.id === "titulo") {
                return (
                  <td key={c.id}>
                    <input
                      className="novo-pedido" placeholder="Iniciar pedido" disabled={!podeEditar}
                      value={nomeNovo}
                      onChange={(e) => setNomeNovo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        const v = nomeNovo.trim();
                        if (!v) return;
                        setNomeNovo("");
                        aoIniciar(v);
                      }}
                      title="Escreva o nome do pedido e aperte Enter. A linha entra sem card, marcada em vermelho."
                    />
                  </td>
                );
              }
              return <td key={c.id} />;
            })}
          </tr>
          {pedidos.map((p) => (
            <Linha key={p.id} p={p} cfg={cfg} colunas={colunas} podeEditar={podeEditar}
              salvar={async (id, campos) => {
                const r = await salvar(id, campos);
                if (r?.erro) aviso(`Não deu para salvar: ${r.erro}`);
              }}
              remover={async (ped) => {
                const r = await remover(ped.id);
                if (r?.erro) aviso(`Não deu para remover: ${r.erro}`);
              }}
              marcar={marcar} aoVincular={aoVincular} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
