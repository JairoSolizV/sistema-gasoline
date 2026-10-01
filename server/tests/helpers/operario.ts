// Datos personales válidos para dar de alta operarios en los tests (el alta los
// exige). La cédula se genera única por llamada: la BD tiene `ci` @unique.
let secuencia = 0;

export function datosOperario(extra: Record<string, unknown> = {}) {
  secuencia += 1;
  const ci = `9${String(Date.now()).slice(-6)}${String(secuencia).padStart(3, '0')} LP`;
  return {
    ci,
    celular: '71234567',
    fechaNacimiento: '1990-05-15T12:00:00.000Z',
    fechaIngreso: '2026-01-05T12:00:00.000Z',
    ...extra,
  };
}
