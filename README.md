# Pauta v2 — Prudential

Controle de pauta ligado ao Azure DevOps. Substitui `CRONO_PRUDENTIAL_JUNHO.xlsx`.

Stack: **Next.js 15 + Supabase + Vercel**. O repositório fica no GitHub; quem
publica o site é a Vercel, conectada nesse repositório.

---

## Por que não dá para hospedar só no GitHub Pages

O GitHub Pages serve arquivos estáticos. Duas coisas aqui precisam de servidor:

1. **O PAT do Azure.** Ele lê os work items da agência inteira. Num site
   estático, qualquer pessoa abriria o código-fonte e copiaria a chave.
2. **O sync automático.** Alguém precisa acordar de 10 em 10 minutos e buscar
   as mudanças no Azure. Página estática não acorda sozinha.

Por isso: **código no GitHub, deploy na Vercel** (plano gratuito resolve). A
Vercel roda as duas rotas de servidor e guarda as chaves fora do navegador.

---

## Passo a passo

### 1. GitHub

```bash
cd pauta-prudential
git init
git add .
git commit -m "Pauta v2 — primeira versão"
git branch -M main
git remote add origin git@github.com:digicriacao/pauta-prudential.git
git push -u origin main
```

Deixe o repositório **privado**. O `.gitignore` já bloqueia `.env`, mas
repositório privado é a segunda camada.

### 2. Supabase — banco e login

1. Crie um projeto novo em [supabase.com](https://supabase.com) (região
   **South America (São Paulo)**, para o banco ficar perto de vocês).
2. Abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` inteiro e rode.
   Isso cria as tabelas, as regras de acesso e já cadastra Prudential,
   demandantes, tipos, status e o de-para de recursos.
3. Em **Project Settings › API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` — **essa nunca vai para o
     navegador nem para o GitHub.**
4. Em **Authentication › Providers**, deixe **Email** ligado e desligue
   *Confirm email* (as contas são criadas já confirmadas pela nossa rota).
5. Em **Authentication › URL Configuration**, ponha a URL do site em *Site URL*
   e adicione `https://SEU-SITE/nova-senha` em *Redirect URLs* — é para lá que
   o link de recuperação de senha aponta.

### 3. Azure DevOps — o PAT

1. Em `https://dev.azure.com/digidevs/_usersSettings/tokens`, clique em
   **New Token**.
2. Escopo mínimo: **Work Items → Read**. Nada além disso.
3. Validade: o máximo permitido. **Anote a data** — quando o PAT expira, o sync
   para em silêncio. Deixe um lembrete no calendário.
4. Copie o token uma vez só (o Azure não mostra de novo) → `AZURE_PAT`.

**Confirme dois detalhes antes de subir:**

- **Qual campo guarda a data de entrega.** O padrão é o `DueDate` nativo. Se
  vocês usam campo próprio, abra um card, clique em *…* › *Copy field
  reference name* e ponha o nome em `AZURE_CAMPO_ENTREGA`
  (ex.: `Custom.DataEntrega`).
- **Como o card é marcado como Prudential.** Se é pelo `[Prudential]` no
  título, deixe `AZURE_FILTRO_CLIENTE=titulo`. Se é por tag, use `tag`.

### 4. Vercel

1. **Add New › Project** e escolha o repositório.
2. Framework: Next.js (detecta sozinho). Não mexa em build command.
3. Em **Environment Variables**, cadastre tudo que está em `.env.example`,
   marcando Production, Preview e Development.
4. Deploy.
5. **Cron.** O `vercel.json` registra `/api/sync` **uma vez por dia** — e não
   por escolha: no plano Hobby a Vercel recusa o deploy de qualquer expressão
   que rode mais de uma vez ao dia. O sync de 10 em 10 minutos vem do
   **pg_cron do Supabase**, que é gratuito: o bloco comentado no fim de
   `supabase/schema.sql` faz isso. Troque a URL e o `CRON_SECRET` e rode.
   Bônus: essa batida constante no banco impede o projeto Free do Supabase de
   ser pausado por inatividade (ele pausa depois de ~7 dias parado).

### 5. Primeiro acesso

1. Abra o site. Ele nasce em **🔒 Só leitura**.
2. Clique no botão › **Criar acesso** › usuário, senha e e-mail.
3. **A primeira conta criada no projeto vira `admin` automaticamente.** As
   seguintes entram como `leitor` e não editam nada até um admin promover.
4. Como admin, abra **⚙ Admin › Pessoas** e mude para `editor` quem vai mexer
   na pauta (as 3–4 pessoas).
5. Rode o primeiro sync manualmente para popular a base:
   ```bash
   curl -H "Authorization: Bearer SEU_CRON_SECRET" https://SEU-SITE/api/sync
   ```
   Ele volta 60 dias na primeira vez.

---

## Como rodar na sua máquina

```bash
npm install
cp .env.example .env.local   # preencha
npm run dev                  # http://localhost:3000
```

---

## O que cada arquivo faz

