import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CrearOperarioInput, EditarOperarioInput, OperarioDTO } from '@taller/shared';
import { api } from './client';

export function useOperarios(estado: 'activos' | 'todos') {
  return useQuery({
    queryKey: ['operarios', estado],
    queryFn: () => api<OperarioDTO[]>(`/operarios?estado=${estado}`),
  });
}

export function useCrearOperario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearOperarioInput) =>
      api<OperarioDTO>('/operarios', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operarios'] }),
  });
}

export function useEditarOperario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: EditarOperarioInput }) =>
      api<OperarioDTO>(`/operarios/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operarios'] }),
  });
}
