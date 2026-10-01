import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CrearOperarioInput,
  EditarOperarioInput,
  OperarioDTO,
  RolOperario,
} from '@taller/shared';
import { api } from './client';

/** Con `rol`, solo los que tienen ese oficio (restricción estricta de roles). */
export function useOperarios(estado: 'activos' | 'todos', rol?: RolOperario) {
  return useQuery({
    queryKey: ['operarios', estado, rol ?? 'todos-los-roles'],
    queryFn: () =>
      api<OperarioDTO[]>(`/operarios?estado=${estado}${rol ? `&rol=${rol}` : ''}`),
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

export function useEliminarOperario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ eliminado: boolean }>(`/operarios/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operarios'] }),
  });
}
