"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ESTADOS_AZURE, LS_LARGURAS, LS_ORDEM } from "@/lib/constantes";

const mix = (cor, pct) => `color-mix(in srgb, ${cor} ${pct}, var(--surface))`;

/**
 * Uma seção = uma tabela do banco. Salva no blur, remove no ×.
 * `ordenavel` liga as setas: a ordem daqui é a ordem da lista suspensa na
 * grade. Demandantes e recursos não têm setas — são sempre alfabéticos.
 */
function Secao({ titulo, descricao, tabela, itens, campos, novo, aoMudar, aviso, clienteId, ordenavel }) {
  async function grava(item, patch) {
    const { error } = await supabase().from(tabela).update(patch).eq("id", item.id);
    if (error) return aviso(`Não deu para salvar: ${error.message}`);
    aoMudar();
  }
  async function remove(item) {
    const { error } = await supabase().from(tabela).delete().eq("id", item.id);
    if (error) return aviso(`Não deu para remover: ${error.message}. Provavelmente há pedidos usando este item.`);
    aoMudar();
  }
  async function adiciona() {
    const base = typeof novo === "function" ? novo() : novo;
    const corpo = { ...base };
    if (ordenavel) corpo.ordem = Math.max(0, ...itens.map((i) => i.ordem ?? 0)) + 1;
    const { error } = await supabase().from(tabela).insert(clienteId ? { cliente_id: clienteId, ...corpo } : corpo);
    if (error) return aviso(`Não deu para adicionar: ${error.message}`);
    aoMudar();
  }
  /** Troca de lugar e renumera a lista inteira — assim nunca sobra empate. */
  async function move(i, passo) {
    const j = i + passo;
    if (j < 0 || j >= itens.length) return;
    const lista = itens.slice();
    [lista[i], lista[j]] = [lista[j], lista[i]];
    const sb = supabase();
    for (let k = 0; k < lista.length; k++) {
      if (lista[k].ordem !== k + 1) {
        const { error } = await sb.from(tabela).update({ ordem: k + 1 }).eq("id", lista[k].id);
        if (error) return aviso(`Não deu para reordenar: ${error.message}`);
      }
    }
    aoMudar();
  }

  return (
    <div className="sec">
      <h3>{titulo}</h3>
      <p>{descricao}</p>
      {itens.map((item, i) => (
        <div className="arow" key={item.id}>
          {ordenavel && (
            <>
              <button className="mv" title="Subir" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
              <button className="mv" title="Descer" disabled={i === itens.length - 1} onClick={() => move(i, 1)}>▼</button>
            </>
          )}
          {campos.map((c, k) =>
            c.tipo === "cor" ? (
              <input key={c.chave} type="color" defaultValue={item[c.chave] || "#7A2E45"}
                onBlur={(e) => e.target.value !== item[c.chave] && grava(item, { [c.chave]: e.target.value })} />
            ) : c.tipo === "seta" ? (
              <span className="arrow" key={`seta${k}`}>→</span>
            ) : c.tipo === "check" ? (
              <label className="achk" key={c.chave} title={c.dica}>
                <input type="checkbox" checked={!!item[c.chave]}
                  onChange={(e) => grava(item, { [c.chave]: e.target.checked })} />
                {c.rotulo}
              </label>
            ) : (
              <input key={c.chave} type="text" defaultValue={item[c.chave] || ""} placeholder={c.placeholder}
                onBlur={(e) => e.target.value !== (item[c.chave] || "") && grava(item, { [c.chave]: e.target.value })} />
            )
          )}
          {campos.some((c) => c.tipo === "cor") && (
            <span className="prev" style={{
              background: mix(item.cor, "var(--chip-a)"),
              color: item.cor,
              boxShadow: `inset 0 0 0 1px ${mix(item.cor, "var(--chip-b)")}`,
            }}>{item.nome || "—"}</span>
          )}
          <button className="rm" title="Remover" onClick={() => remove(item)}>×</button>
        </div>
      ))}
      <button className="addbtn" onClick={adiciona}>+ adicionar</button>
    </div>
  );
}

