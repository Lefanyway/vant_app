-- Each team's latest Elo from the model: the rating it carried into its most recent predicted match.
create view public.team_elo
with (security_invoker = true) as
select distinct on (team_id) team_id, elo, start_time as rated_at
from (
  select m.home_team_id as team_id, p.home_elo as elo, m.start_time from public.predictions p join public.matches m on m.id = p.match_id where m.home_team_id is not null
  union all
  select m.away_team_id, p.away_elo, m.start_time from public.predictions p join public.matches m on m.id = p.match_id where m.away_team_id is not null
) ratings
order by team_id, start_time desc;

grant select on public.team_elo to anon, authenticated;
