import { useEffect, useState } from 'react';
import { formatBs, type ProyeccionDTO } from '@taller/shared';
import { useFichasCosto, useGuardarPlan, useProyeccion } from '../../api/costos';
import { ErrorApi } from '../../api/client';
import { MESES } from '../../lib/meses';
import { deMilesimas } from './formato';

// Proyección del mes (docs/PLAN_COSTOS.md §7b): plan de producción (fichas ×
// prendas) → material necesario frente al stock, lo que falta comprar y la plata
// para producirlo; más lo pendiente de los cortes abiertos de Taller · Pagos.

interface FilaPlan {
  fichaId: string;
  prendas: string;
}

export function ProyeccionTab() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const { data: p, isLoading } = useProyeccion(anio, mes);
  const { data: fichas } = useFichasCosto();
  const guardar = useGuardarPlan();
  const [filas, setFilas] = useState<FilaPlan[]>([]);
  const [error, setError] = useState<string | null>(null);

  // al cambiar de mes (o recargar) el editor toma el plan guardado
  useEffect(() => {
    if (p) setFilas(p.plan.map((x) => ({ fichaId: x.ficha.id, prendas: String(x.prendas) })));
  }, [p]);

  const irMes = (delta: number) => {
    const d = new Date(anio, mes - 1 + delta, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth() + 1);
  };

  const onGuardar = async () => {
    setError(null);
    const items = [];
    for (const f of filas) {
      if (!f.fichaId) return setError('Elegí el modelo de cada fila');
      if (!/^\d+$/.test(f.prendas.trim()) || Number(f.prendas) < 1) return setError('Prendas inválidas');
      items.push({ fichaId: f.fichaId, prendas: Number(f.prendas) });
    }
    if (new Set(items.map((i) => i.fichaId)).size !== items.length) return setError('Hay un modelo repetido');
    await guardar.mutateAsync({ anio, mes, items });
  };

  return (
    <div>
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

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold">Plan de producción del mes</div>
          <div className="space-y-2 p-4">
            {filas.map((f, i) => {
              const item = p?.plan.find((x) => x.ficha.id === f.fichaId);
              return (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={f.fichaId}
                    onChange={(e) => setFilas((fs) => fs.map((x, k) => (k === i ? { ...x, fichaId: e.target.value } : x)))}
                    className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">Elegir modelo…</option>
                    {fichas?.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.codigo ? `${x.codigo} · ` : ''}
                        {x.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    value={f.prendas}
                    onChange={(e) => setFilas((fs) => fs.map((x, k) => (k === i ? { ...x, prendas: e.target.value } : x)))}
                    inputMode="numeric"
                    placeholder="prendas"
                    className="mono w-24 rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm"
                  />
                  <span className="mono w-28 text-right text-xs text-gray-500">
                    {item ? `Bs ${formatBs(item.costoPorPrenda)}/prenda` : ''}
                  </span>
                  <button
                    onClick={() => setFilas((fs) => fs.filter((_, k) => k !== i))}
                    title="Quitar"
                    className="text-gray-400 hover:text-error"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setFilas((fs) => [...fs, { fichaId: '', prendas: '' }])}
                className="text-[13px] font-medium text-acento hover:underline"
              >
                + Agregar modelo
              </button>
              <button
                onClick={() => void onGuardar().catch(() => undefined)}
                disabled={guardar.isPending}
                className="rounded-lg bg-acento px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#265dc2] disabled:opacity-60"
              >
                Guardar plan y calcular
              </button>
            </div>
            {(error || guardar.error != null) && (
              <p className="rounded-lg bg-error-suave px-3 py-2 text-xs text-error">
                {error ?? (guardar.error instanceof ErrorApi ? guardar.error.message : 'Error al guardar')}
              </p>
            )}
          </div>
        </div>
        {p && <Totales p={p} />}
      </div>

      {isLoading && <div className="mt-4 text-sm text-gray-500">Calculando…</div>}
      {p && (
        <>
          {p.avisos.length > 0 && (
            <ul className="mt-4 list-disc rounded-lg bg-amber-50 py-2 pr-3 pl-8 text-xs text-amber-800">
              {p.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <Necesidades p={p} />
          <CortesAbiertos p={p} />
        </>
      )}
    </div>
  );
}

function Totales({ p }: { p: ProyeccionDTO }) {
  const fila = (t: string, v: number, ayuda: string) => (
    <div className="py-1.5">
      <div className="flex justify-between gap-4">
        <span>{t}</span>
        <span className="mono font-semibold">Bs {formatBs(v)}</span>
      </div>
      <div className="text-[11px] text-gray-400">{ayuda}</div>
    </div>
  );
  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4 text-sm shadow-sm">
      <div className="mb-1 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">Plata que se necesita</div>
      {fila('Comprar materiales', p.totales.comprarMateriales, 'lo que falta según el stock')}
      {fila('Producir el plan', p.totales.producirPlan, 'costura, empaque, servicio de corte, lavandería…')}
      {fila('Terminar cortes abiertos', p.totales.terminarCortes, 'costura y empaque al cerrar + envíos por devolver')}
      {fila('Costos fijos del taller', p.totales.costosFijos, 'sueldos, servicios, comida y la cuota del FIE del mes')}
      <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-base">
        <span className="font-semibold">Total</span>
        <span className="mono font-semibold">Bs {formatBs(p.totales.total)}</span>
      </div>
    </div>
  );
}

function Necesidades({ p }: { p: ProyeccionDTO }) {
  if (p.necesidades.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold">Materiales para el plan</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
            <th className="px-4 py-2">Insumo</th>
            <th className="px-3 py-2 text-right">Hace falta</th>
            <th className="px-3 py-2 text-right">Hay</th>
            <th className="px-3 py-2 text-right">Comprar</th>
            <th className="px-4 py-2 text-right">Costo</th>
          </tr>
        </thead>
        <tbody>
          {p.necesidades.map((n) => (
            <tr key={n.insumo.id} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2 font-medium">{n.insumo.nombre}</td>
              <td className="mono px-3 py-2 text-right text-gray-600">
                {deMilesimas(n.necesario)} {n.insumo.unidad}
              </td>
              <td className={`mono px-3 py-2 text-right ${n.stock < 0 ? 'text-error' : 'text-gray-600'}`}>
                {deMilesimas(n.stock)}
              </td>
              <td className="mono px-3 py-2 text-right font-semibold">
                {n.faltante > 0 ? `${deMilesimas(n.faltante)} ${n.insumo.unidad}` : <span className="font-normal text-ok">alcanza</span>}
              </td>
              <td className="mono px-4 py-2 text-right">
                {n.costoFaltante == null ? <span className="text-xs text-amber-700">sin precio</span> : n.costoFaltante > 0 ? `Bs ${formatBs(n.costoFaltante)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CortesAbiertos({ p }: { p: ProyeccionDTO }) {
  if (p.cortesAbiertos.length === 0) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold">Cortes abiertos (para terminarlos)</div>
      <table className="w-full text-sm">
        <tbody>
          {p.cortesAbiertos.map((c) => (
            <tr key={c.corteId} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2">
                <span className="font-medium">COD {c.codigo}</span> <span className="text-gray-600">{c.modeloNombre}</span>
              </td>
              <td className="mono px-3 py-2 text-right text-gray-500">{c.prendas} prendas</td>
              <td className="mono px-3 py-2 text-right">costura y empaque Bs {formatBs(c.costuraYEmpaque)}</td>
              <td className="mono px-4 py-2 text-right text-gray-500">
                {c.enviosSinDevolver > 0 ? `envíos Bs ${formatBs(c.enviosSinDevolver)}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
