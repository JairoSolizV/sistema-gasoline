import { useState } from 'react';
import { useConfiguracion } from '../api/configuracion';
import { aDiezmilesimos, PATRON_TASA } from '../features/costos/formato';

// Tipo de cambio del día (docs/PLAN_DOLARES.md): cada despacho, cobro y cambio
// de dólares guarda el suyo. Se propone el último que se usó.

/** 69 600 → "6.96" */
export const tasaTexto = (t: number) => String(t / 10_000);

/** El texto escrito y su valor en diezmilésimos (null si es inválido). */
export function useTasa() {
  const { data: config } = useConfiguracion();
  const [texto, setTexto] = useState<string | null>(null);
  const valor = texto ?? (config ? tasaTexto(config.tasaCambioUsd) : '');
  const tasa = PATRON_TASA.test(valor.trim()) && aDiezmilesimos(valor) > 0 ? aDiezmilesimos(valor) : null;
  return { valor, setTexto, tasa };
}

export function CampoTasa({ valor, onCambiar }: { valor: string; onCambiar: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Tipo de cambio del día</label>
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-gray-500">Bs</span>
        <input
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          inputMode="decimal"
          className="mono w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-acento"
        />
        <span className="text-sm whitespace-nowrap text-gray-500">por $us</span>
      </div>
    </div>
  );
}
