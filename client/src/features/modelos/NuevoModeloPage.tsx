import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { aCentavos, formatBs } from '@taller/shared';
import { useCrearModelo } from '../../api/modelos';
import { usePlantilla, usePlantillas } from '../../api/plantillas';
import { useOperarios } from '../../api/operarios';
import { useConfiguracion } from '../../api/configuracion';
import { ErrorApi } from '../../api/client';
import {
  CamposBuscador,
  CamposMolde,
  datosBuscador,
  moldeVacio,
  validarMolde,
  type BuscadorForm,
  type MoldeForm,
} from './CamposDiseno';
import { aOperacionInput, PATRON_BS, type OperacionFormValores } from './OperacionFormModal';
import { useSelectoresCatalogo } from './useSelectoresCatalogo';

/** ctRefBs: el CT de referencia que trajo la plantilla ('' = ninguno). No se
 *  envía; solo sirve para mostrar la sugerencia si el dueño cambia el CT. */
type FilaNuevoModelo = OperacionFormValores & { ctRefBs: string };

interface NuevoModeloValores {
  nombre: string;
  operaciones: FilaNuevoModelo[];
}

const OP_VACIA: FilaNuevoModelo = {
  grupo: '',
  n: '',
  equipo: '',
  proceso: '',
  pieza: '',
  ctBs: '',
  ctRefBs: '',
};

const claseInput =
  'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-acento';

/** Una fila = un componente, para que cada una resuelva su propia cascada
 *  máquina → proceso → pieza sin recalcular las demás. */
