"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { chamaFuncao } from "@/lib/funcoes";

/**
 * Carrega cadastros + pedidos, mantém a grade viva por Realtime e expõe as
 * ações de escrita. Tudo passa por RLS: leitor consegue ler, só editor grava.
 */
/** De quanto em quanto tempo a tela relê o Azure por conta própria. */
export const INTERVALO_AZURE = 5 * 60 * 1000;

export function useDados() {
  const [cfg, setCfg] = useState({ clientes: [], demandantes: [], tipos: [], status: [], recursos: [] });
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  // Como foi o último refresco vindo do Azure — vira a linha do rodapé.
  const [azure, setAzure] = useState({ estado: "parado", em: null, erro: null });
  const montado = useRef(true);
  const ocupado = useRef(false);

  const carregar = useCallback(async () => {
    const sb = supabase();
    if (!sb) {
      setErro("Supabase não configurado. Confira NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setCarregando(false);
      return;
    }
    try {
      const [cli, dem, tip, sts, rec] = await Promise.all([
        sb.from("clientes").select("*").eq("ativo", true).order("nome"),
        sb.from("demandantes").select("*").eq("ativo", true).order("nome"),
        sb.from("tipos").select("*").order("ordem"),
        sb.from("status_internos").select("*").order("ordem"),
        sb.from("recursos").select("*").order("nome_pauta"),
      ]);
      // A pauta virou multicliente: carrega tudo e deixa o filtro separar.
      // O cadastro de clientes é opcional — serve para apelido, cor e link.
      const { data: peds, error } = await sb
        .from("pedidos")
        .select("*")
        .order("data_solicitacao", { ascending: false });
      if (error) throw error;

      if (!montado.current) return;
      setCfg({
        clientes: cli.data || [],
        demandantes: dem.data || [],
        tipos: tip.data || [],
        status: sts.data || [],
        recursos: rec.data || [],
      });
      setPedidos(peds || []);
      setErro(null);
    } catch (e) {
      if (montado.current) setErro(String(e.message || e));
    } finally {
      if (montado.current) setCarregando(false);
    }
  }, []);

  /**
   * Relê no Azure as linhas que já estão na pauta e traz esforço, datas e
   * estado atualizados. Sem `ids`, vale para a pauta inteira.
   *
   * Quem faz o trabalho é a Edge Function, porque o PAT do Azure não pode
   * chegar ao navegador. Sem sessão a chamada nem sai: leitor não tem
   * permissão, e para ele quem mantém a pauta em dia é o agendador do banco.
   */
  const atualizarDoAzure = useCallback(async (ids) => {
    const sb = supabase();
    if (!sb) return {};
    // Duas chamadas ao mesmo tempo não adiantam nada e só dobram o tráfego.
    if (ocupado.current) return {};
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return {};

    ocupado.current = true;
    if (montado.current) setAzure((a) => ({ ...a, estado: "indo" }));
    try {
      const corpo = { acao: "atualizar", ...(ids?.length ? { ids } : {}) };
      const { ok, dados: r } = await chamaFuncao("sync", corpo, token);
      if (!montado.current) return {};
      if (!ok) {
        setAzure({ estado: "erro", em: new Date(), erro: r?.erro || "sem resposta" });
        return { erro: r?.erro || "sem resposta" };
      }
      setAzure({ estado: "ok", em: new Date(), erro: null });
      // O Realtime já traz as linhas alteradas, mas reler é barato e fecha o
      // buraco de quando o canal cai sem avisar.
      if (r?.atualizados) await carregar();
      return {};
    } catch (e) {
      if (montado.current) setAzure({ estado: "erro", em: new Date(), erro: String(e.message || e) });
      return { erro: String(e.message || e) };
    } finally {
      ocupado.current = false;
    }
  }, [carregar]);

  /* Ao abrir a página, de cinco em cinco minutos e ao voltar para a aba.
     Aba escondida não gasta chamada — e ao voltar, a primeira coisa que
     acontece é um refresco, que é justamente quando a tela está mais velha. */
  useEffect(() => {
    const bater = () => {
      if (document.visibilityState === "visible") atualizarDoAzure();
    };
    bater();
    const t = setInterval(bater, INTERVALO_AZURE);
    const aoVoltar = () => document.visibilityState === "visible" && bater();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [atualizarDoAzure]);

  useEffect(() => {
    montado.current = true;
    carregar();
    const sb = supabase();
    if (!sb) return () => { montado.current = false; };

    // Alguém do outro lado da sala mexeu na pauta: a linha muda aqui também.
    const canal = sb
      .channel("pedidos-ao-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, (ev) => {
        setPedidos((atual) => {
          if (ev.eventType === "DELETE") return atual.filter((p) => p.id !== ev.old.id);
          const i = atual.findIndex((p) => p.id === ev.new.id);
          if (i === -1) return [ev.new, ...atual];
          const copia = atual.slice();
          copia[i] = { ...copia[i], ...ev.new };
          return copia;
        });
      })
      .subscribe();

    return () => {
      montado.current = false;
      sb.removeChannel(canal);
    };
  }, [carregar]);

  /** Escrita otimista: pinta na tela na hora, desfaz se o banco recusar. */
  const salvarCampo = useCallback(async (id, campos) => {
    const sb = supabase();
    if (!sb) return { erro: "Sem conexão." };
    let anterior;
    setPedidos((atual) =>
      atual.map((p) => {
        if (p.id !== id) return p;
        anterior = p;
        return { ...p, ...campos };
      })
    );
    const { error } = await sb.from("pedidos").update(campos).eq("id", id);
    if (error) {
      if (anterior) setPedidos((atual) => atual.map((p) => (p.id === id ? anterior : p)));
      return { erro: error.message };
    }

    /* Trocar o status interno quase sempre vem junto de alguém ter mexido no
       card do outro lado. Relê só aquele card — é uma chamada pequena e evita
       a tela ficar dizendo uma coisa enquanto o Azure diz outra. Vai solto de
       propósito: quem salvou não pode esperar o Azure para seguir digitando. */
    if ("status_interno_id" in campos && anterior?.azure_id) {
      atualizarDoAzure([anterior.azure_id]);
    }
    return {};
  }, [atualizarDoAzure]);

  const criarPedido = useCallback(async (dados) => {
    const sb = supabase();
    if (!sb) return { erro: "Sem conexão." };
    const { data, error } = await sb.from("pedidos").insert(dados).select().single();
    if (error) return { erro: error.message };
    setPedidos((atual) => (atual.some((p) => p.id === data.id) ? atual : [data, ...atual]));
    return { pedido: data };
  }, []);

  const removerPedido = useCallback(async (id) => {
    const sb = supabase();
    if (!sb) return { erro: "Sem conexão." };
    const copia = pedidos;
    setPedidos((atual) => atual.filter((p) => p.id !== id));
    const { error } = await sb.from("pedidos").delete().eq("id", id);
    if (error) {
      setPedidos(copia);
      return { erro: error.message };
    }
    return {};
  }, [pedidos]);

  return { cfg, setCfg, pedidos, carregando, erro, recarregar: carregar, salvarCampo, criarPedido, removerPedido, azure, atualizarDoAzure };
}

/**
 * Réguas. Tabela própria, fora da pauta: nada aqui vem do Azure, então não há
 * sync nem conflito — o que a pessoa escreve é o que fica.
 */
export function useReguas() {
  const [reguas, setReguas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const sb = supabase();
    if (!sb) return setCarregando(false);
    const { data } = await sb.from("reguas").select("*").order("ordem").order("criado_em");
    setReguas(data || []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
    const sb = supabase();
    if (!sb) return;
    const canal = sb
      .channel("reguas-ao-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "reguas" }, (ev) => {
        setReguas((atual) => {
          if (ev.eventType === "DELETE") return atual.filter((r) => r.id !== ev.old.id);
          const i = atual.findIndex((r) => r.id === ev.new.id);
          if (i === -1) return [...atual, ev.new];
          const copia = atual.slice();
          copia[i] = { ...copia[i], ...ev.new };
          return copia;
        });
      })
      .subscribe();
    return () => sb.removeChannel(canal);
  }, [carregar]);

  const salvarRegua = useCallback(async (id, campos) => {
    const sb = supabase();
    if (!sb) return { erro: "Sem conexão." };
    let anterior;
    setReguas((atual) =>
      atual.map((r) => {
        if (r.id !== id) return r;
        anterior = r;
        return { ...r, ...campos };
      })
    );
    const { error } = await sb.from("reguas").update(campos).eq("id", id);
    if (error) {
      if (anterior) setReguas((atual) => atual.map((r) => (r.id === id ? anterior : r)));
      return { erro: error.message };
    }
    return {};
  }, []);

  const criarRegua = useCallback(async (nome, cliente = null) => {
    const sb = supabase();
    if (!sb) return { erro: "Sem conexão." };
    const { data, error } = await sb
      .from("reguas").insert({ nome, cliente, status: "radar" }).select().single();
    if (error) return { erro: error.message };
    setReguas((atual) => (atual.some((r) => r.id === data.id) ? atual : [...atual, data]));
    return { regua: data };
  }, []);

  const removerRegua = useCallback(async (id) => {
    const sb = supabase();
    if (!sb) return { erro: "Sem conexão." };
    const copia = reguas;
    setReguas((atual) => atual.filter((r) => r.id !== id));
    const { error } = await sb.from("reguas").delete().eq("id", id);
    if (error) {
      setReguas(copia);
      return { erro: error.message };
    }
    return {};
  }, [reguas]);

  return { reguas, carregando, salvarRegua, criarRegua, removerRegua };
}

