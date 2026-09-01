"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * As duas tabelas explicativas da pauta: como se conta o número de peças e o
 * que cada nível de esforço quer dizer.
 *
 * São documentação, não dado operacional — por isso o conteúdo padrão mora
 * aqui dentro. Se o banco ainda não tiver as tabelas (ou a rede cair), o modal
 * continua abrindo e explicando; o que se perde é só a edição. Isso evita o
 * pior cenário possível para uma tela de ajuda, que é não abrir na hora em que
 * alguém precisa dela.
 */

/** Vem da aba "Nº de Peças" da planilha antiga. */
export const PADRAO_ARTES = [
  ["Arte única", "01 e-mail ou 01 WhatsApp ou 01 banner", "1"],
  ["Carrossel", "Carrossel para Instagram", "1"],
  ["Gif", "Gif para WhatsApp", "1"],
  ["Arte e desdobramento", "WhatsApp com desdobramento para banner e Instagram, mesma imagem, texto similar", "1"],
  ["Vídeo curto (até 15 seg)", "Stories para Instagram", "1"],
  ["Vídeo curto (15 seg a 90 seg)", "Vídeo para telão, vídeo para WhatsApp", "?"],
  ["Vídeo médio (1:30 min a 3 min)", "Vídeo para WhatsApp ou YouTube", "?"],
  ["Vídeo médio (3 min a 5 min)", "Vídeo para WhatsApp ou YouTube", "?"],
  ["Vídeo longo (+5 min)", "Vídeo para YouTube ou apresentação", "?"],
  ["PPT curto (1 a 5 slides)", "Arte editável, carrossel editável", "1"],
  ["PPT curto (5 a 12 slides)", "Apresentação", "?"],
  ["PPT médio (12 a 20 slides)", "Apresentação ou cartilha editável", "?"],
  ["PPT grande (+20 slides)", "Apresentação ou cartilha editável", "?"],
  ["Ajuste", "Ajuste de layout, ajuste de imagem", "0"],
  ["Refação", "A peça muda de direcionamento por parte do cliente. O texto precisa ser refeito por mudança de objetivo, ou o ajuste passa de 60% da peça.", "+1"],
  ["Ajuste + inclusão", "Ajustar carrossel de peças e incluir peça nova a pedido do cliente", "+1"],
  ["Enxoval", "Desdobramentos de vários formatos diferentes, com imagens e textos diferentes.", "+1"],
].map(([item, exemplo, qtde], i) => ({ id: `p${i}`, ordem: i, item, exemplo, qtde }));

/** Vem da tabela de Effort combinada com o time. */
export const PADRAO_ESFORCO = [
  ["Ajustes simples de texto ou imagem, adaptação de peça existente", 1,
    "Rápido, demanda mínima de tempo e criação", "15 minutos a 1 hora"],
  ["Criação de uma arte estática com briefing claro, revisão de peça pronta", 2,
    "Tarefa pontual, com pouca complexidade", "1 a 4 horas"],
  ["Redação de nova peça + layout visual, variações de campanha", 3,
    "Demanda mais elaboração e refinamento", "4 a 8 horas (até 1 dia útil)"],
  ["Desenvolvimento de conceito criativo ou nova identidade de campanha", 4,
    "Requer brainstorming, mais rounds de aprovação e refinamento", "1 a 3 dias úteis"],
  ["Criação de campanha completa do zero (peças, redação, conceito), múltiplas versões, colaboração entre áreas", 5,
    "Atividade estratégica e de alta complexidade", "3 a 5 dias úteis (ou mais, se necessário)"],
].map(([atividade, effort, descricao, tempo], i) => ({
  id: `e${i}`, ordem: i, atividade, effort, descricao, tempo,
}));

/**
 * A configuração de cada tabela num lugar só: o modal, o formulário de edição
 * e a carga inicial leem tudo daqui. Acrescentar uma coluna é mexer em uma
 * linha, e não em três arquivos.
 */
export const TABELAS_AJUDA = {
  artes: {
    chave: "artes",
    tabela: "ajuda_artes",
    icone: "🎨",
    botao: "Nº de peças",
    titulo: "Como contamos o número de peças",
    resumo:
      "O que entra como uma peça, o que entra como zero e o que soma uma a mais. " +
      "É esta contagem que alimenta a coluna 🎨 da pauta.",
    padrao: PADRAO_ARTES,
    colunas: [
      { id: "item",    rotulo: "Item",        largura: "minmax(150px,1fr)",   linhas: 2 },
      { id: "exemplo", rotulo: "Exemplo",     largura: "minmax(220px,1.7fr)", linhas: 2 },
      { id: "qtde",    rotulo: "Qtde. peças", largura: "94px", centro: true, curto: true },
    ],
    nova: { item: "", exemplo: "", qtde: "1" },
  },
  esforco: {
    chave: "esforco",
    tabela: "ajuda_esforco",
    icone: "⚡️",
    botao: "Esforço",
    titulo: "O que cada nível de esforço quer dizer",
    resumo:
      "O esforço vem do campo Effort do card, e é ele que enche o medidor do topo da pauta. " +
      "Dez de esforço é um dia cheio de uma pessoa.",
    padrao: PADRAO_ESFORCO,
    colunas: [
      { id: "atividade", rotulo: "Exemplo de atividades", largura: "minmax(220px,1.5fr)", linhas: 2 },
      { id: "effort",    rotulo: "Effort",   largura: "76px", centro: true, curto: true, numero: true },
      { id: "descricao", rotulo: "Descrição", largura: "minmax(180px,1.2fr)", linhas: 2 },
      { id: "tempo",     rotulo: "Tempo",     largura: "minmax(130px,.8fr)",  linhas: 2 },
    ],
    nova: { atividade: "", effort: null, descricao: "", tempo: "" },
  },
};

