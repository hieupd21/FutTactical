import { useSyncExternalStore } from "react";

/** Theo dõi một media query (ví dụ "(min-width: 1024px)") */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", notify);
      return () => mediaQueryList.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
