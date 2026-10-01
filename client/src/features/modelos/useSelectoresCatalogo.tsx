import type { FieldValues, Path, PathValue, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { normalizarNombreGrupo } from '@taller/shared';
import { rutasCatalogo, useCatalogo, useCrearNodo } from '../../api/catalogo';
import { SelectorCatalogo } from '../../components/SelectorCatalogo';

// Los 4 campos de una operación que salen del catálogo (grupo, máquina, proceso,
// pieza), con la cascada ya resuelta: máquina → proceso → pieza.
// Devuelve elementos ya armados para que cada formulario los ubique en su propio
// layout (fila de tabla o grilla del modal) sin duplicar la lógica.

export interface ValoresCatalogo {
  grupo: string;
  equipo: string;
  proceso: string;
  pieza: string;
}

export function useSelectoresCatalogo<T extends FieldValues>({
  register,
  setValue,
  prefijo = '',
  valores,
  compacto = false,
}: {
  register: UseFormRegister<T>;
  setValue: UseFormSetValue<T>;
  /** '' en el modal; 'operaciones.3.' en la tabla del alta de modelo. */
  prefijo?: string;
  valores: ValoresCatalogo;
  compacto?: boolean;
}) {
  const { data } = useCatalogo(true);
  const crearNodo = useCrearNodo();

  // Comparación sin mayúsculas: un modelo viejo puede tener "ENTREPI" donde el
  // catálogo dice "entrepi", y aun así tiene que encontrar su rama.
  const igual = (a: string, b: string) =>
    a.toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

  const maquinas = data?.maquinas ?? [];
  const maquina = maquinas.find((m) => igual(m.nombre, valores.equipo));
  const procesos = maquina?.procesos ?? [];
  const proceso = procesos.find((p) => igual(p.nombre, valores.proceso));
  const piezas = proceso?.piezas ?? [];

  const campo = (nombre: keyof ValoresCatalogo) => `${prefijo}${nombre}` as Path<T>;

  function fijar(nombre: keyof ValoresCatalogo, valor: string) {
    setValue(campo(nombre), valor as PathValue<T, Path<T>>, {
      // limpiar la cascada de abajo no debe pintar "obligatorio" antes de que
      // el usuario llegue a ese campo
      shouldValidate: valor !== '',
      shouldDirty: true,
    });
  }

  const alta = (ruta: string) => async (nombre: string) => crearNodo.mutateAsync({ ruta, nombre });

  // Los hidden registrados mantienen la validación de react-hook-form intacta
  // (los valores los escribe el selector, no el teclado).
  const oculto = (nombre: keyof ValoresCatalogo, obligatorio?: string) => (
    <input type="hidden" {...register(campo(nombre), obligatorio ? { required: obligatorio } : {})} />
  );

  return {
    grupo: (
      <>
        {oculto('grupo', 'obligatorio')}
        <SelectorCatalogo
          valor={valores.grupo}
          opciones={data?.grupos ?? []}
          onSeleccionar={(v) => fijar('grupo', normalizarNombreGrupo(v))}
          onCrear={alta(rutasCatalogo.grupos)}
          placeholder="buscar grupo…"
          compacto={compacto}
        />
      </>
    ),

    maquina: (
      <>
        {oculto('equipo', 'obligatorio')}
        <SelectorCatalogo
          valor={valores.equipo}
          opciones={maquinas}
          onSeleccionar={(v) => {
            // cambiar de máquina invalida lo de abajo: la cascada se limpia
            fijar('equipo', v);
            fijar('proceso', '');
            fijar('pieza', '');
          }}
          onCrear={alta(rutasCatalogo.maquinas)}
          placeholder="buscar máquina…"
          compacto={compacto}
        />
      </>
    ),

    proceso: (
      <>
        {oculto('proceso', 'obligatorio')}
        <SelectorCatalogo
          valor={valores.proceso}
          opciones={procesos}
          onSeleccionar={(v) => {
            fijar('proceso', v);
            fijar('pieza', '');
          }}
          onCrear={maquina ? alta(rutasCatalogo.procesosDe(maquina.id)) : undefined}
          placeholder="buscar proceso…"
          deshabilitadoMotivo={valores.equipo ? undefined : 'elegí la máquina'}
          compacto={compacto}
        />
      </>
    ),

    pieza: (
      <>
        {oculto('pieza')}
        <SelectorCatalogo
          valor={valores.pieza}
          opciones={piezas}
          onSeleccionar={(v) => fijar('pieza', v)}
          onCrear={proceso ? alta(rutasCatalogo.piezasDe(proceso.id)) : undefined}
          placeholder="buscar pieza…"
          deshabilitadoMotivo={valores.proceso ? undefined : 'elegí el proceso'}
          permitirVacio
          compacto={compacto}
        />
      </>
    ),
  };
}
