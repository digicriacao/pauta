"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * Carrega cadastros + pedidos, mantém a grade viva por Realtime e expõe as
 * ações de escrita. Tudo passa por RLS: leitor consegue ler, só editor grava.
 */
export function useDados() {
  const [cfg, setCfg] = useState({ cliente: null, demandantes: [], tipos: [], status: [], recursos: [] });
  const [pedidos, setPedidos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const montado = useRef(true);

  const carregar = useCallback(async () => {
    const sb = supabase();
    if (!sb) {
      setErro("Supabase não configurado. Confira NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setCarregando(false);
      return;
    }
    try {
      const [cli, dem, tip, sts, rec] = await Promise.all([
        sb.from("clientes").select("*").eq("ativo", true).order("id").limit(1).maybeSingle(),
        sb.from("demandantes").select("*").eq("ativo", true).order("nome"),
        sb.from("tipos").select("*").order("ordem"),
        sb.from("status_internos").select("*").order("ordem"),
        sb.from("recursos").select("*").order("nome_pauta"),
      ]);
      const cliente = cli.data || null;
      if (!cliente) throw new Error("Nenhum cliente cadastrado. Rode supabase/schema.sql.");

      const { data: peds, error } = await sb
        .from("pedidos")
        .select("*")
        .eq("cliente_id", cliente.id)
        .order("data_solicitacao", { ascending: false });
      if (error) throw error;

      if (!montado.current) return;
      setCfg({
        cliente,
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
    return {};
  }, []);

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

  return { cfg, setCfg, pedidos, carregando, erro, recarregar: carregar, salvarCampo, criarPedido, removerPedido };
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
