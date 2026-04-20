import { useEffect, useState, useCallback } from "react";

export type Route =
  | { name: "dashboard" }
  | { name: "study"; scheduleId: string }
  | { name: "vocab" }
  | { name: "hanzi" }
  | { name: "grammar" }
  | { name: "sentences" }
  | { name: "schedules" }
  | { name: "settings" };

function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, "").trim();
  if (!h) return { name: "dashboard" };
  const [head, ...rest] = h.split("/");
  switch (head) {
    case "dashboard": return { name: "dashboard" };
    case "vocab": return { name: "vocab" };
    case "hanzi": return { name: "hanzi" };
    case "grammar": return { name: "grammar" };
    case "sentences": return { name: "sentences" };
    case "schedules": return { name: "schedules" };
    case "settings": return { name: "settings" };
    case "study": return { name: "study", scheduleId: rest[0] ?? "" };
    default: return { name: "dashboard" };
  }
}

export function stringifyRoute(r: Route): string {
  switch (r.name) {
    case "study": return `#/study/${r.scheduleId}`;
    default: return `#/${r.name}`;
  }
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = useCallback((r: Route) => {
    const target = stringifyRoute(r);
    if (window.location.hash !== target) window.location.hash = target;
    else setRoute(r);
  }, []);

  return [route, navigate];
}
