import { CAJAS_BS, ETIQUETA_CAJA, type Caja, type CajaBs } from '@taller/shared';

// De qué caja sale o entra la plata (docs/PLAN_CAJA.md). Por defecto solo las de
// Bs (efectivo, banco/QR); la de dólares, donde se pide (docs/PLAN_DOLARES.md).
export function SelectorCaja<C extends Caja = CajaBs>({
  valor,
  onCambiar,
  etiqueta = '¿De qué caja?',
  cajas = CAJAS_BS as unknown as readonly C[],
}: {
  valor: C;
  onCambiar: (c: C) => void;
  etiqueta?: string;
  cajas?: readonly C[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{etiqueta}</label>
      <select
        value={valor}
        onChange={(e) => onCambiar(e.target.value as C)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento"
      >
        {cajas.map((c) => (
          <option key={c} value={c}>
            {ETIQUETA_CAJA[c]}
          </option>
        ))}
      </select>
    </div>
  );
}
