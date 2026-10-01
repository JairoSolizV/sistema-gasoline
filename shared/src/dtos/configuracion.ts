export interface ConfiguracionDTO {
  topeAnticipoAdvertencia: number; // centavos
  diferencialMaestroExterno: number; // centavos
  nombreTaller: string | null;
  // Servicio de corte interno: predeterminados en centavos (ver CLAVES_TARIFA_CORTE)
  tarifaBusqueda: number; // por prenda, al buscador del modelo
  tarifaMoldeNuevo: number; // fijo, modelo nuevo
  tarifaMoldeModificacion: number; // fijo, moldes modificados en una versión nueva
  tarifaTrazado: number; // por prenda
  tarifaDobladoHoja: number; // por prenda, total del proceso (2 dobladores)
  tarifaDobladoPares: number; // por prenda, total del proceso (2 dobladores)
  tarifaCorteRespaldo: number; // por prenda y cortador sin tarifa propia
  tarifaClasificacionRespaldo: number; // por prenda y clasificador sin tarifa propia
}
