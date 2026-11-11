import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => {
        if (count >= 1) return false;
        if (error && typeof error === "object" && "retryable" in error) return Boolean((error as { retryable?: boolean }).retryable);
        return true;
      },
      refetchOnWindowFocus: false,
    },
  },
});
