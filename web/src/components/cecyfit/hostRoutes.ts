const paths = {
  H1: "",
  H2: "clientes",
  H2a: "clientes/alta",
  H2b: "clientes/vincular",
  H2c: "clientes/ficha",
  H2d: "clientes/salud",
  H2e: "clientes/modulos",
  H2f: "clientes/planes",
  H2g: "clientes/seguimiento",
  H2h: "clientes/documentos",
  H2i: "clientes/historial",
  H3: "plantillas",
  H3a: "plantillas/crear",
  H3b: "plantillas/editar",
  H4: "modulos",
  H4a: "modulos/crear",
  H4b: "modulos/configurar",
  H4c: "clientes/configurar",
  H5: "expedientes",
  H5a: "expedientes/cargar",
  H5b: "expedientes/documento",
  H6: "seguimiento",
  H6a: "seguimiento/nutricion",
  H6b: "seguimiento/sincronizacion",
  H7a: "clientes/plan-nutricional",
  H7b: "clientes/rutina",
  H7c: "clientes/habitos",
  H7d: "clientes/editar-salud",
} as const;

export type HostScreenId = keyof typeof paths;

const patientScreens = new Set<HostScreenId>([
  "H2b", "H2c", "H2d", "H2e", "H2f", "H2g", "H2h", "H2i",
  "H4c", "H7a", "H7b", "H7c", "H7d",
]);

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function hostHref(screenId: HostScreenId, patientId?: string) {
  if (screenId === "H1") return "/";
  const suffix = patientId && patientScreens.has(screenId) ? `/${patientId}` : "";
  return `/panel/${paths[screenId]}${suffix}`;
}

export function resolveHostRoute(segments: string[]) {
  const possibleId = segments.at(-1);
  const patientId = possibleId && uuidPattern.test(possibleId) ? possibleId : undefined;
  const path = (patientId ? segments.slice(0, -1) : segments).join("/");
  const screenId = (Object.keys(paths) as HostScreenId[]).find((id) => paths[id] === path);

  if (!screenId || screenId === "H1" || (patientId && !patientScreens.has(screenId))) {
    return null;
  }
  return { screenId, patientId };
}
