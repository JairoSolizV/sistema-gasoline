import { useEffect, useState, type HTMLAttributes } from 'react';
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import {
  aCentavos,
  formatBs,
  formatDuracion,
  type CatalogoArbolDTO,
  type ModeloVersionDetalleDTO,
} from '@taller/shared';
import { useBloqueGrupo, useCatalogo, useGuardarBloqueGrupo } from '../../api/catalogo';
import { api, ErrorApi } from '../../api/client';
import { useModelos } from '../../api/modelos';
import { claseIndicador, useArrastrarOrden } from '../../lib/useArrastrarOrden';
import { tiempoDesdeCatalogo } from '../../lib/tiempoCatalogo';
import { PATRON_BS } from '../modelos/OperacionFormModal';
import { useSelectoresCatalogo } from '../modelos/useSelectoresCatalogo';

// Bloque reutilizable de un grupo (ej. ACABADO): su lista estándar de
// operaciones. Al crear o editar un modelo se agrega entera de una vez y ahí se
// ajusta. Como en las plantillas, el CT es solo una REFERENCIA; el que se paga
// es el que queda escrito en el modelo. Se edita libre y se guarda la lista
// completa de una vez.

interface FilaBloque {
  grupo: string; // fijo (el del bloque); lo exige el selector de catálogo
  n: string;
  equipo: string;
  proceso: string;
  pieza: string;
  ctRefBs: string; // '' = sin referencia
  esEmpaque: boolean; // pasa al modelo al agregar el bloque
}

interface BloqueValores {
  operaciones: FilaBloque[];
}

const claseInput =
  'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-acento';

