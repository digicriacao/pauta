"use client";

import { useMemo } from "react";
import { achaRecurso } from "@/lib/recursos";
import { ESFORCO_DIA, ESTADOS_MEDIDOR, estadoDe, estadoEstaEm } from "@/lib/constantes";

/**
 * Trabalho em mão: entra no medidor o card que o Azure diz estar EM PAUTA ou EM
 * DESENVOLVIMENTO. É a fila de cada pessoa — o que já foi combinado com ela e o
 * que ela está fazendo agora —, e não o que vence hoje. Card em refinamento
 * ainda não é de ninguém; card entregue já saiu da mão.
 *
 * A comparação passa por `estadoEstaEm`, e não por uma checagem direta: o
 * processo de vocês nomeia as colunas em português ("Em Pauta"), e não pelos
 * nomes internos do Azure ("Ready"). Comparar cru zerava o medidor inteiro.
 */
const emMao = (p) => estadoEstaEm(p, ESTADOS_MEDIDOR);

/**
 * Quanto esforço cada pessoa tem em mão.
 *
 * Quem aparece aqui sai do cadastro de Recursos, no Admin — a caixinha
 * "medidor" de cada linha. Assim entra e sai gente sem mexer em código.
 *
 * Cada célula traz o número (o fato) sobre uma barra fininha (o contraste).
 * Quem está zerado continua na lista: a ausência de carga é justamente o que se
 * quer enxergar de relance.
 *
 * ── DOIS MODOS ─────────────────────────────────────────────────────────────
 * Sem `recorte`, o medidor é a FILA: o filtro de estado acima manda, e o que
 * ele mostra é o que cada um tem para fazer, sem data.
 *
 * Com `recorte` (o filtro de data ligado na barra), quem manda é a DATA: o
 * `Pauta` já entrega só os pedidos daquele período, e aqui o filtro de estado
 * sai de cena. Tem de sair: "o esforço de hoje" inclui o que foi entregue
 * hoje, e um card entregue não está mais em pauta nem em desenvolvimento —
 * mantendo o filtro, o número do dia encolheria conforme o time trabalha, o
 * que é exatamente o contrário do que se quer ler.
 */
export default function Medidor({ pedidos, cfg, recorte = null }) {
  const linhas = useMemo(() => {
    // Com recorte de data, o `Pauta` já fez a peneira — aqui entra tudo.
    const naConta = recorte ? pedidos : pedidos.filter(emMao);
    const escolhidos = (cfg.recursos || []).filter((r) => r.medidor);

    return escolhidos.map((r) => {
      const meus = naConta.filter((p) => achaRecurso(escolhidos, p.azure_assigned_to)?.id === r.id);
      return {
        nome: r.nome_pauta || r.nome_azure,
        esforco: meus.reduce((s, p) => s + (Number(p.esforco) || 0), 0),
        pedidos: meus.length,
      };
    });
  }, [pedidos, cfg.recursos, recorte]);

  /* Zerado pode ser verdade (dia calmo) ou engano (o nome do estado no Azure
     mudou e nada mais bate). Os dois casos são idênticos na tela, então a lista
     dos estados encontrados vai no balão do total — é a primeira coisa que
     alguém precisa ver para saber de qual dos dois se trata. Só vale no modo
     fila: com recorte de data o estado não entra na conta, então um zero ali
     quer dizer só "nada marcado para esse período". */
  const estadosVistos = useMemo(() => {
    const s = new Set();
    for (const p of pedidos) {
      const e = estadoDe(p);
      if (e) s.add(e);
    }
    return [...s].sort();
  }, [pedidos]);

  // A barra é escala fixa, e não relativa ao colega mais carregado: dez de
  // esforço enche. Assim "meia barra" quer dizer sempre a mesma coisa, hoje e
  // no mês que vem — comparar com o vizinho não diria nada sobre capacidade.
  const total = linhas.reduce((s, l) => s + l.esforco, 0);
  const pct = (v) => Math.min(100, (v / ESFORCO_DIA) * 100);

  const oQueConta = recorte
    ? `com entrega em ${recorte}`
    : `${ESTADOS_MEDIDOR.join(" e ")} no Azure`;

  return (
    <aside className="medidor">
      <div className="med-h">
        <span className="k">
          Esforço
          {/* O recorte vai junto do rótulo, e não como selo à parte: o número
              do lado muda de significado com ele, e os dois têm de ser lidos
              na mesma piscada. */}
          {recorte && <em className="med-rec">· {recorte}</em>}
        </span>
        <span className="med-total mono"
          title={
            (recorte
              ? `${total} de esforço com entrega em ${recorte}, incluindo o que já foi entregue. Card cancelado fica fora.`
              : `${total} de esforço em mão no time — cards ${ESTADOS_MEDIDOR.join(" e ")} no Azure.`) +
            (!recorte && total === 0 && pedidos.length
              ? `\n\nNenhum card nesses dois estados. Os estados que aparecem na pauta agora são: ` +
                `${estadosVistos.join(", ") || "nenhum"}.`
              : "")
          }>
          {total}
        </span>
      </div>

      {linhas.length ? (
        <div className="med-cels">
          {linhas.map((l) => (
            <div className={`med-cel${l.esforco ? "" : " vazio"}${l.esforco > ESFORCO_DIA ? " estourou" : ""}`} key={l.nome}
              title={`${l.nome}: ${l.esforco} de esforço em ${l.pedidos} ${l.pedidos === 1 ? "card" : "cards"}` +
                     ` ${oQueConta}` +
                     ` — ${Math.round((l.esforco / ESFORCO_DIA) * 100)}% de um dia cheio (${ESFORCO_DIA})`}>
              <span className="med-num mono">{l.esforco}</span>
              <span className="med-nome">{l.nome}</span>
              <span className="med-tri"><i style={{ width: `${pct(l.esforco)}%` }} /></span>
            </div>
          ))}
        </div>
      ) : (
        <p className="med-sem">Ninguém marcado. Escolha em <b>Admin → Recursos</b>.</p>
      )}
    </aside>
  );
}
