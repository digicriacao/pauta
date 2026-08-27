-- ============================================================================
-- Pauta v2 — Prudential
-- Cole este arquivo inteiro no SQL Editor do Supabase e rode uma vez.
-- ============================================================================

-- ── perfis ──────────────────────────────────────────────────────────────────
-- Liga o usuário do Supabase Auth ao nome de usuário curto usado no login.
create table if not exists perfis (
  id         uuid primary key references auth.users on delete cascade,
  usuario    text unique not null,
  nome       text,
  papel      text not null default 'leitor' check (papel in ('leitor','editor','admin')),
  criado_em  timestamptz not null default now()
);

create or replace function eh_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel in ('editor','admin'));
$$;

create or replace function eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'admin');
$$;

-- ── cadastros ───────────────────────────────────────────────────────────────
create table if not exists clientes (
  id serial primary key,
  nome text not null,
  slug text unique not null,
  tag_azure text,                     -- ex.: 'Prudential' (tag ou marcador [Prudential] no título)
  cor  text default '#EA0356',
  ativo boolean not null default true
);

create table if not exists demandantes (
  id serial primary key,
  cliente_id int references clientes on delete cascade,
  nome text not null,
  ativo boolean not null default true,
  unique (cliente_id, nome)
);

create table if not exists tipos (
  id serial primary key,
  cliente_id int references clientes on delete cascade,
  nome text not null,
  cor  text not null default '#7A2E45',
  ordem int not null default 0,
  unique (cliente_id, nome)
);

create table if not exists status_internos (
  id serial primary key,
  cliente_id int references clientes on delete cascade,
  nome text not null,
  cor  text not null default '#7A2E45',
  ordem int not null default 0,
  -- marca qual status significa "entregue" (o ✓ da grade aponta pra ele)
  entrega boolean not null default false,
  -- marca qual status significa "cancelado" (alimenta a área de Cancelados)
  cancelamento boolean not null default false,
  -- marca qual status significa "parado" (alimenta a área de Parados)
  pausa boolean not null default false,
  unique (cliente_id, nome)
);

-- de-para entre o nome que vem do Azure e o nome usado na pauta
create table if not exists recursos (
  id serial primary key,
  nome_azure text not null unique,
  nome_pauta text not null,
  area text check (area in ('DA','Redação','Motion','CRM')),
  ativo boolean not null default true
);

-- ── pedidos ─────────────────────────────────────────────────────────────────
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  cliente_id int not null references clientes,

  -- colunas cujo dono é o Azure (o sync escreve, ninguém edita na grade)
  azure_id          int unique,
  titulo            text,
  azure_state       text,
  azure_assigned_to text,
  azure_changed_at  timestamptz,
  pasta_codigo      text,   -- ex.: 'A51502'
  pasta_url         text,   -- link do SharePoint extraído da descrição do card
  data_solicitacao  date,
  data_entrega      date,
  esforco           numeric,  -- campo Effort do card

  -- colunas cujo dono é a plataforma (o sync nunca toca)
  demandante_id     int references demandantes,
  tipo_id           int references tipos,
  status_interno_id int references status_internos,
  entrega_em        timestamptz,
  entregue          boolean not null default false,
  qtd_artes         int not null default 1 check (qtd_artes >= 0),
  observacao        text,
  motivo_cancelamento text,
  motivo_pausa      text,
  pedido_origem_id  uuid references pedidos on delete set null,

  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users
);

create index if not exists pedidos_entrega_idx  on pedidos (data_entrega desc);
create index if not exists pedidos_solic_idx    on pedidos (data_solicitacao desc);
create index if not exists pedidos_cliente_idx  on pedidos (cliente_id);

