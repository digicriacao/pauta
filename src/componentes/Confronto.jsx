"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { chamaFuncao } from "@/lib/funcoes";
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
export default function Confronto({ podeEditar, aoTrazer, aviso }) {
  const [estado, setEstado] = useState("carregando");
  const [dados, setDados] = useState(null);
  const [msg, setMsg] = useState("");

  const conferir = useCallback(async () => {
    if (!podeEditar) return setEstado("sem-permissao");
    setEstado("carregando");
    try {
      const { data } = (await supabase()?.auth.getSession()) || {};
      const { ok, dados: r } = await chamaFuncao("azure-pendentes", {}, data?.session?.access_token);
      if (!ok) {
        setMsg(r?.erro || "Não consegui falar com o Azure.");
        return setEstado("erro");
      }
      setDados(r);
      setEstado("ok");
    } catch {
      setMsg("Não consegui falar com o Azure agora.");
      setEstado("erro");
    }
  }, [podeEditar]);

  useEffect(() => { conferir(); }, [conferir]);

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

  const faltando = dados?.faltando || [];

  return (
    <>
      <div className="conf-topo">
        <div className="kpis kpis-conf">
          <div className="kpi">
            <span className="k">Abertos no Azure</span>
            <span className="v">{dados.abertos}</span>
            <span className="s">fora de {(dados.estadosFinais || []).join(", ")}</span>
          </div>
          <div className="kpi">
            <span className="k">Já na pauta</span>
            <span className="v">{dados.naPauta}</span>
            <span className="s">{dados.abertos ? Math.round((dados.naPauta / dados.abertos) * 100) : 0}% do aberto</span>
          </div>
          <div className={`kpi${faltando.length ? " kpi-alerta" : ""}`}>
            <span className="k">Fora da pauta</span>
            <span className="v">{faltando.length}</span>
            <span className="s">{faltando.length ? "precisam entrar" : "nada faltando"}</span>
          </div>
        </div>
        <button className="hbtn" onClick={conferir}>↻ Conferir de novo</button>
      </div>

      <div className="card">
        <div className="ch-h">
          <h3>Cards abertos que não estão na pauta</h3>
          <span className="sub">o Azure é a fonte; a pauta deveria espelhar</span>
        </div>

        {!faltando.length ? (
          <p className="nada">
            Tudo o que está aberto no Azure já está na pauta. É assim que tem que ser —
            a lista só enche quando o sync perde alguma coisa.
          </p>
        ) : (
          <table className="res">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Card</th>
                <th style={{ width: 100 }}>Tipo</th>
                <th style={{ width: 140 }}>Cliente</th>
                <th>Pedido</th>
                <th style={{ width: 170 }}>Estado no Azure</th>
                <th style={{ width: 130 }}>Responsável</th>
                <th style={{ width: 90 }}>Entrega</th>
                <th style={{ width: 120 }} />
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
                    <td className="mono conf-tipo">{c.tipo || "—"}</td>
                    <td>{c.campanha || <em className="conf-sem">sem campanha</em>}</td>
                    <td title={c.titulo || ""}>{c.titulo || <em>sem título</em>}</td>
                    <td>
                      <span className="azchip">
                        <i style={{ background: corEstado(estadoBr) }} />{estadoBr || "—"}
                      </span>
                    </td>
                    <td>{c.azure_assigned_to || "—"}</td>
                    <td className="mono">{c.data_entrega ? fmtBR(c.data_entrega) : "—"}</td>
                    <td>
                      <button className="hbtn conf-trazer" onClick={() => aoTrazer(c.azure_id)}>
                        trazer ↓
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
