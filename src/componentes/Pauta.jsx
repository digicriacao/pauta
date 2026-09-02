"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDados, useReguas, useSessao, useConfronto } from "@/lib/dados";
import { usePresenca } from "@/lib/presenca";
import { nomeCurto } from "@/lib/recursos";
import { supabase } from "@/lib/supabase-browser";
import { chamaFuncao } from "@/lib/funcoes";
import { mesDe, mesesDoAno, hojeISO } from "@/lib/formato";
import { PERIODO_VAZIO, periodoAtivo, noPeriodo, detalhePeriodo, cruzaMes, mesDoPeriodo } from "@/lib/periodo";
import { ORDEM_PADRAO, LS_ORDEM, MAPA_ESTADO, posEstado, FILAS, ehEnviado } from "@/lib/constantes";
import Cabecalho from "./Cabecalho";
import Resumo from "./Resumo";
import Grade from "./Grade";
import FocoPedido from "./FocoPedido";
import Login from "./Login";
import Admin from "./Admin";
import Relatorios from "./Relatorios";
import Reguas from "./Reguas";
import Fila from "./Fila";
import Medidor from "./Medidor";
import Confronto from "./Confronto";
import Ajuda from "./Ajuda";
import FiltroData from "./FiltroData";

export default function Pauta() {
  const { cfg, pedidos, carregando, erro, recarregar, salvarCampo, criarPedido, removerPedido, azure } = useDados();
  const { perfil, podeEditar, ehAdmin, recarregar: relerSessao, sair } = useSessao();

  const { reguas, salvarRegua, criarRegua, removerRegua } = useReguas();
  const confronto = useConfronto(podeEditar);
  const { eu, gente } = usePresenca();

  const [mesSel, setMesSel] = useState(() => hojeISO().slice(0, 7));
  const [vista, setVista] = useState("pauta");
  // Dentro da pauta ainda há três áreas: a grade, as réguas e os cancelados.
  const [area, setArea] = useState("pauta");
  const FILTRO_VAZIO = { cli: "", dem: "", tipo: "", status: "", rec: "", q: "", ativos: false, periodo: PERIODO_VAZIO };
  const [filtros, setFiltros] = useState(FILTRO_VAZIO);
  const [ordem, setOrdem] = useState(ORDEM_PADRAO);
  const [foco, setFoco] = useState(null);
  const [salvandoFoco, setSalvandoFoco] = useState(false);
  const [mostraLogin, setMostraLogin] = useState(false);
  const [mostraAdmin, setMostraAdmin] = useState(false);
  // Qual tabela de referência está aberta: "artes", "esforco" ou nenhuma.
  const [ajuda, setAjuda] = useState(null);
  const [toast, setToast] = useState("");
  const [dicaTxt, setDicaTxt] = useState(null);
  const [dicaPos, setDicaPos] = useState({ x: 0, y: 0 });
  const tmr = useRef(null);

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

  // Cada pessoa mantém a própria ordenação preferida.
  useEffect(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(LS_ORDEM) || "null");
      if (salvo?.campo) setOrdem(salvo);
    } catch {}
  }, []);

  const aoOrdenar = useCallback((coluna) => {
    setOrdem((atual) => {
      const nova =
        atual.campo === coluna.ord
          ? { campo: coluna.ord, dir: atual.dir === "asc" ? "desc" : "asc" }
          : { campo: coluna.ord, dir: coluna.dirPadrao || "asc" };
      try { localStorage.setItem(LS_ORDEM, JSON.stringify(nova)); } catch {}
      return nova;
    });
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
  }, [carregando, vista, area]);

  const hoje = hojeISO();
  const meses = useMemo(() => mesesDoAno(hoje.slice(0, 7)), [hoje]);

  /* A aba segue o período escolhido. Sem isto o cabeçalho diria SET enquanto a
     tela mostra entregas de outubro — e a aba errada acesa é pior do que aba
     nenhuma. Só corre quando o período muda, então continua dando para trocar
     de mês na mão depois. */
  useEffect(() => {
    const m = mesDoPeriodo(filtros.periodo, hoje);
    if (m) setMesSel(m);
  }, [filtros.periodo, hoje]);
  const contaMes = useCallback((ym) => pedidos.filter((p) => mesDe(p) === ym).length, [pedidos]);

  /** Os clientes que existem de fato na pauta — a campanha dos cards. */
  const clientes = useMemo(
    () => [...new Set(pedidos.map((p) => p.campanha).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt")),
    [pedidos]
  );

  const nomeRec = useCallback(
    (p) => nomeCurto(cfg.recursos, p.azure_assigned_to),
    [cfg.recursos]
  );

  /** O valor pelo qual cada coluna ordena. Nome para pessoas, posição para status. */
  const valorOrdem = useCallback(
    (p, campo) => {
      switch (campo) {
        case "demandante":     return cfg.demandantes.find((d) => d.id === p.demandante_id)?.nome ?? "";
        case "tipo":           return cfg.tipos.find((t) => t.id === p.tipo_id)?.ordem ?? null;
        case "status_interno": return cfg.status.find((s) => s.id === p.status_interno_id)?.ordem ?? null;
        case "azure_state":    return p.azure_state ? posEstado(MAPA_ESTADO[p.azure_state] || p.azure_state) : null;
        case "recurso":        return nomeRec(p) || "";
        case "qtd_artes":      return p.qtd_artes ?? 0;
        case "esforco":        return p.esforco ?? null;
        default:               return p[campo] ?? "";
      }
    },
    [cfg, nomeRec]
  );

  /* Antes o mês entrava junto da ordenação. Agora são duas peças, porque o
     filtro de data precisa enxergar a pauta inteira: uma semana atravessa a
     virada do mês com frequência, e a aba sozinha esconderia metade das
     entregas sem dizer nada. */
  const ordenados = useMemo(() => {
    const vazio = (v) => v === null || v === undefined || v === "";
    const sinal = ordem.dir === "asc" ? 1 : -1;
    return pedidos
      .slice()
      .sort((a, b) => {
        const va = valorOrdem(a, ordem.campo);
        const vb = valorOrdem(b, ordem.campo);
        // Linha sem valor vai sempre para o fim, seja qual for a direção.
        if (vazio(va) && vazio(vb)) return 0;
        if (vazio(va)) return 1;
        if (vazio(vb)) return -1;
        const cmp =
          typeof va === "number" && typeof vb === "number"
            ? va - vb
            : String(va).localeCompare(String(vb), "pt", { numeric: true });
        return cmp * sinal;
      });
  }, [pedidos, ordem, valorOrdem]);

  const doMes = useMemo(() => ordenados.filter((p) => mesDe(p) === mesSel), [ordenados, mesSel]);

  /* Com filtro de data ligado, quem manda é a data: a base passa a ser a pauta
     inteira. Sem ele, o mês continua mandando, como sempre foi. */
  const comPeriodo = periodoAtivo(filtros.periodo, hoje);
  const base = comPeriodo ? ordenados : doMes;

  const visiveis = useMemo(
    () =>
      base.filter((p) => {
        const dem = cfg.demandantes.find((d) => d.id === p.demandante_id)?.nome || "";
        const tipo = cfg.tipos.find((t) => t.id === p.tipo_id)?.nome || "";
        const stObj = cfg.status.find((s) => s.id === p.status_interno_id);
        const st = stObj?.nome || "";
        return (
          (!filtros.cli || (p.campanha || "") === filtros.cli) &&
          (!filtros.dem || dem === filtros.dem) &&
          (!filtros.tipo || tipo === filtros.tipo) &&
          (!filtros.status || st === filtros.status) &&
          (!filtros.rec || nomeRec(p) === filtros.rec) &&
          // Ativos: some o que já saiu. Linha sem status nenhum continua, porque
          // "sem status" é justamente o que ainda não andou.
          (!filtros.ativos || !ehEnviado(stObj)) &&
          noPeriodo(p, filtros.periodo, hoje) &&
          (!filtros.q || (p.titulo || "").toLowerCase().includes(filtros.q))
        );
      }),
    [base, filtros, cfg, nomeRec, hoje]
  );

  /**
   * Parados e Cancelados não olham só o mês: são a lista inteira. Um pedido
   * parado em junho continua parado hoje — esconder por causa da aba do mês
   * seria justamente perder de vista o que não pode ser perdido de vista.
   */
  const filas = useMemo(() => {
    const monta = (fila) => {
      const ids = new Set(cfg.status.filter((s) => s[fila.marca]).map((s) => s.id));
      const itens = pedidos.filter((p) => ids.has(p.status_interno_id));
      return {
        fila,
        itens,
        semMotivo: itens.filter((p) => !(p[fila.campoMotivo] || "").trim()).length,
      };
    };
    return { parados: monta(FILAS.parados), cancelados: monta(FILAS.cancelados) };
  }, [pedidos, cfg.status]);
  const contaRegua = useCallback(
    (st) => reguas.filter((r) => r.status === st).length,
    [reguas]
  );

  /** Colou o link: a Edge Function lê o card e a tela abre no modo foco. */
  async function aoColar(azureId) {
    if (!podeEditar) return setMostraLogin(true);
    const jaTem = pedidos.find((p) => p.azure_id === azureId);
    if (jaTem) return aviso(`O card #${azureId} já está na pauta — “${jaTem.titulo}”.`);
    try {
      const { data } = (await supabase()?.auth.getSession()) || {};
      const { ok, dados } = await chamaFuncao("azure-card", { id: azureId }, data?.session?.access_token);
      if (!ok) return aviso(dados.erro || "Não consegui ler o card no Azure.");
      if (dados.jaNaPauta) return aviso(`O card #${azureId} já está na pauta — “${dados.jaNaPauta.titulo}”.`);
      setFoco(dados.card);
    } catch {
      aviso("Não consegui falar com o Azure agora.");
    }
  }

  /** "Iniciar pedido": entra só com o nome, sem card, marcado em vermelho. */
  async function iniciarPedido(nome) {
    if (!podeEditar) return setMostraLogin(true);
    const { erro: e } = await criarPedido({
      titulo: nome,
      data_solicitacao: hojeISO(),
      campanha: filtros.cli || null,   // filtrando por um cliente, já entra nele
    });
    if (e) return aviso(`Não deu para criar o pedido: ${e}`);
    aviso(`“${nome}” entrou na pauta sem card. Abra o card no Azure e cole o link aqui.`);
  }

  /**
   * Colou o link numa linha que só tinha o nome: o card manda em tudo que é
   * dele, inclusive no título — o nome provisório é substituído.
   */
  async function vincularCard(pedido, azureId) {
    if (!podeEditar) return setMostraLogin(true);
    const jaTem = pedidos.find((p) => p.azure_id === azureId);
    if (jaTem) return aviso(`O card #${azureId} já está na pauta — “${jaTem.titulo}”.`);
    try {
      const { data } = (await supabase()?.auth.getSession()) || {};
      const { ok, dados } = await chamaFuncao("azure-card", { id: azureId }, data?.session?.access_token);
      if (!ok) return aviso(dados.erro || "Não consegui ler o card no Azure.");
      if (dados.jaNaPauta) return aviso(`O card #${azureId} já está na pauta — “${dados.jaNaPauta.titulo}”.`);
      const c = dados.card;
      const antigo = pedido.titulo;
      const { erro: e } = await salvarCampo(pedido.id, {
        azure_id: c.azure_id,
        titulo: c.titulo,
        azure_state: c.azure_state,
        azure_assigned_to: c.azure_assigned_to,
        azure_changed_at: c.azure_changed_at,
        data_solicitacao: c.data_solicitacao || pedido.data_solicitacao,
        data_entrega: c.data_entrega,
        esforco: c.esforco ?? null,
        campanha: c.campanha ?? pedido.campanha ?? null,
        pasta_codigo: c.pasta_codigo,
        pasta_url: c.pasta_url,
      });
      if (e) return aviso(`Não deu para vincular: ${e}`);
      aviso(`Card #${azureId} vinculado. “${antigo}” virou “${c.titulo}”.`);
    } catch {
      aviso("Não consegui falar com o Azure agora.");
    }
  }

  async function confirmaFoco(extras) {
    setSalvandoFoco(true);
    const { erro: e } = await criarPedido({ ...foco, tags: undefined, ...extras });
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
      <Cabecalho
        meses={meses} mesAtual={hojeISO().slice(0, 7)}
        mesSel={mesSel} setMesSel={setMesSel} contaMes={contaMes}
        perfil={perfil} podeEditar={podeEditar} ehAdmin={ehAdmin}
        aoLogin={() => setMostraLogin(true)} aoAdmin={() => setMostraAdmin(true)}
        vista={vista} setVista={setVista} foraDaPauta={confronto.faltando}
        eu={eu} gente={gente} aoAjuda={setAjuda}
      />

      <main className="wrap">
        {vista === "pauta" && area === "pauta" && (
          <div className="topo">
            <Resumo pedidos={doMes} mesSel={mesSel} cfg={cfg} />
            <Medidor pedidos={pedidos} cfg={cfg} />
          </div>
        )}

        {vista === "pauta" ? (
          <section>
            <div className="toolbar">
              {area === "pauta" ? (
                <>
                  <select className="f" value={filtros.cli} onChange={(e) => setFiltros({ ...filtros, cli: e.target.value })}>
                    <option value="">Cliente</option>
                    {clientes.map((c) => <option key={c}>{c}</option>)}
                  </select>
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
                    {[...new Set(pedidos.map(nomeRec).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt")).map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <input className="search" type="search" placeholder="Buscar pedido…"
                    value={filtros.q} onChange={(e) => setFiltros({ ...filtros, q: e.target.value.toLowerCase().trim() })} />

                  {/* Dois recortes que se usa o dia inteiro, e por isso viram
                      caixa de marcar e não mais uma caixa de seleção: ligar e
                      desligar tem de ser um clique, não dois. */}
                  <label className={`fcheck ${filtros.ativos ? "on" : ""}`}
                    title="Esconde o que já saiu — some tudo que está com o status interno ENVIADO">
                    <input type="checkbox" checked={filtros.ativos}
                      onChange={(e) => setFiltros({ ...filtros, ativos: e.target.checked })} />
                    👁 ativos
                  </label>

                  <FiltroData
                    periodo={filtros.periodo}
                    aoMudar={(periodo) => setFiltros({ ...filtros, periodo })}
                  />

                  <button className="chipclear" onClick={() => setFiltros(FILTRO_VAZIO)}>limpar</button>
                </>
              ) : (
                <button className="chipclear" onClick={() => setArea("pauta")}>← voltar à pauta</button>
              )}

              <button
                className={`abtn ${area === "reguas" ? "on" : ""}`}
                onClick={() => setArea(area === "reguas" ? "pauta" : "reguas")}
              >
                Réguas
                <span className={`bolha am ${contaRegua("radar") ? "" : "zero"}`} title="No radar">{contaRegua("radar")}</span>
                <span className={`bolha az ${contaRegua("producao") ? "" : "zero"}`} title="Em produção">{contaRegua("producao")}</span>
              </button>

              {["parados", "cancelados"].map((k) => {
                const { fila, semMotivo } = filas[k];
                return (
                  <button
                    key={k}
                    className={`abtn ${area === k ? "on" : ""}`}
                    onClick={() => setArea(area === k ? "pauta" : k)}
                  >
                    {fila.botao}
                    <span
                      className={`bolha ${fila.bolha} ${semMotivo ? "" : "zero"}`}
                      title={`${fila.botao} sem motivo preenchido`}
                    >
                      {semMotivo}
                    </span>
                  </button>
                );
              })}

              <span className="spacer" />
              {/* Com período ligado a lista deixa de ser "o mês": dizer isso em
                  voz alta evita a pergunta "cadê o resto de setembro?". */}
              {comPeriodo && area === "pauta" && (
                <span className="per-selo" title={detalhePeriodo(filtros.periodo, hoje)}>
                  📅 por data{cruzaMes(filtros.periodo, hoje) ? " · atravessa dois meses" : ""}
                </span>
              )}
              <span className="mono" style={{ color: "var(--muted)", fontSize: 12 }}>
                {carregando
                  ? "carregando…"
                  : area === "reguas"
                  ? `${reguas.length} ${reguas.length === 1 ? "régua" : "réguas"}`
                  : filas[area]
                  ? `${filas[area].itens.length} ${filas[area].itens.length === 1 ? filas[area].fila.singular : filas[area].fila.plural}`
                  : comPeriodo
                  // Com período ligado o total do mês não é referência de nada:
                  // a lista veio da pauta inteira. "de 18" só confundiria.
                  ? `${visiveis.length} no período`
                  : visiveis.length === doMes.length
                  ? `${doMes.length} pedidos`
                  : `${visiveis.length} de ${doMes.length}`}
              </span>
            </div>

            {area === "pauta" && (
              <Grade
                pedidos={visiveis} cfg={cfg} clientes={clientes} podeEditar={podeEditar}
                salvar={salvarCampo} remover={removerPedido} aviso={aviso}
                aoColar={aoColar} aoIniciar={iniciarPedido} aoVincular={vincularCard}
                ordem={ordem} aoOrdenar={aoOrdenar}
              />
            )}

            {area === "reguas" && (
              <Reguas
                reguas={reguas} clientes={clientes} podeEditar={podeEditar} aviso={aviso}
                salvar={salvarRegua} criar={criarRegua} remover={removerRegua}
              />
            )}

            {filas[area] && (
              <Fila
                fila={filas[area].fila} pedidos={filas[area].itens}
                cfg={cfg} podeEditar={podeEditar} salvar={salvarCampo} aviso={aviso}
              />
            )}
          </section>
        ) : vista === "azure" ? (
          <Confronto confronto={confronto} aoTrazer={aoColar} />
        ) : (
          <Relatorios pedidos={doMes} cfg={cfg} mesSel={mesSel} aviso={aviso} dica={dica} />
        )}

        <footer>
          <b>Pauta v2.</b> As colunas Cliente, 🔵 Azure, 📁 Pasta, Pedido, 📅 Entrega, ⚡ Esforço e Recurso vêm do
          card. O resto é da casa e ninguém sobrescreve.
          {" "}
          {/* Sem esta linha, um refresco que para de funcionar não dá sinal
              nenhum: a tela continua mostrando números velhos com cara de
              novos. É pequena de propósito — só cresce quando dá erro. */}
          <span className={`az-selo ${azure.estado}`} title={
            azure.estado === "erro"
              ? `Não consegui reler o Azure: ${azure.erro}`
              : "Esforço, datas e estado são relidos do Azure ao abrir a página, a cada 5 minutos e depois de cada troca de status interno."
          }>
            {azure.estado === "indo" && "relendo o Azure…"}
            {azure.estado === "ok" && azure.em &&
              `Azure relido às ${azure.em.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            {azure.estado === "erro" && "⚠ não consegui reler o Azure"}
          </span>
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

      {ajuda && (
        <Ajuda chave={ajuda} ehAdmin={ehAdmin} aviso={aviso} aoFechar={() => setAjuda(null)} />
      )}

      {mostraAdmin && podeEditar && (
        <Admin cfg={cfg} ehAdmin={ehAdmin} aoFechar={() => setMostraAdmin(false)}
          recarregar={recarregar} aviso={aviso} />
      )}

      {dicaTxt && (
        // A posição vem do mouse, em pixels da tela, mas o balão é desenhado
        // no espaço já encolhido pelo zoom — daí a divisão, feita na folha.
        <div className="tip on" style={{ "--tx": `${dicaPos.x}px`, "--ty": `${dicaPos.y}px` }}
          dangerouslySetInnerHTML={{ __html: dicaTxt }} />
      )}

      <div className={`toast ${toast ? "on" : ""}`}>{toast}</div>
    </>
  );
}
