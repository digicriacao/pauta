"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { BASE } from "@/lib/constantes";

/**
 * Página do cliente. Sem login, endereço próprio, e lendo da visão
 * `pauta_cliente` — que devolve só quatro campos. Nada de status interno,
 * recurso, tipo ou observação passa por aqui, nem no HTML nem na rede.
 *
 * Sem `?c=` no endereço, a página vira a tela de escolha: a lista dos clientes
 * que têm entrega marcada. Escolhido um, o endereço passa a carregar o nome
 * dele — e é esse endereço, e não o da escolha, que se manda para fora.
 */

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

const hojeISO = () => new Date().toISOString().slice(0, 10);

/** Soma dias a uma data ISO sem cair na armadilha de fuso. */
function maisDias(iso, n) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** '2026-08-25' → 'Segunda-feira, 25 de agosto' — com Hoje/Amanhã na frente. */
function rotuloDia(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  const nome = `${DIAS[data.getUTCDay()]}, ${d} de ${MESES[m - 1]}`;
  const hoje = hojeISO();
  if (iso === hoje) return { forte: "Hoje", fraco: nome };
  if (iso === maisDias(hoje, 1)) return { forte: "Amanhã", fraco: nome };
  return { forte: nome.charAt(0).toUpperCase() + nome.slice(1), fraco: "" };
}

const soData = (p) => (p.entrega_em ? p.entrega_em.slice(0, 10) : p.data_entrega);

/** Só a hora combinada, no fuso de São Paulo. */
function hora(ts) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
    });
  } catch {
    return null;
  }
}

const fmtCurta = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

/** 'Prudential Seguros' -> 'prudential-seguros' */
const apelido = (t) =>
  String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** O nome que a linha usa para se dizer de alguém. */
const donoDa = (r) => r.campanha || r.cliente || "";

