import { formatBs, type ModeloVersionDetalleDTO, type OperacionDTO } from '@taller/shared';
import { HojaOficio } from '../../components/HojaOficio';

// Hoja de operaciones de una versión, en oficio vertical (ver HojaOficio).
// Una sola hoja: con más de 46 filas (operaciones + encabezados de grupo) se
// baja a 9pt. El modelo más grande hoy tiene 54 filas y entra a 9pt.

function agruparPorGrupo(operaciones: OperacionDTO[]) {
  const mapa = new Map<string, OperacionDTO[]>();
  for (const op of operaciones) {
    const lista = mapa.get(op.grupo);
    if (lista) lista.push(op);
    else mapa.set(op.grupo, [op]);
  }
  return [...mapa.entries()];
}

export function HojaOperacionesImprimible({ detalle }: { detalle: ModeloVersionDetalleDTO }) {
  const grupos = agruparPorGrupo(detalle.operaciones);
  const filas = detalle.operaciones.length + grupos.length;

  return (
    <HojaOficio
      titulo={`${detalle.modeloNombre} · v${detalle.numeroVersion}`}
      detalle={detalle.notas}
      resumen={`${detalle.operaciones.length} operaciones`}
      tamanoLetra={filas > 46 ? '9pt' : '10pt'}
    >
      <table>
        <thead>
          <tr>
            <th>N°</th>
            <th>Máquina</th>
            <th>Proceso</th>
            <th>Pieza</th>
            <th className="num">CT (Bs)</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map(([grupo, ops]) => [
            <tr key={`g-${grupo}`} className="grupo">
              <td colSpan={4}>
                {grupo} <span style={{ fontWeight: 400 }}>({ops.length})</span>
              </td>
              <td className="num">{formatBs(ops.reduce((a, o) => a + o.ct, 0))}</td>
            </tr>,
            ...ops.map((op) => (
              <tr key={op.id}>
                <td>{op.n ?? ''}</td>
                <td>{op.equipo}</td>
                <td>{op.proceso}</td>
                <td>{op.pieza ?? ''}</td>
                <td className="num">{formatBs(op.ct)}</td>
              </tr>
            )),
          ])}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>Mano de obra por prenda</td>
            <td className="num">{formatBs(detalle.costoManoObraPrenda)}</td>
          </tr>
        </tfoot>
      </table>
    </HojaOficio>
  );
}
