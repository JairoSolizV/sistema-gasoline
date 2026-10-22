import { useForm } from 'react-hook-form';
import { aCentavos, formatBs, type OperacionDTO, type OperacionInput } from '@taller/shared';
import { Modal } from '../../components/Modal';
import { ErrorApi } from '../../api/client';
import { useSelectoresCatalogo } from './useSelectoresCatalogo';

// El form trabaja el CT en Bs (texto); se convierte a centavos UNA vez al enviar.
export const PATRON_BS = /^\d+(\.\d{1,2})?$/;

export interface OperacionFormValores {
  grupo: string;
  n: string;
  equipo: string;
  proceso: string;
  pieza: string;
  ctBs: string;
  esEmpaque: boolean; // operación de empaque: costo informado aparte (PLAN_AYUDANTES §2.10)
}

export function aOperacionInput(v: OperacionFormValores): OperacionInput {
  return {
    grupo: v.grupo.trim(),
    n: v.n.trim() === '' ? null : v.n.trim(),
    equipo: v.equipo.trim(),
    proceso: v.proceso.trim(),
    pieza: v.pieza.trim() === '' ? null : v.pieza.trim(),
    ct: aCentavos(v.ctBs),
    esEmpaque: v.esEmpaque,
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
  aviso,
}: {
  titulo: string;
  aviso?: React.ReactNode; // nota bajo el título (ej. "solo este corte")
  operacion: OperacionDTO | null; // null = alta
  grupoSugerido?: string;
  onGuardar: (input: OperacionInput) => Promise<unknown>;
  onCerrar: () => void;
  errorGuardar: unknown;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
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
          esEmpaque: operacion.esEmpaque,
        }
      : { grupo: grupoSugerido ?? '', n: '', equipo: '', proceso: '', pieza: '', ctBs: '', esEmpaque: false },
  });

  // Grupo, máquina, proceso y pieza salen del catálogo (cascada máquina →
  // proceso → pieza); N y CT se siguen escribiendo a mano.
  const actuales = watch();
  const selectores = useSelectoresCatalogo<OperacionFormValores>({
    register,
    setValue,
    valores: {
      grupo: actuales.grupo,
      equipo: actuales.equipo,
      proceso: actuales.proceso,
      pieza: actuales.pieza,
    },
  });

  const onSubmit = handleSubmit(async (valores) => {
    await onGuardar(aOperacionInput(valores));
    onCerrar();
  });

  return (
    <Modal onCerrar={onCerrar} ancho="max-w-lg">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {aviso && <p className="mt-1 text-sm text-gray-500">{aviso}</p>}
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Grupo</label>
            {selectores.grupo}
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
            {selectores.maquina}
            {errors.equipo && <p className="mt-1 text-xs text-error">{errors.equipo.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Proceso</label>
            {selectores.proceso}
            {errors.proceso && <p className="mt-1 text-xs text-error">{errors.proceso.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Pieza <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            {selectores.pieza}
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
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" {...register('esEmpaque')} className="mt-0.5" />
          <span>
            <span className="font-medium">Operación de empaque</span>
            <span className="block text-xs text-gray-500">
              Se paga por prenda igual que la costura, pero su costo se muestra aparte.
            </span>
          </span>
        </label>

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
