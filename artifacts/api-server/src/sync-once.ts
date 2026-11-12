// One sync pass and exit: what the scheduled GitHub Action runs, so the data stays fresh with no computer on.
import "./load-env";
import { logger } from "./lib/logger";
import { SupabaseStore } from "./providers/esports/supabase/store";
import { SupabaseSync } from "./providers/esports/supabase/sync";

const sync = SupabaseSync.fromEnv(SupabaseStore.fromEnv());
if (!sync) {
  logger.error("Set PANDASCORE_API_TOKEN, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_INGEST_KEY");
  process.exit(1);
}
try {
  await sync.runOnce();
  logger.info("Sync pass finished");
} catch (error) {
  logger.error({ err: error instanceof Error ? error.message : String(error) }, "Sync pass failed");
  process.exitCode = 1;
}