export default function PautaCliente() {
  const [todos, setTodos] = useState([]);
  const [estado, setEstado] = useState("carregando");
  const [atualizado, setAtualizado] = useState(null);
  const [quem, setQuem] = useState(null);
  const [busca, setBusca] = useState("");

  // A pauta virou multicliente: sem saber de quem é a página, ela mostraria
  // as entregas de todo mundo para qualquer um. O cliente vem no endereço.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQuem(apelido(p.get("c") || p.get("cliente") || ""));
  }, []);

  const carregar = useCallback(async () => {
    const sb = supabase();
    if (!sb) return setEstado("sem-config");
    const { data, error } = await sb
      .from("pauta_cliente")
      .select("*")
      .order("entrega_em", { ascending: true, nullsFirst: false });
    if (error) return setEstado("erro");
    setTodos(data || []);
    setAtualizado(new Date());
    setEstado("ok");
  }, []);

  useEffect(() => {
    if (quem === null) return;
    carregar();
    // A pauta muda durante o dia; recarrega sozinho de minuto em minuto.
    const t = setInterval(carregar, 60000);
    const aoVoltar = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [carregar, quem]);

  const itens = useMemo(() => {
    if (!quem) return [];
    return todos.filter(
      (r) => apelido(r.cliente) === quem || apelido(r.campanha) === quem ||
             apelido(r.campanha).includes(quem)
    );
  }, [todos, quem]);

  /** Um cartão por cliente que tem entrega marcada. */
  const carteira = useMemo(() => {
    const mapa = new Map();
    for (const r of todos) {
      const nome = donoDa(r);
      const slug = apelido(nome);
      if (!nome || !slug) continue;
      const atual = mapa.get(slug) || { slug, nome, quantos: 0, proxima: null };
      atual.quantos += 1;
      const dia = soData(r);
      if (dia && (!atual.proxima || dia < atual.proxima)) atual.proxima = dia;
      mapa.set(slug, atual);
    }
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
  }, [todos]);

  const filtrada = useMemo(() => {
    const alvo = apelido(busca);
    return alvo ? carteira.filter((c) => apelido(c.nome).includes(alvo)) : carteira;
  }, [carteira, busca]);

  const cliente = itens[0] ? donoDa(itens[0]) : null;
  const dias = [...new Set(itens.map(soData).filter(Boolean))].sort();
  const escolhendo = quem === "";

  return (
    <div className="cli">
      <header className="cli-topo">
        <div className="cli-wrap cli-hrow">
          <img className="logo logo-light" src={`${BASE}/logo-rosa.png`} alt="Digi" width="90" height="25" />
          <img className="logo logo-dark" src={`${BASE}/logo-claro.png`} alt="Digi" width="90" height="25" />
          <div className="cli-tit">
            <b>Pauta{cliente ? ` · ${cliente}` : ""}</b>
            <span>
              {escolhendo
                ? "escolha o cliente para ver as entregas"
                : "próximas entregas · hoje e os 7 dias seguintes"}
            </span>
          </div>
          {quem ? <a className="cli-trocar" href={`${BASE}/cliente/`}>trocar de cliente</a> : null}
        </div>
      </header>

      <main className="cli-wrap cli-corpo">
        {/* ── tela de escolha ─────────────────────────────────────────────── */}
        {escolhendo && estado === "carregando" && <p className="cli-vazio">Carregando…</p>}

        {escolhendo && estado === "ok" && carteira.length === 0 && (
          <div className="cli-card">
            <h2>Nenhum cliente com entrega marcada</h2>
            <p>Assim que houver entrega combinada na pauta, o cliente aparece aqui.</p>
          </div>
        )}

        {escolhendo && estado === "ok" && carteira.length > 0 && (
          <>
            <div className="esc-h">
              <h2>Escolha o cliente</h2>
              {carteira.length > 6 && (
                <input
                  className="esc-busca" type="search" placeholder="Filtrar…"
                  value={busca} onChange={(e) => setBusca(e.target.value)}
                />
              )}
            </div>

            <ul className="esc-lista">
              {filtrada.map((c) => (
                <li key={c.slug}>
                  <a className="esc-card" href={`${BASE}/cliente/?c=${encodeURIComponent(c.slug)}`}>
                    <b>{c.nome}</b>
                    <span className="esc-n">
                      {c.quantos} {c.quantos === 1 ? "entrega" : "entregas"}
                    </span>
                    <span className="esc-q">
                      {c.proxima ? `a partir de ${fmtCurta(c.proxima)}` : "sem data marcada"}
                    </span>
                    <i className="esc-seta">→</i>
                  </a>
                </li>
              ))}
              {filtrada.length === 0 && <li className="cli-vazio">Nenhum cliente com esse nome.</li>}
            </ul>

            <p className="esc-nota">
              O link de cada cliente já vem com o nome dele no endereço. É esse link,
              e não o desta tela, que se manda para fora.
            </p>
          </>
        )}

        {/* ── visão de um cliente ─────────────────────────────────────────── */}
        {quem && estado === "carregando" && <p className="cli-vazio">Carregando…</p>}

        {estado === "erro" && (
          <div className="cli-card">
            <h2>Não consegui carregar a pauta</h2>
            <p>Tente recarregar a página em alguns minutos. Se continuar assim, avise a equipe da Digi.</p>
          </div>
        )}

        {estado === "sem-config" && (
          <div className="cli-card"><h2>Página não configurada</h2></div>
        )}

        {quem && estado === "ok" && dias.length === 0 && (
          <div className="cli-card">
            <h2>Nada com entrega marcada</h2>
            <p>Não há entregas combinadas para hoje nem para os próximos 7 dias.</p>
            <p><a className="cli-link" href={`${BASE}/cliente/`}>Ver outro cliente</a></p>
          </div>
        )}

        {quem && estado === "ok" &&
          dias.map((dia) => {
            const doDia = itens.filter((p) => soData(p) === dia);
            const r = rotuloDia(dia);
            return (
              <section className="cli-dia" key={dia}>
                <div className="cli-dia-h">
                  <h2>{r.forte}</h2>
                  {r.fraco && <span>{r.fraco}</span>}
                  <i />
                  <span className="cli-cont">{doDia.length} {doDia.length === 1 ? "entrega" : "entregas"}</span>
                </div>

                <ul className="cli-lista">
                  {doDia.map((p, i) => (
                    <li key={`${dia}-${i}`}>
                      <span className="cli-hora">
                        {hora(p.entrega_em) || <em>a combinar</em>}
                      </span>
                      <span className="cli-pedido">{p.pedido}</span>
                      <span className="cli-meta">
                        {p.demandante && <span><b>Solicitado por</b> {p.demandante}</span>}
                        <span><b>Entrou em</b> {fmtCurta(p.entrada)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
      </main>

      <footer className="cli-rodape cli-wrap">
        <span>Pauta mantida pela Digi. A tela se atualiza sozinha a cada minuto.</span>
        {atualizado && (
          <span className="cli-quando">
            atualizado {atualizado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </footer>
    </div>
  );
}