-- ── réguas ──────────────────────────────────────────────────────────────────
-- Área própria, à parte da pauta: cada linha é uma régua de comunicação, com
-- um link (SharePoint, card ou documento Office) e um status próprio.
create table if not exists reguas (
  id uuid primary key default gen_random_uuid(),
  cliente_id int not null references clientes on delete cascade,
  nome        text,
  link        text,
  status      text not null default 'radar'
                check (status in ('radar','producao','finalizado')),
  observacao  text,
  ordem       int not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists reguas_cliente_idx on reguas (cliente_id, ordem, criado_em);

-- histórico: é daqui que saem lead time real e % de retrabalho
create table if not exists eventos (
  id bigserial primary key,
  pedido_id uuid references pedidos on delete cascade,
  campo text not null,
  de text,
  para text,
  pessoa_id uuid references auth.users,
  origem text not null default 'app' check (origem in ('app','sync')),
  em timestamptz not null default now()
);
create index if not exists eventos_pedido_idx on eventos (pedido_id, em desc);

-- espelho cru do Azure, pra depurar sync sem bater na API de novo
create table if not exists azure_raw (
  azure_id int primary key,
  payload jsonb not null,
  sincronizado_em timestamptz not null default now()
);

create table if not exists sync_log (
  id bigserial primary key,
  inicio timestamptz not null default now(),
  fim timestamptz,
  lidos int default 0,
  criados int default 0,
  atualizados int default 0,
  erro text
);

create table if not exists config (
  chave text primary key,
  valor jsonb not null
);

-- atualizado_em automático
create or replace function toca_atualizado_em() returns trigger
language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;

drop trigger if exists pedidos_toca on pedidos;
create trigger pedidos_toca before update on pedidos
  for each row execute function toca_atualizado_em();

drop trigger if exists reguas_toca on reguas;
create trigger reguas_toca before update on reguas
  for each row execute function toca_atualizado_em();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Todo mundo lê (a pauta abre em modo leitura sem login).
-- Só editor escreve. Só admin mexe nos cadastros.
alter table perfis          enable row level security;
alter table clientes        enable row level security;
alter table demandantes     enable row level security;
alter table tipos           enable row level security;
alter table status_internos enable row level security;
alter table recursos        enable row level security;
alter table pedidos         enable row level security;
alter table reguas          enable row level security;
alter table eventos         enable row level security;
alter table config          enable row level security;

drop policy if exists perfis_leitura on perfis;
create policy perfis_leitura on perfis for select using (true);
drop policy if exists perfis_proprio on perfis;
create policy perfis_proprio on perfis for update using (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['clientes','demandantes','tipos','status_internos','recursos','config']
  loop
    execute format('drop policy if exists %I_leitura on %I', t, t);
    execute format('create policy %I_leitura on %I for select using (true)', t, t);
    execute format('drop policy if exists %I_admin on %I', t, t);
    execute format('create policy %I_admin on %I for all using (eh_admin()) with check (eh_admin())', t, t);
  end loop;
end $$;

drop policy if exists pedidos_leitura on pedidos;
create policy pedidos_leitura on pedidos for select using (true);
drop policy if exists pedidos_editor on pedidos;
create policy pedidos_editor on pedidos for all using (eh_editor()) with check (eh_editor());

drop policy if exists reguas_leitura on reguas;
create policy reguas_leitura on reguas for select using (true);
drop policy if exists reguas_editor on reguas;
create policy reguas_editor on reguas for all using (eh_editor()) with check (eh_editor());

drop policy if exists eventos_leitura on eventos;
create policy eventos_leitura on eventos for select using (true);
drop policy if exists eventos_editor on eventos;
create policy eventos_editor on eventos for insert with check (eh_editor());

-- Realtime: a grade se atualiza sozinha quando alguém mexe.
-- Envolvido em bloco porque repetir o `add table` num banco que já tem a
-- tabela publicada é erro — e este arquivo precisa poder rodar duas vezes.
do $$
declare t text;
begin
  foreach t in array array['pedidos','reguas'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when others then null;
    end;
  end loop;
end $$;

-- ── carga inicial ───────────────────────────────────────────────────────────
insert into clientes (nome, slug, tag_azure) values ('Prudential','prudential','Prudential')
  on conflict (slug) do nothing;

insert into demandantes (cliente_id, nome)
select c.id, d.nome from clientes c,
  (values ('Carolina'),('Daniel'),('Edson'),('Gabriel'),('Gabriele'),('Giovanna'),('Lucas')) as d(nome)
where c.slug='prudential' on conflict do nothing;

insert into tipos (cliente_id, nome, cor, ordem)
select c.id, t.nome, t.cor, t.ordem from clientes c,
  (values ('NOVO','#2563EB',1),('RÉGUA','#EA0356',2),('AJUSTE','#D97706',3),('FURA-FILA','#DC2626',4)) as t(nome,cor,ordem)
where c.slug='prudential' on conflict do nothing;

insert into status_internos (cliente_id, nome, cor, ordem, entrega, cancelamento, pausa)
select c.id, s.nome, s.cor, s.ordem, s.entrega, s.cancelamento, s.pausa from clientes c,
  (values ('PRODUÇÃO','#EA580C',1,false,false,false),
          ('ENVIADO','#059669',2,true,false,false),
          ('ENVIADO PARA APROVAÇÃO','#2563EB',3,false,false,false),
          ('AGUARDANDO APROVAÇÃO INTERNA','#D97706',4,false,false,false),
          ('PARADO','#8C8494',5,false,false,true),
          ('CANCELADO','#DC2626',6,false,true,false)) as s(nome,cor,ordem,entrega,cancelamento,pausa)
where c.slug='prudential' on conflict do nothing;

-- CONFIRA estes nomes: o da esquerda é como a pessoa aparece no Azure.
insert into recursos (nome_azure, nome_pauta, area) values
  ('Vinicius','Vini','DA'), ('Gabriela','Gabi','DA'), ('Rodrigo','Rodrigo','DA'),
  ('YVE','YVE','DA'), ('Bruna','Bruna','Motion'), ('ELA','ELA','Redação'),
  ('Michele','Michele','Redação'), ('André','André','Redação')
on conflict (nome_azure) do nothing;

-- ── depois de criar seu primeiro usuário pelo app, vire admin: ──────────────
-- update perfis set papel='admin' where usuario='seu-usuario';


-- ============================================================================
-- PÁGINA DO CLIENTE — visão restrita, sem login
-- ============================================================================
-- O cliente abre /cliente/ e não entra em lugar nenhum. Para que ele veja
-- SÓ os quatro campos combinados, quem responde não é a tabela `pedidos` e sim
-- esta visão. Ela mostra o que tem entrega marcada de hoje até daqui a 7 dias.
--
-- BLOCO 1 — obrigatório: cria a visão e libera para o público.

create or replace view pauta_cliente as
select
  c.slug              as cliente,
  p.data_solicitacao  as entrada,
  d.nome              as demandante,
  p.titulo            as pedido,
  p.entrega_em        as entrega_em,
  p.data_entrega      as data_entrega
from pedidos p
join clientes c on c.id = p.cliente_id
left join demandantes d on d.id = p.demandante_id
left join status_internos si on si.id = p.status_interno_id
where coalesce(p.entrega_em::date, p.data_entrega)
      between current_date and current_date + 7
  and coalesce(si.cancelamento, false) = false;   -- cancelado não vai para o cliente

-- `security_invoker = off` faz a visão rodar com os direitos de quem a criou,
-- e não de quem consulta. É o que permite ela devolver dados sem que o público
-- tenha permissão na tabela `pedidos`. É intencional: a visão é a única porta.
alter view pauta_cliente set (security_invoker = off);

revoke all on pauta_cliente from anon, authenticated;
grant select on pauta_cliente to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- BLOCO 2 — o que realmente fecha a porta.
--
-- Sem isto, a restrição é só de fachada: a chave pública do site está dentro do
-- JavaScript das duas páginas, então quem abrir o DevTools consulta `pedidos`
-- direto e vê status interno, recurso e observações.
--
-- O preço: a pauta interna passa a exigir login também para consultar. Cada
-- pessoa do time cria uma conta (entra como leitor, e leitor só lê).
--
-- Rode quando o time estiver com as contas criadas:

-- drop policy if exists pedidos_leitura on pedidos;
-- create policy pedidos_leitura on pedidos
--   for select using (auth.uid() is not null);

-- Para voltar atrás:
-- drop policy if exists pedidos_leitura on pedidos;
-- create policy pedidos_leitura on pedidos for select using (true);

-- ============================================================================
-- MIGRAÇÃO — para quem JÁ rodou este arquivo antes
-- ============================================================================
-- O bloco abaixo é seguro de rodar quantas vezes quiser: tudo é
-- "if not exists" ou "on conflict do nothing". Rode ANTES de subir os
-- arquivos novos do site.

alter table pedidos add column if not exists qtd_artes int not null default 1
  check (qtd_artes >= 0);
alter table pedidos add column if not exists esforco numeric;
alter table pedidos add column if not exists motivo_cancelamento text;
alter table pedidos add column if not exists motivo_pausa text;
alter table status_internos add column if not exists cancelamento boolean not null default false;
alter table status_internos add column if not exists pausa boolean not null default false;

insert into status_internos (cliente_id, nome, cor, ordem, entrega, cancelamento, pausa)
select c.id, 'PARADO', '#8C8494', 89, false, false, true
from clientes c where c.slug = 'prudential'
on conflict (cliente_id, nome) do nothing;

insert into status_internos (cliente_id, nome, cor, ordem, entrega, cancelamento, pausa)
select c.id, 'CANCELADO', '#DC2626', 90, false, true, false
from clientes c where c.slug = 'prudential'
on conflict (cliente_id, nome) do nothing;

-- Se os status já existiam mas sem a marcação, marque-os:
update status_internos set cancelamento = true where nome = 'CANCELADO';
update status_internos set pausa = true where nome = 'PARADO';

create table if not exists reguas (
  id uuid primary key default gen_random_uuid(),
  cliente_id int not null references clientes on delete cascade,
  nome        text,
  link        text,
  status      text not null default 'radar'
                check (status in ('radar','producao','finalizado')),
  observacao  text,
  ordem       int not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists reguas_cliente_idx on reguas (cliente_id, ordem, criado_em);

drop trigger if exists reguas_toca on reguas;
create trigger reguas_toca before update on reguas
  for each row execute function toca_atualizado_em();

alter table reguas enable row level security;
drop policy if exists reguas_leitura on reguas;
create policy reguas_leitura on reguas for select using (true);
drop policy if exists reguas_editor on reguas;
create policy reguas_editor on reguas for all using (eh_editor()) with check (eh_editor());

do $$
begin
  begin execute 'alter publication supabase_realtime add table reguas';
  exception when others then null;
  end;
end $$;

-- A visão do cliente passa a esconder o que foi cancelado:
create or replace view pauta_cliente as
select
  c.slug              as cliente,
  p.data_solicitacao  as entrada,
  d.nome              as demandante,
  p.titulo            as pedido,
  p.entrega_em        as entrega_em,
  p.data_entrega      as data_entrega
from pedidos p
join clientes c on c.id = p.cliente_id
left join demandantes d on d.id = p.demandante_id
left join status_internos si on si.id = p.status_interno_id
where coalesce(p.entrega_em::date, p.data_entrega)
      between current_date and current_date + 7
  and coalesce(si.cancelamento, false) = false;

alter view pauta_cliente set (security_invoker = off);
revoke all on pauta_cliente from anon, authenticated;
grant select on pauta_cliente to anon, authenticated;

-- ── fim da migração ─────────────────────────────────────────────────────────

-- ============================================================================
-- AGENDADOR DO SYNC — rode este bloco DEPOIS de publicar a Edge Function
-- ============================================================================
-- O pg_cron chama a função `sync` de 10 em 10 minutos. De quebra, essa
-- atividade constante impede o projeto Free de ser pausado por inatividade
-- (o Supabase pausa depois de ~7 dias parado).
--
-- Troque as duas coisas marcadas e rode:

-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'sync-azure',
--   '*/10 * * * *',
--   $$
--   select net.http_post(
--     url     := 'https://SEU-PROJETO.supabase.co/functions/v1/sync',
--     headers := jsonb_build_object(
--                  'Content-Type',  'application/json',
--                  'apikey',        'SUA_ANON_KEY',
--                  'Authorization', 'Bearer SUA_ANON_KEY',
--                  'x-cron-secret', 'SEU_CRON_SECRET'
--                ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );

-- Para rodar uma vez agora, na mão (o primeiro sync busca 60 dias):
--   select net.http_post(
--     url     := 'https://SEU-PROJETO.supabase.co/functions/v1/sync',
--     headers := jsonb_build_object(
--                  'Content-Type',  'application/json',
--                  'apikey',        'SUA_ANON_KEY',
--                  'Authorization', 'Bearer SUA_ANON_KEY',
--                  'x-cron-secret', 'SEU_CRON_SECRET'
--                ),
--     body    := '{}'::jsonb
--   );

-- Conferir:
--   select * from cron.job;
--   select * from sync_log order by inicio desc limit 5;
-- Desligar:
--   select cron.unschedule('sync-azure');