/**
 * Carrega uma das tabelas e expõe a edição. Só admin escreve — quem garante
 * isso é a política do banco; aqui a interface apenas não oferece o campo.
 */
export function useAjuda(chave) {
  const cfg = TABELAS_AJUDA[chave];
  const [linhas, setLinhas] = useState([]);
  const [estado, setEstado] = useState("carregando");

  const carregar = useCallback(async () => {
    if (!cfg) return;
    const sb = supabase();
    if (!sb) {
      setLinhas(cfg.padrao);
      return setEstado("padrao");
    }
    const { data, error } = await sb.from(cfg.tabela).select("*").order("ordem").order("id");
    if (error || !data?.length) {
      // Tabela ainda não criada no banco, ou criada e vazia: mostra o padrão.
      setLinhas(cfg.padrao);
      return setEstado(error ? "padrao" : "vazio");
    }
    setLinhas(data);
    setEstado("ok");
  }, [cfg]);

  useEffect(() => { carregar(); }, [carregar]);

  /** Escrita otimista, igual à da grade: pinta agora, desfaz se o banco recusar. */
  const salvar = useCallback(async (id, campos) => {
    const sb = supabase();
    if (!sb) return { erro: "Sem conexão." };
    let antes;
    setLinhas((atual) => atual.map((l) => {
      if (l.id !== id) return l;
      antes = l;
      return { ...l, ...campos };
    }));
    const { error } = await sb.from(cfg.tabela).update(campos).eq("id", id);
    if (error) {
      if (antes) setLinhas((atual) => atual.map((l) => (l.id === id ? antes : l)));
      return { erro: error.message };
    }
    return {};
  }, [cfg]);

  const incluir = useCallback(async () => {
    const sb = supabase();
    if (!sb) return { erro: "Sem conexão." };
    const ordem = linhas.reduce((m, l) => Math.max(m, l.ordem ?? 0), 0) + 1;
    const { data, error } = await sb.from(cfg.tabela).insert({ ...cfg.nova, ordem }).select().single();
    if (error) return { erro: error.message };
    setLinhas((atual) => [...atual, data]);
    return { linha: data };
  }, [cfg, linhas]);

  const remover = useCallback(async (id) => {
    const sb = supabase();
    if (!sb) return { erro: "Sem conexão." };
    const copia = linhas;
    setLinhas((atual) => atual.filter((l) => l.id !== id));
    const { error } = await sb.from(cfg.tabela).delete().eq("id", id);
    if (error) {
      setLinhas(copia);
      return { erro: error.message };
    }
    return {};
  }, [cfg, linhas]);

  /** Troca a linha de lugar com a vizinha, gravando a ordem das duas. */
  const mover = useCallback(async (id, passo) => {
    const i = linhas.findIndex((l) => l.id === id);
    const j = i + passo;
    if (i === -1 || j < 0 || j >= linhas.length) return {};
    const a = linhas[i];
    const b = linhas[j];
    const troca = linhas.slice();
    troca[i] = b;
    troca[j] = a;
    setLinhas(troca.map((l, k) => ({ ...l, ordem: k })));
    const sb = supabase();
    if (!sb) return { erro: "Sem conexão." };
    await Promise.all(troca.map((l, k) => sb.from(cfg.tabela).update({ ordem: k }).eq("id", l.id)));
    return {};
  }, [cfg, linhas]);

  /** Grava o conteúdo padrão no banco, para a tabela sair do zero já cheia. */
  const semear = useCallback(async () => {
    const sb = supabase();
    if (!sb) return { erro: "Sem conexão." };
    const corpo = cfg.padrao.map(({ id, ...resto }) => resto);
    const { data, error } = await sb.from(cfg.tabela).insert(corpo).select();
    if (error) return { erro: error.message };
    setLinhas(data);
    setEstado("ok");
    return {};
  }, [cfg]);

  return { cfg, linhas, estado, recarregar: carregar, salvar, incluir, remover, mover, semear };
}
