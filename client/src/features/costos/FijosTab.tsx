import { useState } from 'react';
import {
  aCentavos,
  formatBs,
  GRUPOS_GASTO_FIJO,
  type CostosFijosMesDTO,
  type GastoFijoMesDTO,
  type GrupoGastoFijo,
  type PrestamoMesDTO,
} from '@taller/shared';
import { useCostosFijos, useMutacionFijos } from '../../api/costos';
import { ErrorApi } from '../../api/client';
import { Modal } from '../../components/Modal';
import { hoyLocalISO } from '../../lib/fechas';
import { MESES } from '../../lib/meses';
import { aCentesimasPct, fechaCorta, PATRON_BS, PATRON_DECIMAL, pct } from './formato';

// Costos fijos del taller (docs/PLAN_COSTOS.md §7c). Cada gasto cuenta su parte
// del taller (luz, agua y comida se comparten con la casa); la comida se anota
// compra por compra; el préstamo FIE carga la cuota completa ("recuperación de
// deuda"). Para el precio se reparte entre las prendas de referencia (1500).

const ETIQUETA_GRUPO: Record<GrupoGastoFijo, string> = {
  personal: 'Personal (dueños, comida)',
  operativos: 'Operativos',
  servicios: 'Servicios básicos',
  maquinas: 'Máquinas',
  impuestos: 'Impuestos',
  otros: 'Otros',
};
const claseInput =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento';
const bs = (s: string) => aCentavos(s.trim().replace(',', '.'));
const mensaje = (e: unknown) => (e instanceof ErrorApi ? e.message : 'Error al guardar');

type ModalFijos =
  | { tipo: 'gasto'; gasto: GastoFijoMesDTO | null }
  | { tipo: 'monto'; gasto: GastoFijoMesDTO }
  | { tipo: 'compra'; gasto: GastoFijoMesDTO }
  | { tipo: 'prestamo'; prestamo: PrestamoMesDTO | null }
  | null;

export function FijosTab() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const { data: d, isLoading } = useCostosFijos(anio, mes);
  const [modal, setModal] = useState<ModalFijos>(null);
  const irMes = (delta: number) => {
    const x = new Date(anio, mes - 1 + delta, 1);
    setAnio(x.getFullYear());
    setMes(x.getMonth() + 1);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => irMes(-1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
            ‹
          </button>
          <div className="min-w-40 text-center text-lg font-semibold capitalize">
            {MESES[mes - 1]} {anio}
          </div>
          <button onClick={() => irMes(1)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
            ›
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal({ tipo: 'prestamo', prestamo: null })}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            + Préstamo
          </button>
          <button
            onClick={() => setModal({ tipo: 'gasto', gasto: null })}
            className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2]"
          >
            + Gasto fijo
          </button>
        </div>
      </div>

      {isLoading && <div className="mt-4 text-sm text-gray-500">Cargando…</div>}
      {d && (
        <>
          <Resumen d={d} />
          <Gastos d={d} onModal={setModal} />
          <Prestamos d={d} onModal={setModal} />
        </>
      )}

      {modal?.tipo === 'gasto' && <ModalGasto gasto={modal.gasto} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'monto' && <ModalMonto gasto={modal.gasto} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'compra' && <ModalCompra gasto={modal.gasto} onCerrar={() => setModal(null)} />}
      {modal?.tipo === 'prestamo' && <ModalPrestamo prestamo={modal.prestamo} onCerrar={() => setModal(null)} />}
    </div>
  );
}

