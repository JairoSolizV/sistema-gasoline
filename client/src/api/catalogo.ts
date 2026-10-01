import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CatalogoArbolDTO, CatalogoNodoDTO, FusionDTO } from '@taller/shared';
import { api } from './client';

// Un solo GET trae todo el árbol (pocos KB): el formulario de modelos lo cachea
// y resuelve la cascada en el cliente, sin una request por nivel.
export function useCatalogo(soloActivos = true) {
  return useQuery({
    queryKey: ['catalogo', soloActivos],
    queryFn: () => api<CatalogoArbolDTO>(`/catalogo/arbol?soloActivos=${soloActivos}`),
    staleTime: 5 * 60 * 1000,
  });
}

export const rutasCatalogo = {
  maquinas: '/catalogo/maquinas',
  grupos: '/catalogo/grupos',
  procesosDe: (maquinaId: string) => `/catalogo/maquinas/${maquinaId}/procesos`,
  piezasDe: (procesoId: string) => `/catalogo/procesos/${procesoId}/piezas`,
  maquina: (id: string) => `/catalogo/maquinas/${id}`,
  proceso: (id: string) => `/catalogo/procesos/${id}`,
  pieza: (id: string) => `/catalogo/piezas/${id}`,
  grupo: (id: string) => `/catalogo/grupos/${id}`,
};

export interface CambiosNodo {
  nombre?: string;
  activo?: boolean;
  orden?: number;
}

/** Toda mutación del catálogo invalida el árbol (activos e inactivos). */
function useMutacionCatalogo<V, R>(mutationFn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalogo'] }),
  });
}

export function useCrearNodo() {
  return useMutacionCatalogo(({ ruta, nombre }: { ruta: string; nombre: string }) =>
    api<CatalogoNodoDTO>(ruta, { method: 'POST', body: JSON.stringify({ nombre }) }),
  );
}

export function useEditarNodo() {
  return useMutacionCatalogo(({ ruta, cambios }: { ruta: string; cambios: CambiosNodo }) =>
    api<CatalogoNodoDTO>(ruta, { method: 'PATCH', body: JSON.stringify(cambios) }),
  );
}

/** Unir dos entradas: la de origen desaparece y sus operaciones pasan a decir el
 *  nombre de la de destino. Los cortes ya creados no se tocan. */
export function useFusionarNodo() {
  return useMutacionCatalogo(({ ruta, destinoId }: { ruta: string; destinoId: string }) =>
    api<FusionDTO>(`${ruta}/fusionar`, { method: 'POST', body: JSON.stringify({ destinoId }) }),
  );
}

export function useBorrarNodo() {
  return useMutacionCatalogo(({ ruta }: { ruta: string }) =>
    api<{ eliminado: boolean }>(ruta, { method: 'DELETE' }),
  );
}
