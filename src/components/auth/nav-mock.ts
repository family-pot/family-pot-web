// Test helper: a tiny real router. `router.replace` changes the "URL" and
// notifies hooks, so components re-render the way they do in the app.
import { useSyncExternalStore } from "react";

type Listener = () => void;

export function createNavStore(initial = "/") {
  const listeners = new Set<Listener>();
  let href = initial;
  const history: string[] = [];

  const subscribe = (l: Listener) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const set = (next: string) => {
    href = next;
    history.push(next);
    listeners.forEach((l) => l());
  };
  const url = () => new URL(href, "http://localhost");

  return {
    history,
    get href() {
      return href;
    },
    set,
    router: { replace: set, push: set },
    usePathname: () =>
      useSyncExternalStore(
        subscribe,
        () => url().pathname,
        () => url().pathname,
      ),
    useSearchParams: () => {
      const search = useSyncExternalStore(
        subscribe,
        () => url().search,
        () => url().search,
      );
      return new URLSearchParams(search);
    },
  };
}