```
src/app/
  layout.jsx                    tema aplicado antes da primeira pintura
  page.jsx                      só monta <Pauta/>
  globals.css                   todos os tokens e estilos
  nova-senha/page.jsx           destino do link de recuperação
  api/azure/[id]/route.js       colar link → lê o card (exige editor logado)
  api/sync/route.js             cron de 10 em 10 min (exige CRON_SECRET)
  api/auth/usuario/route.js     login por usuário, cadastro, recuperação

src/lib/
  azure.js                      WIQL, batch, normalização — SÓ servidor
  azure-cliente.js              urlCard e idDoLink — seguro nos dois lados
  supabase-admin.js             chave de serviço — SÓ servidor
  supabase-browser.js           chave anônima — navegador
  dados.js                      carrega, escuta Realtime e grava
  constantes.js                 colunas, estados do Azure, paleta
  formato.js                    datas em UTC dos dois lados

src/componentes/
  Pauta.jsx                     junta tudo e guarda o estado
  Cabecalho.jsx                 logo, abas de mês, botões
  Resumo.jsx                    os seis indicadores do topo
  Grade.jsx                     a tabela, o ✓, o redimensionar de colunas
  FocoPedido.jsx                o modal que abre ao colar o link
  Login.jsx                     entrar, criar acesso, esqueci a senha
  Admin.jsx                     pessoas, demandantes, tipos, status, recursos
  Relatorios.jsx                filtros, gráficos, exportação

supabase/schema.sql             tabelas, RLS, carga inicial
```

---

## A regra que sustenta o projeto

**Cada coluna tem um dono, e só o dono escreve.**

| Dono | Colunas | Quem escreve |
|---|---|---|
| Azure | Pedido, 📅 Entrega, 🔵 Azure, 📁 Pasta, Recurso | `/api/sync` |
| Plataforma | Demandante, Tipo, 🟠 Interno, 🕐 Entrega, ✓ Check, 📝 Obs | as pessoas |
| Os dois | 📅 Solicitação | nasce do card, editável depois |

O sync só toca a lista `CAMPOS_DO_AZURE` em `src/app/api/sync/route.js`. Por
isso ele nunca apaga o que o time preencheu — não existe conflito a resolver.

### A coluna 📁 Pasta

O link do SharePoint mora na descrição do card, junto de ASSETS e BRIEFING. A
pasta é a única âncora cujo texto começa com `A` + número
(`A51172_Ranking_Unicred`). `extraiPasta()` em `src/lib/azure.js` acha essa
âncora, guarda a URL inteira em `pasta_url` e mostra só `A51172`. Quando mais de
uma âncora casa, vale a que estiver mais perto da palavra "pasta".

Se em algum card o padrão for outro, é essa função — e só ela — que muda.

---

## O que ainda falta ligar

| Item | Situação | O que fazer |
|---|---|---|
| Exportar **PPT** | botão existe, avisa que não está ligado | precisa de biblioteca no servidor (`pptxgenjs`) numa rota nova |
| Exportar **PDF** | idem | `@react-pdf/renderer` ou Puppeteer numa rota; a Vercel cobra memória para isso |
| Exportar **Excel** | funciona, sai como `.csv` UTF-8 com `;` | para `.xlsx` de verdade, `exceljs` numa rota de servidor |
| **Multi-cliente** | o banco já tem `cliente_id` em tudo | falta um seletor no topo e cadastrar as tags dos outros clientes |
| **Ajuste → pedido original** | campo `pedido_origem_id` existe e está vazio | falta a interface para ligar um ajuste ao pedido que ele corrige — é o que responde "quanto do mês foi refação" |
| **Importar agosto** | a planilha foi lida e normalizada nesta conversa | o `pauta-agosto-normalizada.json` vira `INSERT` se vocês quiserem o histórico |
| **Presença ao vivo** | o Realtime da grade já funciona | falta mostrar os avatares de quem está com a pauta aberta |

---

## Contas e chaves — o resumo

| O quê | Onde consegue | Custo |
|---|---|---|
| Repositório | GitHub | grátis (privado incluso) |
| Hospedagem | Vercel, plano Hobby | grátis |
| Agendador do sync | pg_cron no Supabase | grátis |
| Banco + login + realtime | Supabase, plano Free | grátis até 500 MB |
| Leitura do Azure | PAT em `dev.azure.com/digidevs` | já é de vocês |
| SharePoint | nada a fazer — só guardamos o link | — |

Nenhuma API paga entra no caminho.

---

## Segurança — o que não pode escapar

- `SUPABASE_SERVICE_ROLE_KEY` e `AZURE_PAT` só existem nas variáveis da Vercel.
  Nenhuma das duas tem prefixo `NEXT_PUBLIC_`, então o Next se recusa a mandá-las
  para o navegador.
- Quem controla quem edita é o **RLS no banco**, não a interface. Abrir o
  DevTools e mudar um `disabled` não dá permissão nenhuma.
- `/api/azure/[id]` exige sessão de editor: sem isso, qualquer pessoa com a URL
  leria work items privados através do nosso PAT.
- `/api/sync` recusa qualquer chamada sem `CRON_SECRET` e recusa também quando a
  variável não está configurada.

---

## O que eu consegui testar aqui e o que não

**Testado:** o projeto compila (`next build` limpo), as três rotas de API
respondem e recusam acesso corretamente sem credenciais, e a página abre.

**Não testado:** nada que dependa de um Supabase e de um Azure de verdade — as
consultas WIQL, o formato exato dos campos do card, o login e o Realtime. É
esperado que o primeiro sync precise de um ou dois ajustes finos,
principalmente no `AZURE_CAMPO_ENTREGA` e no filtro de cliente. Rode o sync
manualmente pelo `curl` acima e leia a resposta: ela diz quantos leu, criou e
atualizou, ou o erro exato.
