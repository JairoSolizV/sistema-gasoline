// Datos del tendido válidos para crear cortes en los tests (el alta los exige).
// Por defecto el corte es EXTERNO: así los tests de costura pueden cerrarlo sin
// registrar los procesos del servicio de corte. Los tests del servicio pasan
// { esInterno: true } (ver servicio-corte.test.ts).
export async function datosCorte(extra: Record<string, unknown> = {}) {
  return {
    tela: 'DENIM 14 OZ',
    anchoCm: 160,
    trazadoCm: 525,
    esInterno: false,
    ...extra,
  };
}
