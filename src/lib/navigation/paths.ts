export function withRouteBase(routeBase: string | undefined, path: string) {
  const base = routeBase && routeBase !== "/" ? routeBase : "";
  return base ? `${base}${path}` : path;
}

export function normalizeSearchBase(value: string | null) {
  return value === "/creator" ? value : "";
}
