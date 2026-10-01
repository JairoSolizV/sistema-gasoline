import { ETIQUETA_ROL, type OperarioDTO, type RolOperario } from '@taller/shared';
import { HojaOficio } from '../../components/HojaOficio';

// Lista de operarios en oficio vertical (ver HojaOficio). Imprime lo que se ve
// en pantalla: solo activos, o todos (y entonces agrega la columna Estado).
//
// Es la tabla más ancha: con todos los datos cargados no entraba en los 19.1 cm
// útiles. Por eso fechas cortas (dd/mm/aa), Estado y Baja en una sola columna,
// celdas angostas y el nombre puede partirse en dos líneas (sobra alto: ~50
// filas por hoja; si hay más, sigue en otra hoja repitiendo el encabezado).

function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function fecha(iso: string | null) {
  return iso ? fechaCorta(iso) : <span className="tenue">—</span>;
}

function texto(v: string | null) {
  return v ?? <span className="tenue">—</span>;
}

export function HojaOperariosImprimible({
  operarios,
  estado,
  rol,
}: {
  operarios: OperarioDTO[];
  estado: 'activos' | 'todos';
  rol?: RolOperario; // filtro por rol activo en pantalla
}) {
  const conBajas = estado === 'todos';
  const activos = operarios.filter((o) => o.activo).length;

  return (
    <HojaOficio
      className="angosta"
      titulo="Operarios del taller"
      detalle={`${conBajas ? 'Todos (activos y de baja)' : 'Solo activos'}${rol ? ` · rol: ${ETIQUETA_ROL[rol]}` : ''}`}
      resumen={
        conBajas
          ? `${operarios.length} operarios (${activos} activos)`
          : `${operarios.length} operarios activos`
      }
    >
      <table>
        <thead>
          <tr>
            <th className="num">N°</th>
            <th>Nombre</th>
            <th>C.I.</th>
            <th>Celular</th>
            <th>F. nac.</th>
            <th>Tipo</th>
            <th>Ingreso</th>
            <th>Salida</th>
            {conBajas && <th>Estado</th>}
          </tr>
        </thead>
        <tbody>
          {operarios.map((o, i) => (
            <tr key={o.id}>
              <td className="num">{i + 1}</td>
              <td className="envolver" style={{ fontWeight: 600 }}>
                {o.nombre}
              </td>
              <td>{texto(o.ci)}</td>
              <td>{texto(o.celular)}</td>
              <td>{fecha(o.fechaNacimiento)}</td>
              <td>{o.tipo === 'maestro_externo' ? 'Maestro ext.' : 'Regular'}</td>
              <td>{fecha(o.fechaIngreso)}</td>
              <td>{fecha(o.fechaSalida)}</td>
              {conBajas && (
                <td>
                  {o.activo ? 'Activo' : `Baja${o.fechaBaja ? ` ${fechaCorta(o.fechaBaja)}` : ''}`}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </HojaOficio>
  );
}
