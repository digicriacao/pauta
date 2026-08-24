# Pauta v2 — Prudential

Controle de pauta ligado ao Azure DevOps. Substitui `CRONO_PRUDENTIAL_JUNHO.xlsx`.

**Site no GitHub Pages · banco e servidor no Supabase · sem Vercel.**

---

## Como as peças se encaixam

```
GitHub                          Supabase
├─ o código                     ├─ Postgres  → a pauta, as pessoas, as permissões (RLS)
└─ Actions → GitHub Pages       ├─ Auth      → login por usuário e senha
   (site estático)              ├─ Realtime  → a grade se atualiza sozinha
                                ├─ Edge Functions
                                │   ├─ azure-card   → colar link lê o card
                                │   ├─ auth-usuario → login, cadastro, recuperação
                                │   └─ sync         → busca no Azure o que mudou
                                └─ pg_cron   → chama o sync de 10 em 10 min
```

O site é HTML/CSS/JS puro — não roda código de servidor. Tudo que precisa de
segredo (o `AZURE_PAT`, a chave de serviço) vive nas Edge Functions, dentro do
Supabase. O navegador nunca vê nenhuma das duas.

### Duas coisas que valem saber antes

**O site é público.** Um site do GitHub Pages fica aberto na internet, mesmo
publicado a partir de um repositório privado. E a regra de leitura do banco
(`supabase/schema.sql`) permite ler a pauta sem login — foi uma escolha, para
o time não precisar de conta só para consultar. Quem achar o endereço vê os
pedidos. Para exigir login também na leitura, troque em `schema.sql`:

```sql
-- de:
create policy pedidos_leitura on pedidos for select using (true);
-- para:
create policy pedidos_leitura on pedidos for select using (auth.uid() is not null);
```

**No plano gratuito do GitHub, Pages só funciona em repositório público.**
Repositório privado exige GitHub Pro. Como o código não guarda chave nenhuma,
público resolve — mas é bom saber por que a escolha existe.

---

## Passo a passo

### 1. GitHub — subir o código

