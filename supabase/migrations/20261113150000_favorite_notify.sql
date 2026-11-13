-- Each favorite team or competition can be muted without unfollowing it.
alter table public.favorites add column notify boolean not null default true;

create policy "Users update their own favorites" on public.favorites
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Followers are now teams and competitions, and only the ones with notifications on.
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

  insert into public.notifications (user_id, match_id, kind, title, body)
  select distinct f.user_id, new.id, v_kind, v_title, v_body
  from public.favorites f
  where f.notify
    and ((f.kind = 'team' and f.entity_id in (new.home_team_id, new.away_team_id))
      or (f.kind = 'competition' and f.entity_id = new.competition_id));
  return new;
end;
$$;
