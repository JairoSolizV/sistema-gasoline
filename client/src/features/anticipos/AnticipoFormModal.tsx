import { useForm } from 'react-hook-form';
import {
  aCentavos,
  formatBs,
  type AnticipoDTO,
  type OperarioDTO,
} from '@taller/shared';
import { Modal } from '../../components/Modal';
import { ErrorApi } from '../../api/client';
import { useCrearAnticipo, useEditarAnticipo } from '../../api/anticipos';

const PATRON_BS = /^\d+(\.\d{1,2})?$/;

interface FormValores {
  operarioId: string;
  fecha: string; // yyyy-mm-dd
  montoBs: string;
  nota: string;
}

const claseInput =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/20';

export function AnticipoFormModal({
  anticipo,
  operarios,
  onCerrar,
}: {
  anticipo: AnticipoDTO | null; // null = alta
  operarios: OperarioDTO[];
  onCerrar: () => void;
}) {
  const crear = useCrearAnticipo();
  const editar = useEditarAnticipo();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValores>({
    defaultValues: anticipo
      ? {
          operarioId: anticipo.operarioId,
          fecha: anticipo.fecha.slice(0, 10),
          montoBs: formatBs(anticipo.monto).replace(/ /g, ''),
          nota: anticipo.nota ?? '',
        }
      : {
          operarioId: '',
          fecha: new Date().toISOString().slice(0, 10),
          montoBs: '',
          nota: '',
        },
  });

  const montoBs = watch('montoBs');
  const mutacion = anticipo ? editar : crear;
  // advertencia en vivo con el tope por defecto del sistema (2000); el server confirma
  const advertenciaVivo = PATRON_BS.test(montoBs) && aCentavos(montoBs) > 200000;

  const onSubmit = handleSubmit(async (v) => {
    if (anticipo) {
      await editar.mutateAsync({
        id: anticipo.id,
        cambios: { fecha: new Date(`${v.fecha}T12:00:00`), monto: aCentavos(v.montoBs), nota: v.nota },
      });
    } else {
      await crear.mutateAsync({
        operarioId: v.operarioId,
        fecha: new Date(`${v.fecha}T12:00:00`),
        monto: aCentavos(v.montoBs),
        nota: v.nota,
      });
    }
    onCerrar();
  });

  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">{anticipo ? 'Editar anticipo' : 'Registrar anticipo'}</h2>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        {!anticipo && (
          <div>
            <label className="mb-1 block text-sm font-medium">Operario</label>
            <select
              {...register('operarioId', { required: 'Elegí un operario' })}
              className={claseInput}
            >
              <option value="">Elegir operario…</option>
              {operarios
                .filter((o) => o.activo)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
            </select>
            {errors.operarioId && (
              <p className="mt-1 text-xs text-error">{errors.operarioId.message}</p>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Fecha</label>
            <input type="date" {...register('fecha', { required: true })} className={claseInput} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Monto (Bs)</label>
            <input
              {...register('montoBs', {
                required: 'El monto es obligatorio',
                pattern: { value: PATRON_BS, message: 'Monto inválido (ej. 500.00)' },
                validate: (v) => aCentavos(v) >= 1 || 'Debe ser mayor a 0',
              })}
              placeholder="ej. 500"
              inputMode="decimal"
              className={`${claseInput} mono`}
            />
            {errors.montoBs && <p className="mt-1 text-xs text-error">{errors.montoBs.message}</p>}
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Nota <span className="font-normal text-gray-400">(opcional)</span>
          </label>
          <input {...register('nota')} placeholder='ej. "emergencia"' className={claseInput} />
        </div>

        {advertenciaVivo && (
          <p className="rounded-lg border border-[#eeddb8] bg-[#fbf3e3] px-3 py-2 text-xs text-[#9a6a12]">
            ⚠ Supera el tope de referencia (Bs 2 000.00). Se puede guardar igual — es solo una
            advertencia.
          </p>
        )}
        {mutacion.error != null && (
          <p className="rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
            {mutacion.error instanceof ErrorApi ? mutacion.error.message : 'Error al guardar'}
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
            {anticipo ? 'Guardar cambios' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