function FilaOperacion({
  i,
  control,
  register,
  setValue,
  errores,
  onQuitar,
  puedeQuitar,
}: {
  i: number;
  control: Control<NuevoModeloValores>;
  register: UseFormRegister<NuevoModeloValores>;
  setValue: UseFormSetValue<NuevoModeloValores>;
  errores: FieldErrors<NuevoModeloValores>;
  onQuitar: () => void;
  puedeQuitar: boolean;
}) {
  const fila = useWatch({ control, name: `operaciones.${i}` });
  const selectores = useSelectoresCatalogo<NuevoModeloValores>({
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

  // la referencia se muestra solo si el CT escrito ya no coincide con ella
  const ref = fila?.ctRefBs ?? '';
  const ctActual = (fila?.ctBs ?? '').trim();
  const difiereDeRef =
    ref !== '' && !(PATRON_BS.test(ctActual) && aCentavos(ctActual) === aCentavos(ref));

  const errorDe = (campo: keyof OperacionFormValores) => errores.operaciones?.[i]?.[campo]?.message;
  const Error = ({ campo }: { campo: keyof OperacionFormValores }) =>
    errorDe(campo) ? <p className="mt-0.5 text-[11px] text-error">{errorDe(campo)}</p> : null;

  return (
    <tr className="border-b border-gray-100 align-top last:border-0">
      <td className="px-4 py-2">
        {selectores.grupo}
        <Error campo="grupo" />
      </td>
      <td className="px-2 py-2">
        <input {...register(`operaciones.${i}.n`)} placeholder="1" className={claseInput} />
      </td>
      <td className="px-2 py-2">
        {selectores.maquina}
        <Error campo="equipo" />
      </td>
      <td className="px-2 py-2">
        {selectores.proceso}
        <Error campo="proceso" />
      </td>
      <td className="px-2 py-2">{selectores.pieza}</td>
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
        <Error campo="ctBs" />
        {difiereDeRef && (
          <button
            type="button"
            onClick={() => setValue(`operaciones.${i}.ctBs`, ref, { shouldValidate: true })}
            title="Volver al CT de referencia de la plantilla"
            className="mono mt-0.5 text-[11px] text-gray-500 hover:text-acento hover:underline"
          >
            ref. {ref}
          </button>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        <button
          type="button"
          onClick={onQuitar}
          disabled={!puedeQuitar}
          title="Quitar fila"
          className="text-gray-400 hover:text-error disabled:opacity-30"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

export function NuevoModeloPage() {
  const navigate = useNavigate();
  const crear = useCrearModelo();
  const [parametros, setParametros] = useSearchParams();

  // Se puede llegar con ?plantilla=<id> (desde la pantalla de plantillas) o
  // elegirla acá. La plantilla solo PRECARGA las filas y los CT de referencia:
  // acá se confirman o se cambian, y el modelo queda independiente de ella.
  const plantillaId = parametros.get('plantilla') ?? '';
  const { data: plantillas } = usePlantillas();
  const { data: plantilla } = usePlantilla(plantillaId || undefined);
  const [plantillaCargada, setPlantillaCargada] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NuevoModeloValores>({
    defaultValues: { nombre: '', operaciones: [{ ...OP_VACIA }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'operaciones' });

  // Al elegir una plantilla se vuelcan sus operaciones con el CT de referencia
  // ya escrito (vacío donde la plantilla no tiene referencia).
  useEffect(() => {
    if (!plantilla || plantillaCargada === plantilla.id) return;
    reset({
      nombre: watch('nombre'),
      operaciones: plantilla.operaciones.map((o) => ({
        grupo: o.grupo,
        n: o.n ?? '',
        equipo: o.equipo,
        proceso: o.proceso,
        pieza: o.pieza ?? '',
        ctBs: o.ctReferencia == null ? '' : formatBs(o.ctReferencia),
        ctRefBs: o.ctReferencia == null ? '' : formatBs(o.ctReferencia),
      })),
    });
    setPlantillaCargada(plantilla.id);
  }, [plantilla, plantillaCargada, reset, watch]);

  // suma en vivo SOLO como feedback visual; el costo que vale lo calcula el server
  const operacionesActuales = watch('operaciones');
  const totalVivo = operacionesActuales.reduce(
    (acc, o) => (PATRON_BS.test(o.ctBs) ? acc + aCentavos(o.ctBs) : acc),
    0,
  );

  // Diseño: buscador del modelo y moldes de la v1 (Bs 200 de Configuración, editable)
  const { data: config } = useConfiguracion();
  const { data: buscadores } = useOperarios('activos', 'buscador');
  const { data: moldistas } = useOperarios('activos', 'moldista');
  const [buscador, setBuscador] = useState<BuscadorForm>({ modo: 'pendiente', buscadorId: '' });
  const [molde, setMolde] = useState<MoldeForm>(() => moldeVacio(undefined));
  const [errorDiseno, setErrorDiseno] = useState<string | null>(null);
  useEffect(() => {
    // el monto predeterminado llega con la configuración
    if (config && molde.montoBs === '') setMolde(moldeVacio(config.tarifaMoldeNuevo));
  }, [config, molde.montoBs]);

  const onSubmit = handleSubmit(async (valores) => {
    setErrorDiseno(null);
    const b = datosBuscador(buscador);
    if (!b) return setErrorDiseno('Elegí quién buscó el modelo');
    const m = validarMolde(molde);
    if (!m.ok) return setErrorDiseno(m.error);
    const detalle = await crear.mutateAsync({
      nombre: valores.nombre.trim(),
      operaciones: valores.operaciones.map(aOperacionInput),
      ...b,
      molde: m.datos,
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
        <div className="flex flex-wrap items-start gap-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="min-w-[18rem] flex-1">
            <label className="mb-1 block text-sm font-medium">Nombre del modelo</label>
            <input
              {...register('nombre', { required: 'El nombre es obligatorio' })}
              placeholder="ej. black DOBLE PRET 06"
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento focus:ring-2 focus:ring-acento/20"
            />
            {errors.nombre && <p className="mt-1 text-xs text-error">{errors.nombre.message}</p>}
          </div>

          <div className="min-w-[16rem]">
            <label className="mb-1 block text-sm font-medium">
              Partir de una{' '}
              <Link to="/plantillas" className="text-acento hover:underline">
                plantilla
              </Link>
            </label>
            <select
              value={plantillaId}
              onChange={(e) => {
                const valor = e.target.value;
                setPlantillaCargada(null);
                if (valor === '') {
                  setParametros({});
                  reset({ nombre: watch('nombre'), operaciones: [{ ...OP_VACIA }] });
                } else {
                  setParametros({ plantilla: valor });
                }
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-acento"
            >
              <option value="">Empezar de cero</option>
              {(plantillas ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} ({p.cantidadOperaciones} operaciones)
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-gray-500">
              Trae las operaciones en orden con su CT de referencia; podés cambiar cualquiera.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
            <span className="text-sm font-semibold">Operaciones (v1)</span>
            <span className="text-[11px] text-gray-500">
              El grupo agrupa las operaciones; máquina → proceso → pieza van en cascada. Todo sale
              del{' '}
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
                <th className="w-28 px-2 py-2">CT (Bs)</th>
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
                  errores={errors}
                  onQuitar={() => remove(i)}
                  puedeQuitar={fields.length > 1}
                />
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

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
            <span className="text-sm font-semibold">Diseño del modelo</span>
            <span className="text-[11px] text-gray-500">servicio de corte interno · se paga</span>
          </div>
          <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-sm font-medium">Búsqueda del modelo</div>
              <CamposBuscador valor={buscador} onChange={setBuscador} buscadores={buscadores} />
            </div>
            <div>
              <div className="mb-2 text-sm font-medium">Moldes / patronaje</div>
              <CamposMolde
                valor={molde}
                onChange={setMolde}
                moldistas={moldistas}
                etiqueta="Los moldes se hicieron en el taller"
                ayuda={`Se paga una sola vez${
                  config ? ` (predeterminado Bs ${formatBs(config.tarifaMoldeNuevo)})` : ''
                }.`}
              />
            </div>
          </div>
        </div>

        {(errorDiseno || crear.error != null) && (
          <p className="rounded-lg bg-error-suave px-3 py-2 text-sm text-error">
            {errorDiseno ??
              (crear.error instanceof ErrorApi ? crear.error.message : 'Error al crear el modelo')}
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
