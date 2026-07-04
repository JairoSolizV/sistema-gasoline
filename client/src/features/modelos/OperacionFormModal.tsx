import { useForm } from 'react-hook-form';
import { aCentavos, formatBs, type OperacionDTO, type OperacionInput } from '@taller/shared';
import { Modal } from '../../components/Modal';
import { ErrorApi } from '../../api/client';

// El form trabaja el CT en Bs (texto); se convierte a centavos UNA vez al enviar.
export const PATRON_BS = /^\d+(\.\d{1,2})?$/;

export interface OperacionFormValores {
  grupo: string;
  n: string;
  equipo: string;
  proceso: string;
  pieza: string;
  ctBs: string;
}

export function aOperacionInput(v: OperacionFormValores): OperacionInput {
  return {
    grupo: v.grupo.trim(),
    n: v.n.trim() === '' ? null : v.n.trim(),
    equipo: v.equipo.trim(),
    proceso: v.proceso.trim(),
    pieza: v.pieza.trim() === '' ? null : v.pieza.trim(),
    ct: aCentavos(v.ctBs),
  };
}

const claseInput =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/20';

export function OperacionFormModal({
  titulo,
  operacion,
  grupoSugerido,
  onGuardar,
  onCerrar,
  errorGuardar,
}: {
  titulo: string;
  operacion: OperacionDTO | null; // null = alta
  grupoSugerido?: string;
  onGuardar: (input: OperacionInput) => Promise<unknown>;
  onCerrar: () => void;
  errorGuardar: unknown;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OperacionFormValores>({
    defaultValues: operacion
      ? {
          grupo: operacion.grupo,
          n: operacion.n ?? '',
          equipo: operacion.equipo,
          proceso: operacion.proceso,
          pieza: operacion.pieza ?? '',
          ctBs: formatBs(operacion.ct).replace(/ /g, ''),
        }
      : { grupo: grupoSugerido ?? '', n: '', equipo: '', proceso: '', pieza: '', ctBs: '' },
  });

  const onSubmit = handleSubmit(async (valores) => {
    await onGuardar(aOperacionInput(valores));
    onCerrar();
  });

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-lg">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Grupo</label>
            <input
              {...register('grupo', { required: 'El grupo es obligatorio' })}
              placeholder="ej. TRASEROS"
              className={claseInput}
            />
            {errors.grupo && <p className="mt-1 text-xs text-error">{errors.grupo.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              N <span className="font-normal text-gray-400">(paso, opcional)</span>
            </label>
            <input {...register('n')} placeholder="ej. 7.1" className={claseInput} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Máquina</label>
            <input
              {...register('equipo', { required: 'La máquina es obligatoria' })}
              placeholder="ej. recta"
              className={claseInput}
            />
            {errors.equipo && <p className="mt-1 text-xs text-error">{errors.equipo.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Proceso</label>
            <input
              {...register('proceso', { required: 'El proceso es obligatorio' })}
              placeholder="ej. pinza"
              className={claseInput}
            />
            {errors.proceso && <p className="mt-1 text-xs text-error">{errors.proceso.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Pieza <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input {...register('pieza')} placeholder="ej. trasero" className={claseInput} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">CT — Bs por pieza</label>
            <input
              {...register('ctBs', {
                required: 'El CT es obligatorio',
                pattern: { value: PATRON_BS, message: 'Monto inválido (ej. 0.15)' },
                validate: (v) => aCentavos(v) >= 1 || 'Debe ser mayor a 0',
              })}
              placeholder="ej. 0.15"
              inputMode="decimal"
              className={`${claseInput} mono`}
            />
            {errors.ctBs && <p className="mt-1 text-xs text-error">{errors.ctBs.message}</p>}
          </div>
        </div>

        {errorGuardar != null && (
          <p className="rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
            {errorGuardar instanceof ErrorApi ? errorGuardar.message : 'Error al guardar'}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
          >
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
