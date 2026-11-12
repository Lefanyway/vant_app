-- Trigger helpers are not an API; only the sync (as anon, with its ingest key) calls ingest_esports.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.ingest_esports(text, jsonb, jsonb, jsonb, jsonb, text, timestamptz, timestamptz) from authenticated;
