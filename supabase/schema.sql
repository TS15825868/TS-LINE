-- 仙加味內部管理 App／社群審核台持久化資料表
-- 請在 Supabase Dashboard > SQL Editor 執行一次。

create table if not exists public.xjw_app_state (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.xjw_app_state is
  '仙加味內部管理 App 與社群審核台的持久化狀態';

alter table public.xjw_app_state enable row level security;

revoke all on table public.xjw_app_state from anon, authenticated;
grant select, insert, update, delete on table public.xjw_app_state to service_role;

create index if not exists xjw_app_state_updated_at_idx
  on public.xjw_app_state (updated_at desc);

insert into public.xjw_app_state (key, data)
values
  ('internal', '{}'::jsonb),
  ('social', '{}'::jsonb)
on conflict (key) do nothing;