/**
 * Confronto com o Azure. Fica aqui, e não dentro da tela, porque dois lugares
 * precisam do mesmo número: a bolinha do botão no cabeçalho e a área em si.
 * Uma consulta só, um estado só — sem duas chamadas ao Azure por carregamento.
 */
export function useConfronto(podeEditar) {
  const [dados, setDados] = useState(null);
  const [estado, setEstado] = useState("carregando");
  const [msg, setMsg] = useState("");

  const conferir = useCallback(async () => {
    if (!podeEditar) {
      setDados(null);
      return setEstado("sem-permissao");
    }
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

  return { dados, estado, msg, conferir, faltando: dados?.faltando?.length ?? 0 };
}

/** Sessão + papel. O botão "Só leitura" vira "Editando" só para editor/admin. */
export function useSessao() {
  const [perfil, setPerfil] = useState(null);
  const [pronto, setPronto] = useState(false);

  const ler = useCallback(async () => {
    const sb = supabase();
    if (!sb) return setPronto(true);
    const { data } = await sb.auth.getSession();
    if (!data?.session) {
      setPerfil(null);
      return setPronto(true);
    }
    const { data: p } = await sb
      .from("perfis")
      .select("id, usuario, nome, papel")
      .eq("id", data.session.user.id)
      .maybeSingle();
    setPerfil(p ? { ...p, email: data.session.user.email } : null);
    setPronto(true);
  }, []);

  useEffect(() => {
    ler();
    const sb = supabase();
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange(() => ler());
    return () => data?.subscription?.unsubscribe();
  }, [ler]);

  const sair = useCallback(async () => {
    await supabase()?.auth.signOut();
    setPerfil(null);
  }, []);

  const podeEditar = !!perfil && ["editor", "admin"].includes(perfil.papel);
  return { perfil, podeEditar, ehAdmin: perfil?.papel === "admin", pronto, recarregar: ler, sair };
}
