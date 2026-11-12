-- Win probabilities from the VANT model (Elo + logistic regression), and each training run's test metrics.

create table public.model_runs (
  id bigint generated always as identity primary key,
  model_version text not null,
  trained_at timestamptz not null default now(),
  train_matches integer not null,
  test_matches integer not null,
  metrics jsonb not null,              -- accuracy, brier, log_loss for the model and the Elo-only baseline
  coefficients jsonb not null          -- feature name -> weight, to explain the model
);

create table public.predictions (
  match_id text primary key references public.matches (id) on delete cascade,
  model_run_id bigint not null references public.model_runs (id) on delete cascade,
  home_win_prob real not null check (home_win_prob between 0 and 1),
  home_elo real not null,
  away_elo real not null,
  features jsonb not null,
  created_at timestamptz not null default now()
);

create index predictions_model_run_idx on public.predictions (model_run_id);

alter table public.model_runs enable row level security;
alter table public.predictions enable row level security;
create policy "Model runs are public" on public.model_runs for select to anon, authenticated using (true);
create policy "Predictions are public" on public.predictions for select to anon, authenticated using (true);

-- Same ingest key as the esports sync; replaces every prediction with the new run's.
create or replace function public.ingest_predictions(p_key text, p_run jsonb, p_predictions jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id bigint;
  v_count integer := 0;
begin
  if p_key is null or not exists (
    select 1 from private.ingest_keys
    where key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
  ) then
    raise exception 'invalid ingest key' using errcode = '42501';
  end if;

  insert into public.model_runs (model_version, train_matches, test_matches, metrics, coefficients)
  values (p_run ->> 'model_version', (p_run ->> 'train_matches')::integer, (p_run ->> 'test_matches')::integer, p_run -> 'metrics', p_run -> 'coefficients')
  returning id into v_run_id;

  delete from public.predictions where true;

  insert into public.predictions (match_id, model_run_id, home_win_prob, home_elo, away_elo, features)
  select p.match_id, v_run_id, p.home_win_prob, p.home_elo, p.away_elo, p.features
  from jsonb_to_recordset(p_predictions) as p(match_id text, home_win_prob real, home_elo real, away_elo real, features jsonb)
  where exists (select 1 from public.matches m where m.id = p.match_id);
  get diagnostics v_count = row_count;

  return jsonb_build_object('model_run_id', v_run_id, 'predictions', v_count);
end;
$$;

revoke all on function public.ingest_predictions(text, jsonb, jsonb) from public, authenticated;
grant execute on function public.ingest_predictions(text, jsonb, jsonb) to anon;
