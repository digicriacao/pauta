"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { BASE } from "@/lib/constantes";

/**
 * Página do cliente. Sem login, endereço próprio, e lendo da visão
 * `pauta_cliente` — que devolve só quatro campos. Nada de status interno,
 * recurso, tipo ou observação passa por aqui, nem no HTML nem na rede.
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

export default function PautaCliente() {
  const [itens, setItens] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [estado, setEstado] = useState("carregando");
  const [atualizado, setAtualizado] = useState(null);
  const [quem, setQuem] = useState(null);

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
    if (error) {
      setEstado("erro");
      return;
    }
    const meus = (data || []).filter(
      (r) => apelido(r.cliente) === quem || apelido(r.campanha) === quem ||
             apelido(r.campanha).includes(quem)
    );
    setItens(meus);
    setCliente(meus[0]?.campanha || meus[0]?.cliente || null);
    setAtualizado(new Date());
    setEstado("ok");
  }, [quem]);

  useEffect(() => {
    if (!quem) return;
    carregar();
    // A pauta muda durante o dia; recarrega sozinho de minuto em minuto.
    const t = setInterval(carregar, 60000);
    const aoVoltar = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [carregar, quem]);

  const dias = [...new Set(itens.map(soData).filter(Boolean))].sort();

  return (
    <div className="cli">
      <header className="cli-topo">
        <div className="cli-wrap cli-hrow">
          <img className="logo logo-light" src={`${BASE}/logo-rosa.png`} alt="Digi" width="90" height="25" />
          <img className="logo logo-dark" src={`${BASE}/logo-claro.png`} alt="Digi" width="90" height="25" />
          <div className="cli-tit">
            <b>Pauta{cliente ? ` · ${cliente}` : ""}</b>
            <span>próximas entregas · hoje e os 7 dias seguintes</span>
          </div>
        </div>
      </header>

      <main className="cli-wrap cli-corpo">
        {quem === "" && (
          <div className="cli-card">
            <h2>Falta o cliente no endereço</h2>
            <p>
              Esta página serve a vários clientes, então o link precisa dizer de quem ela é —
              algo como <code>…/cliente/?c=prudential</code>. Peça o seu link à equipe da Digi.
            </p>
          </div>
        )}

        {quem && estado === "carregando" && <p className="cli-vazio">Carregando…</p>}

        {quem && estado === "erro" && (
          <div className="cli-card">
            <h2>Não consegui carregar a pauta</h2>
            <p>Tente recarregar a página em alguns minutos. Se continuar assim, avise a equipe da Digi.</p>
          </div>
        )}

        {quem && estado === "sem-config" && (
          <div className="cli-card"><h2>Página não configurada</h2></div>
        )}

        {quem && estado === "ok" && dias.length === 0 && (
          <div className="cli-card">
            <h2>Nada com entrega marcada</h2>
            <p>Não há entregas combinadas para hoje nem para os próximos 7 dias.</p>
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