function FilaOperacion({
  i,
  control,
  register,
  setValue,
  errores,
  arbol,
  onQuitar,
  manija,
  fila,
  clase,
}: {
  i: number;
  control: Control<BloqueValores>;
  register: UseFormRegister<BloqueValores>;
  setValue: UseFormSetValue<BloqueValores>;
  errores: FieldErrors<BloqueValores>;
  arbol: CatalogoArbolDTO | undefined;
  onQuitar: () => void;
  manija: HTMLAttributes<HTMLElement>;
  fila: HTMLAttributes<HTMLTableRowElement>;
  clase: string;
}) {
  const valores = useWatch({ control, name: `operaciones.${i}` });
  const selectores = useSelectoresCatalogo<BloqueValores>({
    register,
    setValue,
    prefijo: `operaciones.${i}.`,
    valores: {
      grupo: valores?.grupo ?? '',
      equipo: valores?.equipo ?? '',
      proceso: valores?.proceso ?? '',
      pieza: valores?.pieza ?? '',
    },
    compacto: true,
  });
  const tiempo = tiempoDesdeCatalogo(arbol, valores?.equipo ?? '', valores?.proceso ?? '', valores?.pieza);

  return (
    <tr {...fila} className={`border-b border-gray-100 align-top last:border-0 ${clase}`}>
      <td
        {...manija}
        className="w-6 cursor-grab pt-3 pl-3 text-gray-300 select-none hover:text-gray-500 active:cursor-grabbing"
      >
        ⠿
      </td>
      <td className="w-16 px-2 py-2">
        <input {...register(`operaciones.${i}.n`)} placeholder="1" className={claseInput} />
      </td>
      <td className="px-2 py-2">{selectores.maquina}</td>
      <td className="px-2 py-2">{selectores.proceso}</td>
      <td className="px-2 py-2">{selectores.pieza}</td>
      <td className="w-24 px-2 py-2">
        <input
          {...register(`operaciones.${i}.ctRefBs`, {
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
          <p className="mt-0.5 text-[11px] text-error">{errores.operaciones[i]?.ctRefBs?.message}</p>
        )}
      </td>
      <td
        className="mono w-16 px-2 pt-3.5 text-right text-xs text-gray-500"
        title="Tiempo del catálogo (segundos por prenda)"
      >
        {tiempo == null ? '—' : `${tiempo} s`}
      </td>
      <td className="w-12 px-2 pt-3 text-center">
        <input type="checkbox" {...register(`operaciones.${i}.esEmpaque`)} title="Operación de empaque" />
      </td>
      <td className="w-10 px-2 pt-3 text-center">
        <button type="button" onClick={onQuitar} title="Quitar" className="text-gray-400 hover:text-error">
          ✕
        </button>
      </td>
    </tr>
  );
}

const igual = (a: string, b: string) => a.toLocaleUpperCase('es') === b.toLocaleUpperCase('es');

export function EditorBloqueGrupo({ grupoId, onCerrar }: { grupoId: string; onCerrar: () => void }) {
  const { data: bloque, isLoading } = useBloqueGrupo(grupoId);
  const { data: arbol } = useCatalogo(true);
  const { data: modelos } = useModelos();
  const guardar = useGuardarBloqueGrupo();
  const [aviso, setAviso] = useState<string | null>(null);

  const { control, register, setValue, handleSubmit, reset, getValues, watch, formState } =
    useForm<BloqueValores>({ defaultValues: { operaciones: [] } });
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'operaciones' });

  const nombreGrupo = bloque?.grupo.nombre ?? '';

  useEffect(() => {
    if (!bloque) return;
    reset({
      operaciones: bloque.operaciones.map((o) => ({
        grupo: bloque.grupo.nombre,
        n: o.n ?? '',
        equipo: o.equipo,
        proceso: o.proceso,
        pieza: o.pieza ?? '',
        ctRefBs: o.ctReferencia == null ? '' : formatBs(o.ctReferencia),
        esEmpaque: o.esEmpaque,
      })),
    });
  }, [bloque, reset]);

  // arrastrar para reordenar: se reconstruye la lista en el nuevo orden
  const { arrastrado, manija, fila, indicador } = useArrastrarOrden(
    fields.map((f) => f.id),
    (nuevo) => {
      const valores = getValues('operaciones');
      const porId = new Map(fields.map((f, i) => [f.id, valores[i]]));
      replace(nuevo.map((id) => porId.get(id)!));
    },
  );

  /** Trae las operaciones de este grupo desde un modelo ya cargado (para no
   *  tipear de nuevo lo que ya existe). Se agregan al final del bloque. */
  const copiarDeVersion = async (versionId: string) => {
    setAviso(null);
    const version = await api<ModeloVersionDetalleDTO>(`/versiones/${versionId}`);
    const ops = version.operaciones.filter((o) => igual(o.grupo, nombreGrupo));
    if (ops.length === 0) {
      setAviso(`${version.modeloNombre} v${version.numeroVersion} no tiene operaciones en ${nombreGrupo}`);
      return;
    }
    append(
      ops.map((o) => ({
        grupo: nombreGrupo,
        n: o.n ?? '',
        equipo: o.equipo,
        proceso: o.proceso,
        pieza: o.pieza ?? '',
        ctRefBs: formatBs(o.ct),
        esEmpaque: o.esEmpaque,
      })),
    );
    setAviso(
      `Se copiaron ${ops.length} operaciones de ${version.modeloNombre} v${version.numeroVersion} (con su CT como referencia). Revisá y guardá.`,
    );
  };

  const onSubmit = handleSubmit(async (valores) => {
    setAviso(null);
    await guardar.mutateAsync({
      grupoId,
      operaciones: valores.operaciones.map((o) => ({
        n: o.n.trim() === '' ? null : o.n.trim(),
        equipo: o.equipo.trim(),
        proceso: o.proceso.trim(),
        pieza: o.pieza.trim() === '' ? null : o.pieza.trim(),
        ctReferencia: o.ctRefBs.trim() === '' ? null : aCentavos(o.ctRefBs.trim()),
        esEmpaque: o.esEmpaque,
      })),
    });
  });

  // resumen en vivo: Σ CT de referencia y Σ tiempo por prenda del bloque
  const filas = watch('operaciones');
  const totalCt = filas.reduce(
    (a, o) => (PATRON_BS.test(o.ctRefBs.trim()) ? a + aCentavos(o.ctRefBs.trim()) : a),
    0,
  );
  const tiempos = filas.map((o) => tiempoDesdeCatalogo(arbol, o.equipo, o.proceso, o.pieza));
  const totalTiempo = tiempos.reduce<number>((a, t) => a + (t ?? 0), 0);
  const sinTiempo = tiempos.filter((t) => t == null).length;

  return (
    <form
      onSubmit={onSubmit}
      className="overflow-hidden rounded-xl border-2 border-acento/40 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-acento/5 px-4 py-2.5">
        <div>
          <span className="text-sm font-semibold">Bloque de {nombreGrupo || '…'}</span>
          <span className="ml-2 text-[11px] text-gray-500">
            operaciones estándar del grupo · se agregan de una vez al crear o editar un modelo
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>
            Σ CT ref. <span className="mono font-semibold">Bs {formatBs(totalCt)}</span>
          </span>
          <span title={sinTiempo > 0 ? `${sinTiempo} operación(es) sin tiempo en el catálogo` : ''}>
            Σ tiempo <span className="mono font-semibold">{formatDuracion(totalTiempo)}</span>/prenda
            {sinTiempo > 0 && <span className="text-amber-700"> ({sinTiempo} sin tiempo)</span>}
          </span>
          <button type="button" onClick={onCerrar} className="text-gray-400 hover:text-gray-700" title="Cerrar">
            ✕
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="px-4 py-6 text-sm text-gray-500">Cargando bloque…</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                <th className="w-6" />
                <th className="px-2 py-2">N</th>
                <th className="px-2 py-2">Máquina</th>
                <th className="px-2 py-2">Proceso</th>
                <th className="px-2 py-2">Pieza</th>
                <th className="px-2 py-2" title="Precio sugerido; se confirma en el modelo">
                  CT ref. (Bs)
                </th>
                <th className="px-2 py-2 text-right" title="Segundos por prenda, del catálogo">
                  Tiempo
                </th>
                <th className="px-2 py-2 text-center" title="Operación de empaque: costo aparte de la costura">
                  Emp.
                </th>
                <th />
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
                  arbol={arbol}
                  onQuitar={() => remove(i)}
                  manija={manija(campo.id)}
                  fila={fila(campo.id)}
                  clase={`${arrastrado === campo.id ? 'opacity-40' : ''} ${claseIndicador(indicador(campo.id))}`}
                />
              ))}
              {fields.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-5 text-center text-sm text-gray-400">
                    Este grupo todavía no tiene bloque. Agregá operaciones o copialas de un modelo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-2">
            <button
              type="button"
              onClick={() =>
                append({ grupo: nombreGrupo, n: '', equipo: '', proceso: '', pieza: '', ctRefBs: '', esEmpaque: false })
              }
              className="text-[13px] font-medium text-acento hover:underline"
            >
              + Agregar operación
            </button>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) void copiarDeVersion(e.target.value);
              }}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs outline-none focus:border-acento"
            >
              <option value="">Copiar las de {nombreGrupo} desde un modelo…</option>
              {(modelos ?? []).flatMap((m) =>
                m.versiones.map((v) => (
                  <option key={v.id} value={v.id}>
                    {m.nombre} v{v.numeroVersion}
                  </option>
                )),
              )}
            </select>
            <div className="ml-auto flex items-center gap-3">
              {formState.isDirty && <span className="text-xs text-amber-700">Cambios sin guardar</span>}
              {guardar.isSuccess && !formState.isDirty && (
                <span className="text-xs text-gray-500">Bloque guardado</span>
              )}
              <button
                type="submit"
                disabled={formState.isSubmitting}
                className="rounded-lg bg-acento px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
              >
                Guardar bloque
              </button>
            </div>
          </div>
          {(aviso || guardar.error != null) && (
            <p
              className={`mx-4 mb-3 rounded-lg px-3 py-2 text-xs ${
                guardar.error != null ? 'bg-error-suave text-error' : 'bg-gray-50 text-gray-600'
              }`}
            >
              {guardar.error != null
                ? guardar.error instanceof ErrorApi
                  ? guardar.error.message
                  : 'Error al guardar el bloque'
                : aviso}
            </p>
          )}
        </>
      )}
    </form>
  );
}