export default function Admin({ cfg, aoFechar, recarregar, aviso }) {
  const [perfis, setPerfis] = useState([]);
  const cid = cfg.clientes?.[0]?.id;

  const carregaPerfis = useCallback(async () => {
    const { data } = await supabase().from("perfis").select("id, usuario, nome, papel").order("usuario");
    setPerfis(data || []);
  }, []);

  useEffect(() => { carregaPerfis(); }, [carregaPerfis]);

  async function mudaPapel(p, papel) {
    const { error } = await supabase().from("perfis").update({ papel }).eq("id", p.id);
    if (error) return aviso(`Não deu para mudar o papel: ${error.message}`);
    carregaPerfis();
  }

  return (
    <>
      <div className="scrim on" onClick={aoFechar} />
      <aside className="drawer on" aria-hidden="false">
        <div className="dw-h">
          <h2>Admin</h2>
          <button className="x" aria-label="Fechar" onClick={aoFechar}>×</button>
        </div>
        <div className="dw-b">
          <div className="sec">
            <h3>Pessoas</h3>
            <p>Quem pode editar a pauta. Contas novas entram como <b>leitor</b> — promova aqui.</p>
            {perfis.map((p) => (
              <div className="arow" key={p.id}>
                <input type="text" defaultValue={p.usuario} readOnly style={{ opacity: 0.75 }} />
                <select className="f" value={p.papel} onChange={(e) => mudaPapel(p, e.target.value)}>
                  <option value="leitor">leitor</option>
                  <option value="editor">editor</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            ))}
          </div>

          <Secao titulo="Demandantes" tabela="demandantes" clienteId={cid}
            descricao="Quem pede. A lista aparece sempre em ordem alfabética, na grade e aqui."
            itens={cfg.demandantes} aoMudar={recarregar} aviso={aviso}
            campos={[{ chave: "nome", placeholder: "nome" }]}
            novo={{ nome: "Novo nome" }} />

          <Secao titulo="Tipos" tabela="tipos" clienteId={cid} ordenavel
            descricao="Opções da coluna TIPO, na ordem em que aparecem na lista suspensa. Use ▲▼ para reordenar. A cor vale para o chip na grade e para as barras do relatório."
            itens={cfg.tipos} aoMudar={recarregar} aviso={aviso}
            campos={[{ chave: "cor", tipo: "cor" }, { chave: "nome", placeholder: "nome" }]}
            novo={{ nome: "NOVO ITEM", cor: "#7A2E45" }} />

          <Secao titulo="Status interno" tabela="status_internos" clienteId={cid} ordenavel
            descricao="Opções da coluna 🟠 INTERNO, na ordem da lista suspensa — e também a ordem usada quando se ordena a grade por esta coluna."
            itens={cfg.status} aoMudar={recarregar} aviso={aviso}
            campos={[{ chave: "cor", tipo: "cor" }, { chave: "nome", placeholder: "nome" }]}
            novo={{ nome: "NOVO STATUS", cor: "#7A2E45" }} />

          <Secao titulo="Recursos" tabela="recursos"
            descricao="De-para entre o nome que vem do Azure e o nome que aparece na pauta. A caixinha “medidor” escolhe quem aparece no painel de esforço, no topo da home — marque e desmarque à vontade, e use o × para remover a pessoa."
            itens={cfg.recursos} aoMudar={recarregar} aviso={aviso}
            campos={[
              { chave: "nome_azure", placeholder: "nome no Azure" },
              { tipo: "seta" },
              { chave: "nome_pauta", placeholder: "nome na pauta" },
              { chave: "medidor", tipo: "check", rotulo: "medidor",
                dica: "Mostrar esta pessoa no painel de esforço do topo da home" },
            ]}
            novo={{ nome_azure: "", nome_pauta: "", medidor: false }} />

          <div className="sec">
            <h3>Status do Azure</h3>
            <p>Vem do work item e não se edita aqui — está listado só para conferir o de-para. Esta é também a ordem usada ao ordenar a grade pela coluna 🔵 Azure.</p>
            <div className="ro-list">
              {ESTADOS_AZURE.map((e) => (
                <div key={e.nome}>
                  <i style={{ background: e.cor }} />
                  <b style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{e.nome}</b>
                  <span style={{ color: "var(--faint)", fontSize: 11.5 }}>← {e.de.join(" · ")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sec">
            <h3>Colunas</h3>
            <p>Cada pessoa arrasta a borda do cabeçalho para ajustar a largura, e clica no título para ordenar. As duas coisas ficam salvas no navegador de quem ajustou.</p>
            <button className="addbtn" onClick={() => {
              try { localStorage.removeItem(LS_LARGURAS); localStorage.removeItem(LS_ORDEM); } catch {}
              location.reload();
            }}>Restaurar larguras e ordenação</button>
          </div>
        </div>
      </aside>
    </>
  );
}
