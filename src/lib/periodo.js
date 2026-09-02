import { hojeISO, somaDias, semanaDe, fmtBR, fmtBRL, diaDeEntrega } from "@/lib/formato";

/**
 * O recorte de data da pauta.
 *
 * Tudo é uma FAIXA de dias — inclusive "hoje", que é uma faixa de um dia só.
 * Um modelo só serve aos atalhos e à escolha manual, e é o que faz "hoje e
 * amanhã" custar uma linha em vez de virar caso especial. Os atalhos relativos
 * guardam o MODO, e não as datas: assim a tela aberta desde ontem mostra o dia
 * certo quando a meia-noite passa.
 *
 * A lógica mora aqui, e não dentro do componente, porque quem filtra é a tela
 * da pauta e quem desenha é o controle — os dois precisam da mesma conta, e
 * duas contas parecidas em lugares diferentes é como um filtro passa a mentir.
 */

export const PERIODO_VAZIO = { modo: "", de: "", ate: "" };

/** Os atalhos do menu, na ordem em que aparecem. */
export const PERIODOS = [
  { id: "hoje",        rotulo: "Hoje" },
  { id: "amanha",      rotulo: "Amanhã" },
  { id: "hoje-amanha", rotulo: "Hoje e amanhã" },
  { id: "semana",      rotulo: "Esta semana" },
];

/** As duas pontas do período, em ISO — ou nulo quando não há filtro de data. */
export function faixaDe(periodo, hoje = hojeISO()) {
  switch (periodo?.modo) {
    case "hoje":
      return { de: hoje, ate: hoje };
    case "amanha": {
      const d = somaDias(hoje, 1);
      return { de: d, ate: d };
    }
    case "hoje-amanha":
      return { de: hoje, ate: somaDias(hoje, 1) };
    case "semana":
      return semanaDe(hoje);
    case "faixa": {
      if (!periodo.de && !periodo.ate) return null;
      // Uma ponta só vira dia solto; trocadas, endireita em vez de não achar
      // nada — quem escolhe "de 25 até 22" quis os mesmos quatro dias.
      const a = periodo.de || periodo.ate;
      const b = periodo.ate || periodo.de;
      return a <= b ? { de: a, ate: b } : { de: b, ate: a };
    }
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
export function rotuloPeriodo(periodo, hoje = hojeISO()) {
  switch (periodo?.modo) {
    case "hoje":        return "hoje";
    case "amanha":      return "amanhã";
    case "hoje-amanha": return "hoje e amanhã";
    case "semana":      return "semana";
    case "faixa": {
      const f = faixaDe(periodo, hoje);
      if (!f) return "um período";
      return f.de === f.ate ? fmtBR(f.de) : `${fmtBR(f.de)}–${fmtBR(f.ate)}`;
    }
    default: return "hoje";
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
 * Para os atalhos relativos, é o mês de HOJE — e não o do começo da faixa. A
 * semana que começa em 31/08 e termina em 06/09 é vivida como "esta semana, em
 * setembro"; acender AGO só porque a segunda-feira caiu lá deixa o cabeçalho
 * discordando do que a pessoa tem na cabeça. Para uma faixa escolhida a dedo,
 * vale o mês do começo, que é justamente o que ela foi procurar.
 */
export function mesDoPeriodo(periodo, hoje = hojeISO()) {
  const f = faixaDe(periodo, hoje);
  if (!f) return null;
  return periodo.modo === "faixa" ? f.de.slice(0, 7) : hoje.slice(0, 7);
}

/** O período atravessa a virada de um mês? A semana costuma atravessar, e é
 *  quando a aba de mês sozinha esconderia metade das entregas. */
export function cruzaMes(periodo, hoje) {
  const f = faixaDe(periodo, hoje);
  return !!f && f.de.slice(0, 7) !== f.ate.slice(0, 7);
}