Pela web, sem terminal: crie o repositório em
[github.com/new](https://github.com/new) como **Public**, sem README nem
`.gitignore`, clique em **uploading an existing file** e arraste **o conteúdo**
da pasta `pauta-prudential` (não a pasta).

O `package.json` precisa ficar na raiz do repositório.

Pelo terminal:

```bash
cd pauta-prudential
git init && git add . && git commit -m "Pauta v2"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/pauta-prudential.git
git push -u origin main
```

### 2. Supabase — banco e login

1. **New project** em [supabase.com](https://supabase.com/dashboard), região
   **South America (São Paulo)**.
2. **SQL Editor** › cole `supabase/schema.sql` inteiro › **Run**. Isso cria as
   tabelas, as permissões e a carga inicial (Prudential, demandantes, tipos,
   status, recursos).
3. **Project Settings › API** — guarde `Project URL`, `anon public` e
   `service_role`.
4. **Authentication › Sign In / Providers** — Email ligado, *Confirm email*
   desligado.

### 3. Azure DevOps — o PAT

Em `dev.azure.com/digidevs/_usersSettings/tokens` › **New Token**, escopo
**Work Items → Read** apenas. Copie na hora — o Azure só mostra uma vez.

Confirme dois detalhes num card real:

- **Qual campo guarda a data de entrega** — no card, `…` › *Copy field
  reference name*. Se não for `Microsoft.VSTS.Scheduling.DueDate`, guarde o
  nome para a variável `AZURE_CAMPO_ENTREGA`.
- **Como o card vira "Prudential"** — `[Prudential]` no título
  (`AZURE_FILTRO_CLIENTE=titulo`) ou nas Tags (`=tag`).

### 4. Supabase — publicar as três Edge Functions

Elas são o servidor do projeto. Cada arquivo em `supabase/functions/*/index.ts`
é **autocontido de propósito**: dá para publicar pelo painel, sem CLI.

Para cada uma das três — `azure-card`, `auth-usuario`, `sync`:

1. Painel do Supabase › **Edge Functions** › **Deploy a new function** ›
   **Via Editor**
2. Nome: exatamente o nome da pasta
3. Apague o exemplo, cole o `index.ts` correspondente inteiro
4. **Deploy** (leva de 10 a 30 segundos)

Depois, em **Edge Functions › Secrets**, cadastre:

| Secret | Valor |
|---|---|
| `AZURE_ORG` | `digidevs` |
| `AZURE_PROJECT` | `SQUAD PULSE` |
| `AZURE_PAT` | o token do passo 3 |
| `AZURE_CAMPO_ENTREGA` | o reference name que você copiou |
| `AZURE_FILTRO_CLIENTE` | `titulo` ou `tag` |
| `CRON_SECRET` | uma string longa e aleatória, inventada por você |
| `URL_SITE` | `https://SEU-USUARIO.github.io/pauta-prudential` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já vêm
preenchidas — não precisa cadastrar.

Pelo CLI, se preferir:

```bash
supabase functions deploy azure-card auth-usuario sync
supabase secrets set AZURE_PAT=... CRON_SECRET=... AZURE_ORG=digidevs
```

### 5. GitHub — ligar o Pages

1. **Settings › Secrets and variables › Actions › New repository secret**,
   duas vezes:
   - `NEXT_PUBLIC_SUPABASE_URL` — o Project URL do passo 2
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — a chave *anon public*
2. **Settings › Pages › Source: GitHub Actions**
3. **Actions › Publicar no GitHub Pages › Run workflow**

Em uns dois minutos o site sobe em
`https://SEU-USUARIO.github.io/pauta-prudential/`. Daí em diante, todo push na
`main` republica sozinho.

### 6. Agendar o sync

**SQL Editor**, trocando as três coisas marcadas — está pronto no fim de
`supabase/schema.sql`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('sync-azure', '*/10 * * * *', $$
  select net.http_post(
    url     := 'https://SEU-PROJETO.supabase.co/functions/v1/sync',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'apikey',        'SUA_ANON_KEY',
                 'Authorization', 'Bearer SUA_ANON_KEY',
                 'x-cron-secret', 'SEU_CRON_SECRET'),
    body    := '{}'::jsonb);
$$);
```

Rode o mesmo `net.http_post` avulso para disparar o primeiro sync (ele busca
60 dias para trás) e confira com `select * from sync_log order by inicio desc`.

Efeito colateral bom: essa batida de 10 em 10 minutos impede o projeto Free do
Supabase de ser **pausado por inatividade** — o que acontece depois de uns 7
dias parado.

### 7. Primeiro acesso

1. Abra o site. Ele nasce em **🔒 Só leitura**.
2. **Criar acesso** › usuário, senha e e-mail.
3. **A primeira conta criada vira `admin` automaticamente.** As seguintes
   entram como `leitor` e não editam nada — foi de propósito.
4. Como admin, **⚙ Admin › Pessoas**: promova para `editor` as 3–4 pessoas.
5. Confira **⚙ Admin › Recursos**: o de-para de nomes do Azure está chutado
   (`Vinicius → Vini`) e quase certamente precisa de correção.

---

## Rodar na sua máquina

```bash
npm install
cp .env.example .env.local   # só as duas NEXT_PUBLIC_ são necessárias
npm run dev                  # http://localhost:3000
```

O `npm run dev` usa as Edge Functions já publicadas no Supabase. Se elas ainda
não existem, o login e o colar-link não funcionam — o resto sim.

---

## O que cada arquivo faz

```
.github/workflows/deploy.yml    build + publicação no Pages a cada push

src/app/
  layout.jsx                    tema aplicado antes da primeira pintura
  page.jsx                      só monta <Pauta/>
  globals.css                   todos os tokens e estilos
  nova-senha/page.jsx           destino do link de recuperação

src/lib/
  funcoes.js                    endereço e chamada das Edge Functions
  supabase-browser.js           chave anônima — navegador
  dados.js                      carrega, escuta Realtime e grava
  constantes.js                 colunas, estados do Azure, paleta
  formato.js                    datas em UTC dos dois lados
  azure-cliente.js              urlCard e idDoLink

src/componentes/
  Pauta.jsx                     junta tudo e guarda o estado
  Cabecalho.jsx                 logo, abas de mês, botões
  Resumo.jsx                    os seis indicadores do topo
  Grade.jsx                     a tabela, o ✓, o redimensionar de colunas
  FocoPedido.jsx                o modal que abre ao colar o link
  Login.jsx                     entrar, criar acesso, esqueci a senha
  Admin.jsx                     pessoas, demandantes, tipos, status, recursos
  Relatorios.jsx                filtros, gráficos, exportação

supabase/
  schema.sql                    tabelas, RLS, carga inicial, agendamento
  functions/azure-card/         colar link → lê o card (exige editor logado)
  functions/auth-usuario/       login por usuário, cadastro, recuperação
  functions/sync/               busca no Azure o que mudou (exige CRON_SECRET)
```

Os três `index.ts` repetem o mesmo trecho de código do Azure de propósito: o
editor do painel do Supabase é de arquivo único, e essa duplicação é o que
permite instalar tudo sem terminal. Se um dia migrarem para o CLI, vale
extrair para `_shared/`.

---

## A regra que sustenta o projeto

**Cada coluna tem um dono, e só o dono escreve.**

| Dono | Colunas | Quem escreve |
|---|---|---|
| Azure | Pedido, 📅 Entrega, 🔵 Azure, 📁 Pasta, Recurso | a função `sync` |
| Plataforma | Demandante, Tipo, 🟠 Interno, 🕐 Entrega, ✓ Check, 📝 Obs | as pessoas |
| Os dois | 📅 Solicitação | nasce do card, editável depois |

O sync só toca a lista `CAMPOS_DO_AZURE`. Por isso ele nunca apaga o que o time
preencheu — não existe conflito a resolver.

### A coluna 📁 Pasta

O link do SharePoint mora na descrição do card, junto de ASSETS e BRIEFING. A
pasta é a única âncora cujo texto começa com `A` + número
(`A51172_Ranking_Unicred`). `extraiPasta()` acha essa âncora, guarda a URL
inteira em `pasta_url` e mostra só `A51172`. Havendo mais de uma candidata,
vale a que estiver mais perto da palavra "pasta".

---

## O que ainda falta ligar

| Item | Situação | O que fazer |
|---|---|---|
| Exportar **PPT** | botão existe, avisa que não está ligado | `pptxgenjs` numa Edge Function nova |
| Exportar **PDF** | idem | difícil em Edge Function; talvez gerar no navegador com a API de impressão |
| Exportar **Excel** | funciona, sai como `.csv` UTF-8 com `;` | para `.xlsx` de verdade, `exceljs` numa função |
| **Multi-cliente** | o banco já tem `cliente_id` em tudo | falta o seletor no topo e cadastrar as outras tags |
| **Ajuste → pedido original** | campo `pedido_origem_id` existe e está vazio | falta a interface para ligar um ajuste ao que ele corrige |
| **Importar agosto** | a planilha foi lida e normalizada | o JSON vira `INSERT` se quiserem o histórico |
| **Presença ao vivo** | o Realtime da grade já funciona | falta mostrar quem está com a pauta aberta |

---

## Contas e custo

| O quê | Onde | Custo |
|---|---|---|
| Código + site + build | GitHub (público) + Pages + Actions | grátis |
| Banco, login, realtime, servidor | Supabase Free | grátis até 500 MB |
| Agendador | pg_cron, dentro do Supabase | grátis |
| Leitura do Azure | PAT em `dev.azure.com/digidevs` | já é de vocês |

Nenhuma API paga entra no caminho.

---

## Segurança

- `AZURE_PAT` e a chave de serviço só existem nos secrets das Edge Functions.
  O site não tem como lê-las.
- Quem controla quem edita é o **RLS no banco**, não a interface. Abrir o
  DevTools e mudar um `disabled` não dá permissão nenhuma.
- `azure-card` exige sessão de editor — sem isso, qualquer um leria work items
  privados através do nosso PAT.
- `sync` exige o `CRON_SECRET` (ou uma sessão de admin) e recusa tudo quando a
  variável não está configurada.
- Depois que o site estiver no ar, cadastre `ORIGEM_PERMITIDA` nos secrets com
  o endereço do Pages: as funções passam a recusar chamadas de outros sites.

---

## O que foi testado aqui e o que não

**Testado:** o site compila em modo estático (`next build` com `output: export`),
sobe num servidor local sob o mesmo subcaminho do Pages, carrega CSS e JS
corretamente e mostra a mensagem certa quando as chaves não estão configuradas.

**Não testado:** nada que dependa de um Supabase e de um Azure de verdade — as
Edge Functions, as consultas WIQL, o formato dos campos do card, o login e o
Realtime. É esperado que o primeiro sync precise de um ajuste, principalmente
no `AZURE_CAMPO_ENTREGA` e no filtro de cliente. Rode o sync na mão e leia a
tabela `sync_log`: ela diz quantos leu, criou e atualizou, ou o erro exato.
