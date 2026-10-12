import { useEffect, useState } from "react";

export type Route = "forecast" | "budget";

const parse = (hash: string): Route => (hash === "#/budget" ? "budget" : "forecast");

/** Current page from the URL hash (#/forecast or #/budget); anything else is the forecast page. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
