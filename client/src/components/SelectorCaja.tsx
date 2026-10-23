import { CAJAS, ETIQUETA_CAJA, type Caja } from '@taller/shared';

// De qué caja sale o entra la plata (docs/PLAN_CAJA.md): efectivo o banco/QR.
export function SelectorCaja({
  valor,
  onCambiar,
  etiqueta = '¿De qué caja?',
}: {
  valor: Caja;
  onCambiar: (c: Caja) => void;
  etiqueta?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{etiqueta}</label>
      <select
        value={valor}
        onChange={(e) => onCambiar(e.target.value as Caja)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento"
      >
        {CAJAS.map((c) => (
          <option key={c} value={c}>
            {ETIQUETA_CAJA[c]}
          </option>
        ))}
      </select>
    </div>
  );
}
