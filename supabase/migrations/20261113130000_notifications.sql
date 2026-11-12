-- Notifications: the database writes one for each follower when a match starts or ends,
-- and the app receives it live through Supabase Realtime.

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id text references public.matches (id) on delete cascade,
  kind text not null check (kind in ('match_started', 'match_finished', 'simulated')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "Users read their own notifications" on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users mark their own notifications read" on public.notifications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users clear their own notifications" on public.notifications for delete to authenticated using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.notifications;

-- "LOUD vs Sentinels" and "LOUD 2–1 Sentinels" from the stored match.
create or replace function private.match_line(m public.matches, with_score boolean) returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(m.payload -> 'homeTeam' ->> 'name', 'A definir')
    || case when with_score and m.home_score is not null and m.away_score is not null
            then ' ' || m.home_score || '–' || m.away_score || ' ' else ' vs ' end
    || coalesce(m.payload -> 'awayTeam' ->> 'name', 'A definir');
$$;

create or replace function private.notify_match_followers() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_title text;
  v_body text;
begin
  if new.status = old.status then return new; end if;
  if new.status = 'live' then
    v_kind := 'match_started';
    v_title := 'Começou: ' || private.match_line(new, false);
  elsif new.status = 'finished' then
    v_kind := 'match_finished';
    v_title := 'Fim de jogo: ' || private.match_line(new, true);
  else
    return new;
  end if;
  v_body := coalesce(new.payload -> 'competition' ->> 'name', 'Valorant') || coalesce(' · ' || new.serie_name, '');

  -- Followers of either team, plus anyone who saved this match (results only if they kept that preference on).
  insert into public.notifications (user_id, match_id, kind, title, body)
  select distinct f.user_id, new.id, v_kind, v_title, v_body
  from public.favorites f
  join public.profiles p on p.id = f.user_id
  where (f.kind = 'team' and f.entity_id in (new.home_team_id, new.away_team_id))
     or (f.kind = 'match' and f.entity_id = new.id and (v_kind = 'match_started' or p.notify_saved_results));
  return new;
end;
$$;

create trigger matches_notify_followers
  after update of status on public.matches
  for each row execute function private.notify_match_followers();

-- For demos without a live match: sends the signed-in user a notification built from a real recent match,
-- preferring one of their favorite teams.
create or replace function public.simulate_notification() returns public.notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_match public.matches;
  v_row public.notifications;
begin
  if v_user is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select m.* into v_match
  from public.matches m
  where m.status = 'finished' and m.home_score is not null
  order by exists (
    select 1 from public.favorites f
    where f.user_id = v_user and ((f.kind = 'team' and f.entity_id in (m.home_team_id, m.away_team_id)) or (f.kind = 'match' and f.entity_id = m.id))
  ) desc, m.start_time desc
  limit 1;
  if v_match.id is null then raise exception 'no finished match stored yet'; end if;

  insert into public.notifications (user_id, match_id, kind, title, body)
  values (v_user, v_match.id, 'simulated', 'Fim de jogo: ' || private.match_line(v_match, true),
          coalesce(v_match.payload -> 'competition' ->> 'name', 'Valorant') || ' · notificação de teste')
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.simulate_notification() from public, anon;
grant execute on function public.simulate_notification() to authenticated;
revoke all on function private.notify_match_followers() from public, anon, authenticated;
