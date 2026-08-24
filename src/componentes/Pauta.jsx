"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDados, useSessao } from "@/lib/dados";
import { supabase } from "@/lib/supabase-browser";
import { chamaFuncao } from "@/lib/funcoes";
import { mesDe, mesesDoAno, hojeISO } from "@/lib/formato";
import Cabecalho from "./Cabecalho";
import Resumo from "./Resumo";
import Grade from "./Grade";
import FocoPedido from "./FocoPedido";
import Login from "./Login";
import Admin from "./Admin";
import Relatorios from "./Relatorios";

export default function Pauta() {
  const { cfg, pedidos, carregando, erro, recarregar, salvarCampo, criarPedido, removerPedido } = useDados();
  const { perfil, podeEditar, ehAdmin, recarregar: relerSessao, sair } = useSessao();

  const [mesSel, setMesSel] = useState(() => hojeISO().slice(0, 7));
  const [vista, setVista] = useState("pauta");
  const [filtros, setFiltros] = useState({ dem: "", tipo: "", status: "", rec: "", q: "" });
  const [foco, setFoco] = useState(null);
  const [salvandoFoco, setSalvandoFoco] = useState(false);
  const [mostraLogin, setMostraLogin] = useState(false);
  const [mostraAdmin, setMostraAdmin] = useState(false);
  const [toast, setToast] = useState("");
  const [dicaTxt, setDicaTxt] = useState(null);
  const [dicaPos, setDicaPos] = useState({ x: 0, y: 0 });
  const tmr = useRef(null);
  const headerRef = useRef(null);

  const aviso = useCallback((txt) => {
    setToast(txt);
    clearTimeout(tmr.current);
    tmr.current = setTimeout(() => setToast(""), 6500);
  }, []);

  const dica = useCallback((txt, ev) => {
    if (!txt) return setDicaTxt(null);
    setDicaTxt(txt);
    setDicaPos({ x: ev.clientX + 14, y: ev.clientY - 36 });
  }, []);

  // A barra de filtros gruda logo abaixo do cabeçalho, que muda de altura.
  useEffect(() => {
    const ajusta = () => {
      const h = document.querySelector("header")?.offsetHeight || 58;
      document.documentElement.style.setProperty("--htop", `${h}px`);
    };
    ajusta();
    const alvo = document.querySelector("header");
    if (!alvo) return;
    const ro = new ResizeObserver(ajusta);
    ro.observe(alvo);
    return () => ro.disconnect();
  }, [carregando, vista]);

  const meses = useMemo(() => mesesDoAno(hojeISO().slice(0, 7)), []);
  const contaMes = useCallback((ym) => pedidos.filter((p) => mesDe(p) === ym).length, [pedidos]);

  const doMes = useMemo(
    () =>
      pedidos
        .filter((p) => mesDe(p) === mesSel)
        .sort((a, b) => String(b.data_solicitacao || "").localeCompare(String(a.data_solicitacao || ""))),
    [pedidos, mesSel]
  );

  const nomeRec = useCallback(
    (p) => cfg.recursos.find((r) => r.nome_azure === p.azure_assigned_to)?.nome_pauta || p.azure_assigned_to || "",
    [cfg.recursos]
  );

  const visiveis = useMemo(
    () =>
      doMes.filter((p) => {
        const dem = cfg.demandantes.find((d) => d.id === p.demandante_id)?.nome || "";
        const tipo = cfg.tipos.find((t) => t.id === p.tipo_id)?.nome || "";
        const st = cfg.status.find((s) => s.id === p.status_interno_id)?.nome || "";
        return (
          (!filtros.dem || dem === filtros.dem) &&
          (!filtros.tipo || tipo === filtros.tipo) &&
          (!filtros.status || st === filtros.status) &&
          (!filtros.rec || nomeRec(p) === filtros.rec) &&
          (!filtros.q || (p.titulo || "").toLowerCase().includes(filtros.q))
        );
      }),
    [doMes, filtros, cfg, nomeRec]
  );

  /** Colou o link: a Edge Function lê o card e a tela abre no modo foco. */
  async function aoColar(azureId) {
    if (!podeEditar) return setMostraLogin(true);
    const jaTem = pedidos.find((p) => p.azure_id === azureId);
    if (jaTem) return aviso(`O card #${azureId} já está na pauta — “${jaTem.titulo}”.`);
    try {
      const { data } = (await supabase()?.auth.getSession()) || {};
      const { ok, dados } = await chamaFuncao(
        "azure-card",
        { id: azureId },
        data?.session?.access_token,
      );
      if (!ok) return aviso(dados.erro || "Não consegui ler o card no Azure.");
      if (dados.jaNaPauta) return aviso(`O card #${azureId} já está na pauta — “${dados.jaNaPauta.titulo}”.`);
      setFoco(dados.card);
    } catch {
      aviso("Não consegui falar com o Azure agora.");
    }
  }

  async function confirmaFoco(extras) {
    setSalvandoFoco(true);
    const { erro: e } = await criarPedido({ cliente_id: cfg.cliente.id, ...foco, tags: undefined, ...extras });
    setSalvandoFoco(false);
    if (e) return aviso(`Não deu para salvar: ${e}`);
    setFoco(null);
    aviso(`Card #${foco.azure_id} entrou na pauta.`);
  }

  if (erro) {
    return (
      <main className="wrap" style={{ paddingTop: 40 }}>
        <div className="card"><h3>Não consegui carregar a pauta</h3><p style={{ color: "var(--muted)" }}>{erro}</p></div>
      </main>
    );
  }

  return (
    <>
      <div ref={headerRef}>
        <Cabecalho
          cliente={cfg.cliente} meses={meses} mesAtual={hojeISO().slice(0, 7)}
          mesSel={mesSel} setMesSel={setMesSel} contaMes={contaMes}
          perfil={perfil} podeEditar={podeEditar} ehAdmin={ehAdmin}
          aoLogin={() => setMostraLogin(true)} aoAdmin={() => setMostraAdmin(true)}
          vista={vista} setVista={setVista}
        />
      </div>

      <main className="wrap">
        {vista === "pauta" && <Resumo pedidos={doMes} mesSel={mesSel} cfg={cfg} />}

        {vista === "pauta" ? (
          <section>
            <div className="toolbar">
              <select className="f" value={filtros.dem} onChange={(e) => setFiltros({ ...filtros, dem: e.target.value })}>
                <option value="">Demandante</option>
                {cfg.demandantes.map((d) => <option key={d.id}>{d.nome}</option>)}
              </select>
              <select className="f" value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}>
                <option value="">Tipo</option>
                {cfg.tipos.map((t) => <option key={t.id}>{t.nome}</option>)}
              </select>
              <select className="f" value={filtros.status} onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}>
                <option value="">Status interno</option>
                {cfg.status.map((s) => <option key={s.id}>{s.nome}</option>)}
              </select>
              <select className="f" value={filtros.rec} onChange={(e) => setFiltros({ ...filtros, rec: e.target.value })}>
                <option value="">Recurso</option>
                {[...new Set(pedidos.map(nomeRec).filter(Boolean))].sort().map((r) => <option key={r}>{r}</option>)}
              </select>
              <input className="search" type="search" placeholder="Buscar pedido…"
                value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value.toLowerCase().trim() })} />
              <button className="chipclear" onClick={() => setFiltros({ dem: "", tipo: "", status: "", rec: "", q: "" })}>limpar</button>
              <span className="spacer" />
              <span className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>
                {carregando ? "carregando…" : visiveis.length === doMes.length ? `${doMes.length} pedidos` : `${visiveis.length} de ${doMes.length}`}
              </span>
            </div>

            <Grade
              pedidos={visiveis} cfg={cfg} podeEditar={podeEditar}
              salvar={salvarCampo} remover={removerPedido} aoColar={aoColar} aviso={aviso}
            />
          </section>
        ) : (
          <Relatorios pedidos={doMes} cfg={cfg} mesSel={mesSel} aviso={aviso} dica={dica} />
        )}

        <footer>
          <b>Pauta v2 · {cfg.cliente?.nome}.</b> As colunas 🔵 Azure, 📁 Pasta, Pedido, 📅 Entrega e Recurso vêm do card
          e são atualizadas pelo sync a cada 10 minutos. O resto é da casa e ninguém sobrescreve.
        </footer>
      </main>

      {foco && (
        <FocoPedido card={foco} cfg={cfg} salvando={salvandoFoco}
          aoConfirmar={confirmaFoco} aoCancelar={() => setFoco(null)} />
      )}

      {mostraLogin && (
        <Login perfil={perfil} podeEditar={podeEditar}
          aoFechar={() => setMostraLogin(false)} aoEntrar={relerSessao} aoSair={sair} />
      )}

      {mostraAdmin && ehAdmin && (
        <Admin cfg={cfg} aoFechar={() => setMostraAdmin(false)} recarregar={recarregar} aviso={aviso} />
      )}

      {dicaTxt && (
        <div className="tip on" style={{ left: dicaPos.x, top: dicaPos.y }}
          dangerouslySetInnerHTML={{ __html: dicaTxt }} />
      )}

      <div className={`toast ${toast ? "on" : ""}`}>{toast}</div>
    </>
  );
}