function Resumen({ d }: { d: CostosFijosMesDTO }) {
  const tarjeta = (titulo: string, valor: string, ayuda: string, fuerte = false) => (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${fuerte ? 'border-gray-300' : 'border-gray-200'}`}>
      <div className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">{titulo}</div>
      <div className={`mono mt-1 font-semibold ${fuerte ? 'text-2xl' : 'text-lg'}`}>{valor}</div>
      <div className="mt-0.5 text-[11px] text-gray-400">{ayuda}</div>
    </div>
  );
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tarjeta('Gastos del taller', `Bs ${formatBs(d.totalGastos)}`, 'la parte del taller de cada gasto')}
        {tarjeta('Recuperación de deuda', `Bs ${formatBs(d.totalDeuda)}`, 'cuotas completas de los préstamos')}
        {tarjeta('Costos fijos del mes', `Bs ${formatBs(d.total)}`, 'gastos + deuda', true)}
        {tarjeta(
          'Producción real',
          d.porPrendaReal != null ? `Bs ${formatBs(d.porPrendaReal)}/prenda` : '—',
          `${d.prendasReales} prendas de cortes cerrados en el mes`,
        )}
      </div>
      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-semibold">Costo fijo por prenda según cuánto produzcas</div>
          <div className="text-xs text-gray-500">
            Presupuesto mensual Bs {formatBs(d.presupuestoMensual)} (montos de hoy, comida = promedio de los
            últimos meses)
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {d.simulacion.map((s) => {
            const referencia = s.prendas === d.prendasReferencia;
            return (
              <div
                key={s.prendas}
                className={`rounded-lg border px-3 py-2 text-center ${referencia ? 'border-acento bg-[rgba(47,111,224,0.06)]' : 'border-gray-200'}`}
              >
                <div className="text-xs text-gray-500">{s.prendas.toLocaleString('es-BO')} prendas/mes</div>
                <div className="mono text-lg font-semibold">Bs {formatBs(s.porPrenda)}</div>
                {referencia && <div className="text-[10px] font-semibold text-acento">se suma a las fichas</div>}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Gastos({ d, onModal }: { d: CostosFijosMesDTO; onModal: (m: ModalFijos) => void }) {
  const mutar = useMutacionFijos();
  const [abiertas, setAbiertas] = useState<string | null>(null);
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            <th className="px-5 py-3">Gasto</th>
            <th className="px-3 py-3 text-right">Del mes</th>
            <th className="px-3 py-3 text-right">% taller</th>
            <th className="px-3 py-3 text-right">Parte del taller</th>
            <th className="px-5 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        {GRUPOS_GASTO_FIJO.map((grupo) => {
          const lista = d.gastos.filter((g) => g.grupo === grupo);
          if (lista.length === 0) return null;
          return (
            <tbody key={grupo}>
              <tr className="bg-gray-50/60">
                <td colSpan={5} className="px-5 py-1.5 text-xs font-semibold text-gray-600">
                  {ETIQUETA_GRUPO[grupo]}
                </td>
              </tr>
              {lista.map((g) => (
                <FilaGasto
                  key={g.id}
                  g={g}
                  abierta={abiertas === g.id}
                  onAbrir={() => setAbiertas(abiertas === g.id ? null : g.id)}
                  onModal={onModal}
                  onQuitarCompra={(id) => mutar.mutate({ tipo: 'quitarCompra', id })}
                />
              ))}
            </tbody>
          );
        })}
        {d.gastos.length === 0 && (
          <tbody>
            <tr>
              <td colSpan={5} className="px-5 py-10 text-center text-gray-500">
                Todavía no hay gastos fijos. Agregá el sueldo de ustedes, la luz, el agua, la comida…
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
}

function FilaGasto({
  g,
  abierta,
  onAbrir,
  onModal,
  onQuitarCompra,
}: {
  g: GastoFijoMesDTO;
  abierta: boolean;
  onAbrir: () => void;
  onModal: (m: ModalFijos) => void;
  onQuitarCompra: (id: string) => void;
}) {
  const porCompras = g.tipo === 'por_compras';
  return (
    <>
      <tr className={`border-b border-gray-100 ${g.activo ? '' : 'opacity-50'}`}>
        <td className="px-5 py-2.5">
          <div className="font-medium">{g.nombre}</div>
          <div className="text-[11px] text-gray-400">
            {porCompras ? (
              <button onClick={onAbrir} className="text-acento hover:underline">
                {g.compras.length} compra(s) este mes {abierta ? '▴' : '▾'}
              </button>
            ) : (
              'monto mensual'
            )}
            {g.notas && ` · ${g.notas}`}
          </div>
        </td>
        <td className="mono px-3 py-2.5 text-right text-gray-600">Bs {formatBs(g.base)}</td>
        <td className="mono px-3 py-2.5 text-right text-gray-600">{pct(g.porcentajeTaller)}</td>
        <td className="mono px-3 py-2.5 text-right font-semibold">Bs {formatBs(g.parteTaller)}</td>
        <td className="px-5 py-2.5 text-right text-[13px] font-medium whitespace-nowrap">
          <button
            onClick={() => onModal(porCompras ? { tipo: 'compra', gasto: g } : { tipo: 'monto', gasto: g })}
            className="text-acento hover:underline"
          >
            {porCompras ? 'Anotar compra' : 'Cambiar monto'}
          </button>
          <button onClick={() => onModal({ tipo: 'gasto', gasto: g })} className="ml-3 text-gray-600 hover:underline">
            Editar
          </button>
        </td>
      </tr>
      {abierta &&
        g.compras.map((c) => (
          <tr key={c.id} className="border-b border-gray-100 bg-gray-50/40 text-xs">
            <td className="py-1.5 pr-3 pl-10 text-gray-600">
              {fechaCorta(c.fecha)} {c.nota && `· ${c.nota}`}
            </td>
            <td className="mono px-3 py-1.5 text-right">Bs {formatBs(c.monto)}</td>
            <td colSpan={2} />
            <td className="px-5 py-1.5 text-right">
              <button onClick={() => onQuitarCompra(c.id)} className="text-error hover:underline">
                Quitar
              </button>
            </td>
          </tr>
        ))}
    </>
  );
}

function Prestamos({ d, onModal }: { d: CostosFijosMesDTO; onModal: (m: ModalFijos) => void }) {
  const mutar = useMutacionFijos();
  if (d.prestamos.length === 0) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-semibold">
        Préstamos · recuperación de deuda (cuota completa)
      </div>
      <table className="w-full text-sm">
        <tbody>
          {d.prestamos.map((p) => (
            <tr key={p.id} className={`border-b border-gray-100 last:border-0 ${p.activo ? '' : 'opacity-50'}`}>
              <td className="px-5 py-2.5">
                <div className="font-medium">{p.banco}</div>
                <div className="text-[11px] text-gray-400">
                  vence el {fechaCorta(p.vence)}
                  {p.cuotasRestantes != null && ` · faltan ${p.cuotasRestantes} cuotas`}
                </div>
              </td>
              <td className="mono px-3 py-2.5 text-right font-semibold">Bs {formatBs(p.cuota)}</td>
              <td className="px-3 py-2.5 text-right text-xs">
                {p.pago ? (
                  <span className="rounded-full bg-ok-suave px-2 py-0.5 font-semibold text-ok">
                    pagada el {fechaCorta(p.pago.fecha)}
                  </span>
                ) : (
                  <span className="text-amber-700">sin pagar</span>
                )}
              </td>
              <td className="px-5 py-2.5 text-right text-[13px] font-medium whitespace-nowrap">
                {p.pago ? (
                  <button
                    onClick={() => mutar.mutate({ tipo: 'quitarPago', id: p.id, anio: d.anio, mes: d.mes })}
                    className="text-gray-600 hover:underline"
                  >
                    Quitar pago
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      mutar.mutate({
                        tipo: 'pagar',
                        id: p.id,
                        input: { anio: d.anio, mes: d.mes, fecha: hoyLocalISO(), monto: p.cuota },
                      })
                    }
                    className="text-acento hover:underline"
                  >
                    Marcar pagada
                  </button>
                )}
                <button onClick={() => onModal({ tipo: 'prestamo', prestamo: p })} className="ml-3 text-gray-600 hover:underline">
                  Editar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── modales ──

function Botones({ onCerrar, onGuardar, pendiente, texto }: { onCerrar: () => void; onGuardar: () => void; pendiente: boolean; texto: string }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button onClick={onCerrar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50">
        Cancelar
      </button>
      <button
        onClick={onGuardar}
        disabled={pendiente}
        className="rounded-lg bg-acento px-4 py-2 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
      >
        {texto}
      </button>
    </div>
  );
}

function ModalGasto({ gasto, onCerrar }: { gasto: GastoFijoMesDTO | null; onCerrar: () => void }) {
  const mutar = useMutacionFijos();
  const [nombre, setNombre] = useState(gasto?.nombre ?? '');
  const [grupo, setGrupo] = useState<GrupoGastoFijo>(gasto?.grupo ?? 'personal');
  const [porCompras, setPorCompras] = useState(gasto?.tipo === 'por_compras');
  const [porcentaje, setPorcentaje] = useState(gasto ? String(gasto.porcentajeTaller / 100) : '100');
  const [montoBs, setMontoBs] = useState('');
  const [desde, setDesde] = useState(`${hoyLocalISO().slice(0, 8)}01`);
  const [activo, setActivo] = useState(gasto?.activo ?? true);
  const [notas, setNotas] = useState(gasto?.notas ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setError(null);
    if (!nombre.trim()) return setError('Falta el nombre');
    if (!PATRON_DECIMAL.test(porcentaje.trim()) || Number(porcentaje) <= 0 || Number(porcentaje) > 100) {
      return setError('Porcentaje del taller inválido (1 a 100)');
    }
    if (!gasto && !porCompras && !PATRON_BS.test(montoBs.trim())) return setError('Indicá el monto mensual');
    if (gasto) {
      await mutar.mutateAsync({
        tipo: 'editarGasto',
        id: gasto.id,
        input: { nombre, grupo, porcentajeTaller: aCentesimasPct(porcentaje), activo, notas },
      });
    } else {
      await mutar.mutateAsync({
        tipo: 'crearGasto',
        input: {
          nombre,
          grupo,
          tipo: porCompras ? 'por_compras' : 'mensual',
          porcentajeTaller: aCentesimasPct(porcentaje),
          ...(porCompras ? {} : { monto: bs(montoBs), vigenteDesde: desde }),
          notas,
        },
      });
    }
    onCerrar();
  };

  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">{gasto ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}</h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="ej. Sueldo de los dueños, CRE, Comida" className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Grupo</label>
          <select value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoGastoFijo)} className={claseInput}>
            {GRUPOS_GASTO_FIJO.map((g) => (
              <option key={g} value={g}>
                {ETIQUETA_GRUPO[g]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">% del taller</label>
          <input value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} inputMode="decimal" className={`mono ${claseInput}`} />
          <p className="mt-0.5 text-[11px] text-gray-500">100 si es solo del taller; menos si se comparte con la casa</p>
        </div>
        {!gasto && (
          <div className="col-span-2 flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={!porCompras} onChange={() => setPorCompras(false)} /> Monto fijo por mes
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={porCompras} onChange={() => setPorCompras(true)} /> Se anotan las compras (ej. comida)
            </label>
          </div>
        )}
        {!gasto && !porCompras && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium">Monto por mes (Bs)</label>
              <input value={montoBs} onChange={(e) => setMontoBs(e.target.value)} inputMode="decimal" className={`mono ${claseInput}`} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Desde</label>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={claseInput} />
            </div>
          </>
        )}
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">Notas</label>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} className={claseInput} />
        </div>
        {gasto && (
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activo (desactivalo si ya no se paga)
          </label>
        )}
      </div>
      {(error || mutar.error != null) && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{error ?? mensaje(mutar.error)}</p>
      )}
      <Botones onCerrar={onCerrar} onGuardar={() => void guardar().catch(() => undefined)} pendiente={mutar.isPending} texto="Guardar" />
    </Modal>
  );
}

function ModalMonto({ gasto, onCerrar }: { gasto: GastoFijoMesDTO; onCerrar: () => void }) {
  const mutar = useMutacionFijos();
  const [montoBs, setMontoBs] = useState('');
  const [desde, setDesde] = useState(`${hoyLocalISO().slice(0, 8)}01`);
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    setError(null);
    if (!PATRON_BS.test(montoBs.trim())) return setError('Monto inválido (ej. 1250)');
    await mutar.mutateAsync({ tipo: 'monto', id: gasto.id, input: { monto: bs(montoBs), vigenteDesde: desde } });
    onCerrar();
  };
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Cambiar monto: {gasto.nombre}</h2>
      {gasto.montos.length > 0 && (
        <ul className="mt-2 text-xs text-gray-500">
          {gasto.montos.map((m) => (
            <li key={m.id}>
              desde {fechaCorta(m.vigenteDesde)}: Bs {formatBs(m.monto)}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Nuevo monto por mes (Bs)</label>
          <input value={montoBs} onChange={(e) => setMontoBs(e.target.value)} inputMode="decimal" className={`mono ${claseInput}`} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={claseInput} />
        </div>
      </div>
      {(error || mutar.error != null) && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{error ?? mensaje(mutar.error)}</p>
      )}
      <Botones onCerrar={onCerrar} onGuardar={() => void guardar().catch(() => undefined)} pendiente={mutar.isPending} texto="Guardar" />
    </Modal>
  );
}

function ModalCompra({ gasto, onCerrar }: { gasto: GastoFijoMesDTO; onCerrar: () => void }) {
  const mutar = useMutacionFijos();
  const [fecha, setFecha] = useState(hoyLocalISO());
  const [montoBs, setMontoBs] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    setError(null);
    if (!PATRON_BS.test(montoBs.trim()) || bs(montoBs) <= 0) return setError('Monto inválido (ej. 85.50)');
    await mutar.mutateAsync({ tipo: 'compra', id: gasto.id, input: { fecha, monto: bs(montoBs), nota } });
    onCerrar();
  };
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">Anotar compra: {gasto.nombre}</h2>
      <p className="mt-1 text-sm text-gray-600">
        El monto total de la compra (sin factura está bien). Al taller le toca el {pct(gasto.porcentajeTaller)}.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Monto (Bs)</label>
          <input value={montoBs} onChange={(e) => setMontoBs(e.target.value)} inputMode="decimal" className={`mono ${claseInput}`} />
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">Qué fue</label>
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ej. verduras de la semana, pan, carne" className={claseInput} />
        </div>
      </div>
      {(error || mutar.error != null) && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{error ?? mensaje(mutar.error)}</p>
      )}
      <Botones onCerrar={onCerrar} onGuardar={() => void guardar().catch(() => undefined)} pendiente={mutar.isPending} texto="Anotar" />
    </Modal>
  );
}

function ModalPrestamo({ prestamo, onCerrar }: { prestamo: PrestamoMesDTO | null; onCerrar: () => void }) {
  const mutar = useMutacionFijos();
  const [banco, setBanco] = useState(prestamo?.banco ?? '');
  const [cuotaBs, setCuotaBs] = useState(prestamo ? (prestamo.cuota / 100).toFixed(2) : '');
  const [dia, setDia] = useState(prestamo ? String(prestamo.diaVencimiento) : '');
  const [restantes, setRestantes] = useState(prestamo?.cuotasRestantes?.toString() ?? '');
  const [activo, setActivo] = useState(prestamo?.activo ?? true);
  const [error, setError] = useState<string | null>(null);
  const guardar = async () => {
    setError(null);
    if (!banco.trim()) return setError('Indicá el banco');
    if (!PATRON_BS.test(cuotaBs.trim())) return setError('Cuota inválida (ej. 10500)');
    const d = Number(dia);
    if (!Number.isInteger(d) || d < 1 || d > 31) return setError('Día de vencimiento inválido (1 a 31)');
    const input = {
      banco,
      cuota: bs(cuotaBs),
      diaVencimiento: d,
      cuotasRestantes: restantes.trim() ? Number(restantes) : null,
    };
    if (prestamo) await mutar.mutateAsync({ tipo: 'editarPrestamo', id: prestamo.id, input: { ...input, activo } });
    else await mutar.mutateAsync({ tipo: 'crearPrestamo', input });
    onCerrar();
  };
  return (
    <Modal onCerrar={onCerrar}>
      <h2 className="text-lg font-semibold">{prestamo ? 'Editar préstamo' : 'Nuevo préstamo'}</h2>
      <p className="mt-1 text-sm text-gray-600">La cuota completa se carga como costo fijo (recuperación de deuda).</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium">Banco</label>
          <input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="ej. FIE" className={claseInput} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Cuota mensual (Bs)</label>
          <input value={cuotaBs} onChange={(e) => setCuotaBs(e.target.value)} inputMode="decimal" className={`mono ${claseInput}`} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Vence cada mes el día</label>
          <input value={dia} onChange={(e) => setDia(e.target.value)} inputMode="numeric" placeholder="ej. 15" className={`mono ${claseInput}`} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Cuotas que faltan</label>
          <input value={restantes} onChange={(e) => setRestantes(e.target.value)} inputMode="numeric" placeholder="opcional" className={`mono ${claseInput}`} />
        </div>
        {prestamo && (
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activo (desactivalo cuando termines de pagar)
          </label>
        )}
      </div>
      {(error || mutar.error != null) && (
        <p className="mt-3 rounded-lg bg-error-suave px-3 py-2 text-xs text-error">{error ?? mensaje(mutar.error)}</p>
      )}
      <Botones onCerrar={onCerrar} onGuardar={() => void guardar().catch(() => undefined)} pendiente={mutar.isPending} texto="Guardar" />
    </Modal>
  );
}
