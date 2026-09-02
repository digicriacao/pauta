import { hojeISO, somaDias, semanaDe, fmtBR, fmtBRL, diaDeEntrega } from "@/lib/formato";

/**
 * O recorte de data da pauta: hoje, amanhã, a semana, ou um dia escolhido no
 * calendário.
 *
 * A lógica mora aqui, e não dentro do componente, porque quem filtra é a tela
 * da pauta e quem desenha é o controle — os dois precisam da mesma conta, e
 * duas contas parecidas em lugares diferentes é como um filtro passa a mentir.
 */

export const PERIODO_VAZIO = { modo: "", dia: "" };

/** Os atalhos do menu, na ordem em que aparecem. */
export const PERIODOS = [
  { id: "hoje",   rotulo: "Hoje" },
  { id: "amanha", rotulo: "Amanhã" },
  { id: "semana", rotulo: "Esta semana" },
];

/**
 * As duas pontas do período, em ISO — ou nulo quando não há filtro de data.
 * Tudo vira faixa, inclusive o dia solto: uma comparação só serve aos quatro
 * modos, e acrescentar "próximos 7 dias" amanhã é uma linha.
 */
export function faixaDe(periodo, hoje = hojeISO()) {
  switch (periodo?.modo) {
    case "hoje":
      return { de: hoje, ate: hoje };
    case "amanha": {
      const d = somaDias(hoje, 1);
      return { de: d, ate: d };
    }
    case "semana":
      return semanaDe(hoje);
    case "dia":
      return periodo.dia ? { de: periodo.dia, ate: periodo.dia } : null;
    default:
      return null;
  }
}

export const periodoAtivo = (periodo, hoje) => !!faixaDe(periodo, hoje);

/**
 * O pedido cai no período?
 *
 * Pedido sem data de entrega fica de fora — e é de propósito. Quem pergunta
 * "o que sai quinta?" não está perguntando pelo que ainda não tem data.
 */
export function noPeriodo(pedido, periodo, hoje) {
  const f = faixaDe(periodo, hoje);
  if (!f) return true;
  const dia = diaDeEntrega(pedido);
  if (!dia) return false;
  return dia >= f.de && dia <= f.ate;
}

/** O que fica escrito no botão. Curto: ele divide a linha com outros filtros. */
export function rotuloPeriodo(periodo) {
  switch (periodo?.modo) {
    case "hoje":   return "hoje";
    case "amanha": return "amanhã";
    case "semana": return "semana";
    case "dia":    return periodo.dia ? fmtBR(periodo.dia) : "um dia";
    default:       return "hoje";
  }
}

/** O período por extenso, para o balão — inclusive as datas da semana, que é a
 *  informação que falta quando se lê só "semana". */
export function detalhePeriodo(periodo, hoje = hojeISO()) {
  const f = faixaDe(periodo, hoje);
  if (!f) return "Mostrar só o que entrega num período. Clique no 📅 para escolher.";
  if (f.de === f.ate) return `Só o que entrega em ${fmtBRL(f.de)}.`;
  return `Só o que entrega entre ${fmtBRL(f.de)} e ${fmtBRL(f.ate)}.`;
}

/**
 * A aba de mês que combina com o período.
 *
 * Para hoje, amanhã e a semana, é o mês de HOJE — e não o do começo da faixa.
 * A semana que começa em 31/08 e termina em 06/09 é vivida como "esta semana,
 * em setembro"; acender AGO só porque a segunda-feira caiu lá deixa o cabeçalho
 * discordando do que a pessoa tem na cabeça. Para um dia escolhido a dedo, vale
 * o mês daquele dia, que é justamente o que ela foi procurar.
 */
export function mesDoPeriodo(periodo, hoje = hojeISO()) {
  if (!faixaDe(periodo, hoje)) return null;
  return periodo.modo === "dia" ? periodo.dia.slice(0, 7) : hoje.slice(0, 7);
}

/** O período atravessa a virada de um mês? A semana costuma atravessar, e é
 *  quando a aba de mês sozinha esconderia metade das entregas. */
export function cruzaMes(periodo, hoje) {
  const f = faixaDe(periodo, hoje);
  return !!f && f.de.slice(0, 7) !== f.ate.slice(0, 7);
}
