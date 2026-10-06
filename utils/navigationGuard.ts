import { useRef, useCallback } from "react";
import { useRouter, type Router } from "expo-router";

const NAV_DEBOUNCE_MS = 800;

export function useGuardedRouter() {
  const router = useRouter();
  const guardRef = useRef(false);

  const guardedPush = useCallback(
    (href: Parameters<Router["push"]>[0]) => {
      if (guardRef.current) return;
      guardRef.current = true;
      router.push(href);
      setTimeout(() => {
        guardRef.current = false;
      }, NAV_DEBOUNCE_MS);
    },
    [router]
  );

  const guardedReplace = useCallback(
    (href: Parameters<Router["replace"]>[0]) => {
      if (guardRef.current) return;
      guardRef.current = true;
      router.replace(href);
      setTimeout(() => {
        guardRef.current = false;
      }, NAV_DEBOUNCE_MS);
    },
    [router]
  );

  const guardedBack = useCallback(() => {
    if (guardRef.current) return;
    guardRef.current = true;
    router.back();
    setTimeout(() => {
      guardRef.current = false;
    }, NAV_DEBOUNCE_MS);
  }, [router]);

  const isGuarded = () => guardRef.current;

  return { guardedPush, guardedReplace, guardedBack, isGuarded, guardRef };
}
