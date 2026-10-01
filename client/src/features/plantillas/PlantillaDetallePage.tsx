import { useEffect } from 'react';
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { aCentavos, formatBs } from '@taller/shared';
import { useGuardarOperacionesPlantilla, usePlantilla } from '../../api/plantillas';
import { ErrorApi } from '../../api/client';
import { PATRON_BS } from '../modelos/OperacionFormModal';
import { useSelectoresCatalogo } from '../modelos/useSelectoresCatalogo';

// Editor de una plantilla: la misma tabla que el alta de modelo, con un CT de
// REFERENCIA opcional por fila. La referencia solo precarga el alta de modelo;
// el CT que se paga es el que queda escrito en cada modelo.
// Se edita libremente y se guarda la lista completa de una vez.

interface FilaPlantilla {
  grupo: string;
  n: string;
  equipo: string;
  proceso: string;
  pieza: string;
  ctRefBs: string; // Bs como texto; '' = sin referencia
}

interface PlantillaValores {
  operaciones: FilaPlantilla[];
}

const FILA_VACIA: FilaPlantilla = {
  grupo: '',
  n: '',
  equipo: '',
  proceso: '',
  pieza: '',
  ctRefBs: '',
};

const claseInput =
  'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-acento';

function FilaOperacion({
  i,
  control,
  register,
  setValue,
  errores,
  onQuitar,
}: {
  i: number;
  control: Control<PlantillaValores>;
  register: UseFormRegister<PlantillaValores>;
  setValue: UseFormSetValue<PlantillaValores>;
  errores: FieldErrors<PlantillaValores>;
  onQuitar: () => void;
}) {
  const fila = useWatch({ control, name: `operaciones.${i}` });
  const selectores = useSelectoresCatalogo<PlantillaValores>({
    register,
    setValue,
    prefijo: `operaciones.${i}.`,
    valores: {
      grupo: fila?.grupo ?? '',
      equipo: fila?.equipo ?? '',
      proceso: fila?.proceso ?? '',
      pieza: fila?.pieza ?? '',
    },
    compacto: true,
  });

  return (
    <tr className="border-b border-gray-100 align-top last:border-0">
      <td className="px-4 py-2">{selectores.grupo}</td>
      <td className="px-2 py-2">
        <input {...register(`operaciones.${i}.n`)} placeholder="1" className={claseInput} />
      </td>
      <td className="px-2 py-2">{selectores.maquina}</td>
      <td className="px-2 py-2">{selectores.proceso}</td>
      <td className="px-2 py-2">{selectores.pieza}</td>
      <td className="px-2 py-2">
        <input
          {...register(`operaciones.${i}.ctRefBs`, {
            // opcional: vacía = sin referencia
            validate: (v) =>
              v.trim() === '' ||
              (PATRON_BS.test(v.trim()) && aCentavos(v.trim()) >= 1) ||
              'ej. 0.15',
          })}
          placeholder="—"
          inputMode="decimal"
          className={`${claseInput} mono`}
        />
        {errores.operaciones?.[i]?.ctRefBs && (
          <p className="mt-0.5 text-[11px] text-error">
            {errores.operaciones[i]?.ctRefBs?.message}
          </p>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        <button
          type="button"
          onClick={onQuitar}
          title="Quitar fila"
          className="text-gray-400 hover:text-error"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

export function PlantillaDetallePage() {
  const { plantillaId } = useParams();
  const navigate = useNavigate();
  const { data: plantilla, isLoading } = usePlantilla(plantillaId);
  const guardar = useGuardarOperacionesPlantilla();

  const { control, register, setValue, handleSubmit, reset, watch, formState } =
    useForm<PlantillaValores>({ defaultValues: { operaciones: [] } });
  const { fields, append, remove } = useFieldArray({ control, name: 'operaciones' });

  // al llegar el detalle, se vuelca a la tabla
  useEffect(() => {
    if (!plantilla) return;
    reset({
      operaciones: plantilla.operaciones.map((o) => ({
        grupo: o.grupo,
        n: o.n ?? '',
        equipo: o.equipo,
        proceso: o.proceso,
        pieza: o.pieza ?? '',
        ctRefBs: o.ctReferencia == null ? '' : formatBs(o.ctReferencia),
      })),
    });
  }, [plantilla, reset]);

  // suma en vivo de las referencias, solo como feedback
  const filas = watch('operaciones');
  const conReferencia = filas.filter((o) => PATRON_BS.test(o.ctRefBs.trim()));
  const totalReferencia = conReferencia.reduce((acc, o) => acc + aCentavos(o.ctRefBs.trim()), 0);

  const onSubmit = handleSubmit(async (valores) => {
    await guardar.mutateAsync({
      id: plantillaId!,
      operaciones: valores.operaciones.map((o) => ({
        grupo: o.grupo.trim(),
        n: o.n.trim() === '' ? null : o.n.trim(),
        equipo: o.equipo.trim(),
        proceso: o.proceso.trim(),
        pieza: o.pieza.trim() === '' ? null : o.pieza.trim(),
        ctReferencia: o.ctRefBs.trim() === '' ? null : aCentavos(o.ctRefBs.trim()),
      })),
    });
  });

  if (isLoading || !plantilla) return <div className="p-8 text-sm text-gray-500">Cargando…</div>;

  return (
    <div className="p-8">
      <div className="text-xs text-gray-500">
        <Link to="/plantillas" className="hover:underline">
          Plantillas
        </Link>{' '}
        / {plantilla.nombre}
      </div>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            {plantilla.nombre}
            {plantilla.protegida && (
              <span
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gray-500 uppercase"
                title="Se puede editar, no eliminar"
              >
                fija
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {fields.length} operaciones · el CT de referencia precarga el modelo nuevo y ahí se
            puede cambiar
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-right shadow-sm">
            <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
              Referencia / prenda
            </div>
            <div className="mono text-2xl font-semibold">Bs {formatBs(totalReferencia)}</div>
            {conReferencia.length < filas.length && (
              <div className="text-[11px] text-gray-500">
                {filas.length - conReferencia.length} sin referencia
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(`/modelos/nuevo?plantilla=${plantilla.id}`)}
            className="rounded-lg bg-acento px-5 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]"
          >
            Crear modelo con esta plantilla
          </button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
            <span className="text-sm font-semibold">Operaciones</span>
            <span className="text-[11px] text-gray-500">
              Todo sale del{' '}
              <Link to="/catalogo" className="text-acento hover:underline">
                catálogo
              </Link>
              : escribí para buscar
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                <th className="px-4 py-2">Grupo</th>
                <th className="w-20 px-2 py-2">N</th>
                <th className="px-2 py-2">Máquina</th>
                <th className="px-2 py-2">Proceso</th>
                <th className="px-2 py-2">Pieza</th>
                <th className="w-28 px-2 py-2" title="Precio sugerido; se confirma al crear el modelo">
                  CT ref. (Bs)
                </th>
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {fields.map((campo, i) => (
                <FilaOperacion
                  key={campo.id}
                  i={i}
                  control={control}
                  register={register}
                  setValue={setValue}
                  errores={formState.errors}
                  onQuitar={() => remove(i)}
                />
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-100 px-4 py-2">
            <button
              type="button"
              onClick={() => {
                const anterior = fields.length > 0 ? fields[fields.length - 1] : null;
                append({ ...FILA_VACIA, grupo: anterior?.grupo ?? '' });
              }}
              className="text-[13px] font-medium text-acento hover:underline"
            >
              + Agregar operación
            </button>
          </div>
        </div>

        {guardar.error != null && (
          <p className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
            {guardar.error instanceof ErrorApi ? guardar.error.message : 'Error al guardar'}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          {guardar.isSuccess && !formState.isDirty && (
            <span className="text-sm text-gray-500">Cambios guardados</span>
          )}
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="rounded-lg bg-acento px-5 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
          >
            Guardar plantilla
          </button>
        </div>
      </form>
    </div>
  );
}
