-- VANT: esports data synced from PandaScore, plus each user's profile and favorites.
-- Esports tables are public read-only; only public.ingest_esports (guarded by an ingest key) writes them.

create extension if not exists pgcrypto with schema extensions;

-- Esports data ---------------------------------------------------------------

create table public.competitions (
  id text primary key,                 -- "pandascore:<league id>"
  name text not null,
  slug text,
  logo_url text,
  region text,
  game_id text not null default 'valorant',
  updated_at timestamptz not null default now()
);

create table public.teams (
  id text primary key,                 -- "pandascore:<team id>"
  name text not null,
  acronym text,
  logo_url text,
  country text,
  game_id text not null default 'valorant',
  updated_at timestamptz not null default now()
);

create table public.players (
  id text primary key,                 -- "pandascore:<player id>"
  team_id text references public.teams (id) on delete set null,
  name text not null,
  full_name text,
  image_url text,
  country text,
  role text,
  status text check (status in ('player', 'coach', 'staff')),
  updated_at timestamptz not null default now()
);

create table public.matches (
  id text primary key,                 -- "pandascore:<match id>"
  game_id text not null default 'valorant',
  competition_id text references public.competitions (id) on delete set null,
  serie_name text,
  home_team_id text references public.teams (id) on delete set null,
  away_team_id text references public.teams (id) on delete set null,
  status text not null check (status in ('scheduled', 'live', 'finished', 'cancelled', 'postponed')),
  start_time timestamptz,
  scheduled_time timestamptz,
  best_of smallint check (best_of in (1, 3, 5)),
  home_score smallint,
  away_score smallint,
  streams jsonb not null default '[]'::jsonb,
  payload jsonb not null,              -- the match exactly as the VANT API serves it
  updated_at timestamptz not null default now()
);

create index matches_start_time_idx on public.matches (start_time);
create index matches_status_idx on public.matches (status) where status in ('live', 'scheduled');
create index matches_home_team_idx on public.matches (home_team_id, start_time desc);
create index matches_away_team_idx on public.matches (away_team_id, start_time desc);
create index matches_competition_idx on public.matches (competition_id, start_time desc);
create index players_team_idx on public.players (team_id);

create table public.sync_runs (
  id bigint generated always as identity primary key,
  kind text not null,
  range_start timestamptz,
  range_end timestamptz,
  matches_upserted integer not null default 0,
  teams_upserted integer not null default 0,
  players_upserted integer not null default 0,
  finished_at timestamptz not null default now()
);

alter table public.competitions enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;
alter table public.sync_runs enable row level security;

create policy "Esports competitions are public" on public.competitions for select to anon, authenticated using (true);
create policy "Esports teams are public" on public.teams for select to anon, authenticated using (true);
create policy "Esports players are public" on public.players for select to anon, authenticated using (true);
create policy "Esports matches are public" on public.matches for select to anon, authenticated using (true);
create policy "Sync history is public" on public.sync_runs for select to anon, authenticated using (true);

