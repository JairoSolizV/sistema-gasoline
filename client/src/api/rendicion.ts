import { useQuery } from '@tanstack/react-query';
import type { RendicionDTO } from '@taller/shared';
import { api } from './client';

export function useRendicion(operarioId: string | undefined, anio: number, mes: number) {
  return useQuery({
    queryKey: ['rendicion', operarioId, anio, mes],
    queryFn: () => api<RendicionDTO>(`/rendicion/${operarioId}?anio=${anio}&mes=${mes}`),
    enabled: !!operarioId,
  });
}
