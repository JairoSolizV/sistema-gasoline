import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RegistrarAsistenciaInput, SemanaAsistenciaDTO } from '@taller/shared';
import { api } from './client';

// Asistencia diaria de los ayudantes. Toda escritura devuelve la semana
// actualizada: se escribe directo al caché de esa semana.

export function useSemanaAsistencia(lunes: string) {
  return useQuery({
    queryKey: ['asistencia', lunes],
    queryFn: () => api<SemanaAsistenciaDTO>(`/asistencia/semana?lunes=${lunes}`),
  });
}

function usarSemanaActualizada() {
  const qc = useQueryClient();
  return (s: SemanaAsistenciaDTO) => {
    qc.setQueryData(['asistencia', s.lunes], s);
    qc.invalidateQueries({ queryKey: ['operarios'] }); // historial (no se puede eliminar)
  };
}

export function useRegistrarAsistencia() {
  const aplicar = usarSemanaActualizada();
  return useMutation({
    mutationFn: (input: RegistrarAsistenciaInput) =>
      api<SemanaAsistenciaDTO>('/asistencia', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: aplicar,
  });
}

export function useDesmarcarAsistencia() {
  const aplicar = usarSemanaActualizada();
  return useMutation({
    mutationFn: ({ operarioId, fecha }: { operarioId: string; fecha: string }) =>
      api<SemanaAsistenciaDTO>(`/asistencia?operarioId=${operarioId}&fecha=${fecha}`, {
        method: 'DELETE',
      }),
    onSuccess: aplicar,
  });
}

export function useMarcarPresentes() {
  const aplicar = usarSemanaActualizada();
  return useMutation({
    mutationFn: (fecha: string) =>
      api<SemanaAsistenciaDTO>('/asistencia/presentes', {
        method: 'POST',
        body: JSON.stringify({ fecha }),
      }),
    onSuccess: aplicar,
  });
}