-- Ingestion ------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Only the SHA-256 of the API server's ingest key is stored here.
create table private.ingest_keys (
  key_hash text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

create or replace function public.ingest_esports(
  p_key text,
  p_competitions jsonb default '[]'::jsonb,
  p_teams jsonb default '[]'::jsonb,
  p_players jsonb default '[]'::jsonb,
  p_matches jsonb default '[]'::jsonb,
  p_kind text default 'sync',
  p_range_start timestamptz default null,
  p_range_end timestamptz default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_matches integer := 0;
  v_teams integer := 0;
  v_players integer := 0;
begin
  if p_key is null or not exists (
    select 1 from private.ingest_keys
    where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
  ) then
    raise exception 'invalid ingest key' using errcode = '42501';
  end if;

  insert into public.competitions (id, name, slug, logo_url, region, game_id, updated_at)
  select c.id, c.name, c.slug, c.logo_url, c.region, coalesce(c.game_id, 'valorant'), now()
  from jsonb_to_recordset(p_competitions) as c(id text, name text, slug text, logo_url text, region text, game_id text)
  where c.id is not null and c.name is not null
  on conflict (id) do update set
    name = excluded.name, slug = excluded.slug, logo_url = coalesce(excluded.logo_url, public.competitions.logo_url),
    region = coalesce(excluded.region, public.competitions.region), game_id = excluded.game_id, updated_at = now();

  insert into public.teams (id, name, acronym, logo_url, country, game_id, updated_at)
  select t.id, t.name, t.acronym, t.logo_url, t.country, coalesce(t.game_id, 'valorant'), now()
  from jsonb_to_recordset(p_teams) as t(id text, name text, acronym text, logo_url text, country text, game_id text)
  where t.id is not null and t.name is not null
  on conflict (id) do update set
    name = excluded.name, acronym = excluded.acronym, logo_url = coalesce(excluded.logo_url, public.teams.logo_url),
    country = coalesce(excluded.country, public.teams.country), game_id = excluded.game_id, updated_at = now();
  get diagnostics v_teams = row_count;

  insert into public.players (id, team_id, name, full_name, image_url, country, role, status, updated_at)
  select p.id, p.team_id, p.name, p.full_name, p.image_url, p.country, p.role, p.status, now()
  from jsonb_to_recordset(p_players) as p(id text, team_id text, name text, full_name text, image_url text, country text, role text, status text)
  where p.id is not null and p.name is not null
  on conflict (id) do update set
    team_id = excluded.team_id, name = excluded.name, full_name = excluded.full_name, image_url = excluded.image_url,
    country = excluded.country, role = excluded.role, status = excluded.status, updated_at = now();
  get diagnostics v_players = row_count;

  insert into public.matches (id, game_id, competition_id, serie_name, home_team_id, away_team_id, status, start_time, scheduled_time, best_of, home_score, away_score, streams, payload, updated_at)
  select m.id, coalesce(m.game_id, 'valorant'), m.competition_id, m.serie_name, m.home_team_id, m.away_team_id, m.status,
         m.start_time, m.scheduled_time, m.best_of, m.home_score, m.away_score, coalesce(m.streams, '[]'::jsonb), m.payload, now()
  from jsonb_to_recordset(p_matches) as m(id text, game_id text, competition_id text, serie_name text, home_team_id text, away_team_id text, status text,
       start_time timestamptz, scheduled_time timestamptz, best_of smallint, home_score smallint, away_score smallint, streams jsonb, payload jsonb)
  where m.id is not null and m.payload is not null
  on conflict (id) do update set
    competition_id = excluded.competition_id, serie_name = excluded.serie_name, home_team_id = excluded.home_team_id,
    away_team_id = excluded.away_team_id, status = excluded.status, start_time = excluded.start_time, scheduled_time = excluded.scheduled_time,
    best_of = excluded.best_of, home_score = excluded.home_score, away_score = excluded.away_score, streams = excluded.streams,
    payload = excluded.payload, updated_at = now();
  get diagnostics v_matches = row_count;

  insert into public.sync_runs (kind, range_start, range_end, matches_upserted, teams_upserted, players_upserted)
  values (left(coalesce(p_kind, 'sync'), 40), p_range_start, p_range_end, v_matches, v_teams, v_players);

  return jsonb_build_object('matches', v_matches, 'teams', v_teams, 'players', v_players);
end;
$$;

revoke all on function public.ingest_esports(text, jsonb, jsonb, jsonb, jsonb, text, timestamptz, timestamptz) from public;
grant execute on function public.ingest_esports(text, jsonb, jsonb, jsonb, jsonb, text, timestamptz, timestamptz) to anon, authenticated;

-- Users ----------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  notify_saved_results boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('team', 'competition', 'match')),
  entity_id text not null check (char_length(entity_id) <= 120),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, entity_id)
);

alter table public.profiles enable row level security;
alter table public.favorites enable row level security;

create policy "Users read their own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Users update their own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Users read their own favorites" on public.favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users add their own favorites" on public.favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users remove their own favorites" on public.favorites for delete to authenticated using ((select auth.uid()) = user_id);

-- A profile is created with every account, named from the sign-up form.
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 60), ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
