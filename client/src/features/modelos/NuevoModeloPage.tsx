import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { aCentavos, formatBs } from '@taller/shared';
import { useCrearModelo } from '../../api/modelos';
import { ErrorApi } from '../../api/client';
import { aOperacionInput, PATRON_BS, type OperacionFormValores } from './OperacionFormModal';

interface NuevoModeloValores {
  nombre: string;
  operaciones: OperacionFormValores[];
}

const OP_VACIA: OperacionFormValores = { grupo: '', n: '', equipo: '', proceso: '', pieza: '', ctBs: '' };

const claseInput =
  'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-acento';

export function NuevoModeloPage() {
  const navigate = useNavigate();
  const crear = useCrearModelo();
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<NuevoModeloValores>({
    defaultValues: { nombre: '', operaciones: [{ ...OP_VACIA }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'operaciones' });

  // suma en vivo SOLO como feedback visual; el costo que vale lo calcula el server
  const operacionesActuales = watch('operaciones');
  const totalVivo = operacionesActuales.reduce(
    (acc, o) => (PATRON_BS.test(o.ctBs) ? acc + aCentavos(o.ctBs) : acc),
    0,
  );

  const onSubmit = handleSubmit(async (valores) => {
    const detalle = await crear.mutateAsync({
      nombre: valores.nombre.trim(),
      operaciones: valores.operaciones.map(aOperacionInput),
    });
    navigate(`/modelos/versiones/${detalle.id}`);
  });

  return (
    <div className="p-8">
      <div className="text-xs text-gray-500">
        <Link to="/modelos" className="hover:underline">
          Modelos
        </Link>{' '}
        / Nuevo modelo
      </div>
      <div className="mt-2 flex items-start justify-between">
        <h1 className="text-2xl font-semibold">Nuevo modelo</h1>
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-right shadow-sm">
          <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            Mano de obra / prenda
          </div>
          <div className="mono text-2xl font-semibold">Bs {formatBs(totalVivo)}</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="mb-1 block text-sm font-medium">Nombre del modelo</label>
          <input
            {...register('nombre', { required: 'El nombre es obligatorio' })}
            placeholder="ej. black DOBLE PRET 06"
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/20"
          />
          {errors.nombre && <p className="mt-1 text-xs text-error">{errors.nombre.message}</p>}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-semibold">
            Operaciones (v1)
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                <th className="px-4 py-2">Grupo</th>
                <th className="w-20 px-2 py-2">N</th>
                <th className="px-2 py-2">Máquina</th>
                <th className="px-2 py-2">Proceso</th>
                <th className="px-2 py-2">Pieza</th>
                <th className="w-28 px-2 py-2">CT (Bs)</th>
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {fields.map((campo, i) => (
                <tr key={campo.id} className="border-b border-gray-100 align-top last:border-0">
                  <td className="px-4 py-2">
                    <input
                      {...register(`operaciones.${i}.grupo`, { required: 'obligatorio' })}
                      placeholder="TRASEROS"
                      className={claseInput}
                    />
                    {errors.operaciones?.[i]?.grupo && (
                      <p className="mt-0.5 text-[11px] text-error">
                        {errors.operaciones[i]?.grupo?.message}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input {...register(`operaciones.${i}.n`)} placeholder="1" className={claseInput} />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      {...register(`operaciones.${i}.equipo`, { required: 'obligatorio' })}
                      placeholder="recta"
                      className={claseInput}
                    />
                    {errors.operaciones?.[i]?.equipo && (
                      <p className="mt-0.5 text-[11px] text-error">
                        {errors.operaciones[i]?.equipo?.message}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      {...register(`operaciones.${i}.proceso`, { required: 'obligatorio' })}
                      placeholder="pinza"
                      className={claseInput}
                    />
                    {errors.operaciones?.[i]?.proceso && (
                      <p className="mt-0.5 text-[11px] text-error">
                        {errors.operaciones[i]?.proceso?.message}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input {...register(`operaciones.${i}.pieza`)} placeholder="trasero" className={claseInput} />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      {...register(`operaciones.${i}.ctBs`, {
                        required: 'obligatorio',
                        pattern: { value: PATRON_BS, message: 'ej. 0.15' },
                        validate: (v) => !PATRON_BS.test(v) || aCentavos(v) >= 1 || 'mayor a 0',
                      })}
                      placeholder="0.15"
                      inputMode="decimal"
                      className={`${claseInput} mono`}
                    />
                    {errors.operaciones?.[i]?.ctBs && (
                      <p className="mt-0.5 text-[11px] text-error">
                        {errors.operaciones[i]?.ctBs?.message}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      disabled={fields.length === 1}
                      title="Quitar fila"
                      className="text-gray-400 hover:text-error disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 px-4 py-2">
            <button
              type="button"
              onClick={() => {
                const anterior = operacionesActuales[operacionesActuales.length - 1];
                append({ ...OP_VACIA, grupo: anterior?.grupo ?? '' });
              }}
              className="text-[13px] font-medium text-acento hover:underline"
            >
              + Agregar operación
            </button>
          </div>
        </div>

        {crear.error != null && (
          <p className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
            {crear.error instanceof ErrorApi ? crear.error.message : 'Error al crear el modelo'}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate('/modelos')}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-acento px-5 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
          >
            Crear modelo (v1)
          </button>
        </div>
      </form>
    </div>
  );
}
