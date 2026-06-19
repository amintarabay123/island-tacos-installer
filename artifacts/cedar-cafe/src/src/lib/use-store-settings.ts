import { useGetStoreSettings, type StoreSettings } from "@workspace/api-client-react";

const FALLBACK: StoreSettings = {
  id: 0,
  storeName: "Cedar Cafe",
  phone: "284-344-9808",
  email: "",
  address: "Road Town, Tortola, BVI",
  taxRate: "0",
  timezone: "America/Tortola",
  currency: "USD",
  createdAt: "1970-01-01T00:00:00.000Z",
  updatedAt: "1970-01-01T00:00:00.000Z",
};

/**
 * Returns the active store profile.
 *
 * Always returns a non-undefined value so call sites don't have to deal with
 * first-render flicker. While the network request is in flight, it returns
 * sane Island-Tacos fallback values; the real values from the API replace
 * them as soon as the query settles. The underlying React Query result is
 * exposed on `_query` for call sites that need isLoading / isError.
 *
 * Cache TTL matches the 60 s window of the server-side `getStoreSettings()`
 * helper — both are set globally in App.tsx (QueryClient.staleTime).
 *
 * TODO(store-settings): when multi-tenancy lands, drop the hardcoded fallback
 * and let the page render a skeleton instead. We can only afford the fallback
 * today because it matches the one tenant in production.
 */
export function useStoreSettings(): StoreSettings & { _query: ReturnType<typeof useGetStoreSettings> } {
  const query = useGetStoreSettings();
  return { ...(query.data ?? FALLBACK), _query: query };
}
