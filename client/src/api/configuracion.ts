import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConfiguracionDTO, EditarConfiguracionInput } from '@taller/shared';
import { api } from './client';

export function useConfiguracion() {
  return useQuery({ queryKey: ['configuracion'], queryFn: () => api<ConfiguracionDTO>('/configuracion') });
}

export function useEditarConfiguracion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EditarConfiguracionInput) =>
      api<ConfiguracionDTO>('/configuracion', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: (dto) => qc.setQueryData(['configuracion'], dto),
  });
}
