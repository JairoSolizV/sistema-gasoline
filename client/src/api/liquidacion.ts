import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CerrarMesInput, ConsolidadoDTO } from '@taller/shared';
import { api } from './client';

export function useConsolidado(anio: number, mes: number) {
  return useQuery({
    queryKey: ['liquidacion', anio, mes],
    queryFn: () => api<ConsolidadoDTO>(`/liquidacion?anio=${anio}&mes=${mes}`),
  });
}

export function useCerrarMes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CerrarMesInput) =>
      api<ConsolidadoDTO>('/liquidacion/cerrar-mes', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (dto) => {
      qc.setQueryData(['liquidacion', dto.anio, dto.mes], dto);
      qc.invalidateQueries({ queryKey: ['liquidacion'] });
    },
  });
}
