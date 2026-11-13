import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, type Query } from "@tanstack/react-query";

const DAY = 24 * 60 * 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Kept for a day so the copy saved on the phone is still there on the next open.
      gcTime: DAY,
      retry: (count, error) => {
        if (count >= 1) return false;
        if (error && typeof error === "object" && "retryable" in error) return Boolean((error as { retryable?: boolean }).retryable);
        return true;
      },
      refetchOnWindowFocus: false,
    },
  },
});

// The app opens with the last lists it showed, then refreshes them in the background.
const saved = new Set(["matches", "competitions", "insights", "team-overview", "upcoming"]);
export const persistOptions = {
  persister: createAsyncStoragePersister({ storage: AsyncStorage, key: "vant-cache" }),
  maxAge: DAY,
  // Bump when a saved query changes shape, so phones drop the old copy.
  buster: "2",
  dehydrateOptions: { shouldDehydrateQuery: (query: Query) => query.state.status === "success" && saved.has(String(query.queryKey[0])) },
};
