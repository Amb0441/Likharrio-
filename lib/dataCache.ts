import { queryClient } from "./queryClient";

function cacheQueryKey(key: string) {
  return ["cache", key] as const;
}

export function getCached<T>(key: string): T | null {
  const data = queryClient.getQueryData<T>(cacheQueryKey(key));
  return data === undefined ? null : data;
}

export function setCache<T>(key: string, data: T): void {
  queryClient.setQueryData(cacheQueryKey(key), data);
}

export function hasCache(key: string): boolean {
  return queryClient.getQueryData(cacheQueryKey(key)) !== undefined;
}

export function clearCache(key?: string): void {
  if (key) {
    queryClient.removeQueries({ queryKey: cacheQueryKey(key) });
    return;
  }
  queryClient.clear();
}

export async function fetchOnce<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  return queryClient.fetchQuery({
    queryKey: cacheQueryKey(key),
    queryFn: fetcher,
    staleTime: Infinity,
  });
}

export function cacheKey(...parts: string[]): string {
  return parts.filter(Boolean).join("::");
}
