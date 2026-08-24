"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { ESTADOS_AZURE, LS_LARGURAS } from "@/lib/constantes";

const mix = (cor, pct) => `color-mix(in srgb, ${cor} ${pct}, var(--surface))`;

/** Uma seção = uma tabela do banco. Salva no blur, remove no ×. */
function Secao({ titulo, descricao, tabela, itens, campos, novo, aoMudar, aviso, clienteId }) {
  async function grava(item, patch) {
    const sb = supabase();
    const { error } = await sb.from(tabela).update(patch).eq("id", item.id);
    if (error) return aviso(`Não deu para salvar: ${error.message}`);
    aoMudar();
  }
  async function remove(item) {
    const sb = supabase();
    const { error } = await sb.from(tabela).delete().eq("id", item.id);
    if (error) return aviso(`Não deu para remover: ${error.message}. Provavelmente há pedidos usando este item.`);
    aoMudar();
  }
  async function adiciona() {
    const sb = supabase();
    const base = typeof novo === "function" ? novo() : novo;
    const { error } = await sb.from(tabela).insert(clienteId ? { cliente_id: clienteId, ...base } : base);
    if (error) return aviso(`Não deu para adicionar: ${error.message}`);
    aoMudar();
  }

  return (
    <div className="sec">
      <h3>{titulo}</h3>
      <p>{descricao}</p>
      {itens.map((item) => (
        <div className="arow" key={item.id}>
          {campos.map((c) =>
            c.tipo === "cor" ? (
              <input key={c.chave} type="color" defaultValue={item[c.chave] || "#7A2E45"}
                onBlur={(e) => e.target.value !== item[c.chave] && grava(item, { [c.chave]: e.target.value })} />
            ) : c.tipo === "seta" ? (
              <span className="arrow" key="seta">→</span>
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
  const cid = cfg.cliente?.id;

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
            descricao="Quem pede. Lista suspensa da coluna DEMANDANTE, em ordem alfabética."
            itens={cfg.demandantes} aoMudar={recarregar} aviso={aviso}
            campos={[{ chave: "nome", placeholder: "nome" }]}
            novo={{ nome: "Novo nome" }} />

          <Secao titulo="Tipos" tabela="tipos" clienteId={cid}
            descricao="Opções da coluna TIPO. A cor vale para o chip na grade e para as barras do relatório."
            itens={cfg.tipos} aoMudar={recarregar} aviso={aviso}
            campos={[{ chave: "cor", tipo: "cor" }, { chave: "nome", placeholder: "nome" }]}
            novo={{ nome: "NOVO ITEM", cor: "#7A2E45" }} />

          <Secao titulo="Status interno" tabela="status_internos" clienteId={cid}
            descricao="Opções da coluna 🟠 INTERNO. O ✓ da grade joga o pedido para o status marcado como entrega no banco."
            itens={cfg.status} aoMudar={recarregar} aviso={aviso}
            campos={[{ chave: "cor", tipo: "cor" }, { chave: "nome", placeholder: "nome" }]}
            novo={{ nome: "NOVO STATUS", cor: "#7A2E45" }} />

          <Secao titulo="Recursos" tabela="recursos"
            descricao="De-para entre o nome que vem do Azure e o nome que aparece na pauta."
            itens={cfg.recursos} aoMudar={recarregar} aviso={aviso}
            campos={[
              { chave: "nome_azure", placeholder: "nome no Azure" },
              { tipo: "seta" },
              { chave: "nome_pauta", placeholder: "nome na pauta" },
            ]}
            novo={{ nome_azure: "", nome_pauta: "" }} />

          <div className="sec">
            <h3>Status do Azure</h3>
            <p>Vem do work item e não se edita aqui — está listado só para conferir o de-para.</p>
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
            <p>Cada pessoa arrasta a borda do cabeçalho para ajustar a largura. Fica salvo no navegador de quem ajustou.</p>
            <button className="addbtn" onClick={() => {
              try { localStorage.removeItem(LS_LARGURAS); } catch {}
              location.reload();
            }}>Restaurar larguras padrão</button>
          </div>
        </div>
      </aside>
    </>
  );
}
