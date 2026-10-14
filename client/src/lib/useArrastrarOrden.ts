import { useState, type DragEvent } from 'react';

type Posicion = 'antes' | 'despues';

/** Mueve `movido` antes/después de `destino`. Si no cambia nada devuelve `ids`. */
export function moverId(ids: string[], movido: string, destino: string, pos: Posicion): string[] {
  if (movido === destino) return ids;
  const sin = ids.filter((x) => x !== movido);
  const i = sin.indexOf(destino);
  if (i < 0) return ids;
  sin.splice(pos === 'antes' ? i : i + 1, 0, movido);
  return sin;
}

/** Reordenar una lista arrastrando (arrastre nativo del navegador, sin
 *  dependencias). Cada lista (un grupo) usa su propio hook: soltar una fila en
 *  otra lista no hace nada, así una operación nunca cambia de grupo al
 *  arrastrar. El arrastre empieza solo desde la manija, para que los inputs y
 *  selects de la fila sigan funcionando normal.
 *
 *  Uso: `{...manija(id)}` en el ícono ⠿, `{...fila(id)}` en el contenedor de
 *  la fila e `indicador(id)` para dibujar la línea donde caerá. */
export function useArrastrarOrden(ids: string[], onReordenar: (nuevoOrden: string[]) => void) {
  const [arrastrado, setArrastrado] = useState<string | null>(null);
  const [destino, setDestino] = useState<{ id: string; pos: Posicion } | null>(null);

  const terminar = () => {
    setArrastrado(null);
    setDestino(null);
  };

  const manija = (id: string) => ({
    draggable: true,
    title: 'Arrastrá para reordenar',
    onDragStart: (e: DragEvent<HTMLElement>) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id); // Firefox no arrastra sin datos
      const fila = e.currentTarget.closest('[data-fila-arrastrable]');
      if (fila) e.dataTransfer.setDragImage(fila, 12, 12);
      setArrastrado(id);
    },
    onDragEnd: terminar,
  });

  const fila = (id: string) => ({
    'data-fila-arrastrable': '',
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!arrastrado) return; // viene de otra lista (otro grupo): no se acepta
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = e.currentTarget.getBoundingClientRect();
      const pos: Posicion = e.clientY < r.top + r.height / 2 ? 'antes' : 'despues';
      if (destino?.id !== id || destino.pos !== pos) setDestino({ id, pos });
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      if (!arrastrado || !destino) return;
      e.preventDefault();
      const nuevo = moverId(ids, arrastrado, destino.id, destino.pos);
      terminar();
      if (nuevo.some((x, i) => x !== ids[i])) onReordenar(nuevo); // soltar en el mismo lugar = nada
    },
  });

  /** Dónde se dibuja la línea de "cae aquí" (null = ninguna). */
  const indicador = (id: string): Posicion | null =>
    arrastrado && arrastrado !== id && destino?.id === id ? destino.pos : null;

  return { arrastrado, manija, fila, indicador };
}

/** Línea azul arriba/abajo de la fila destino (sirve en <tr> y en <div>). */
export function claseIndicador(pos: Posicion | null): string {
  if (pos === 'antes') return 'shadow-[inset_0_2px_0_#2f6fe0] [&>td]:shadow-[inset_0_2px_0_#2f6fe0]';
  if (pos === 'despues') return 'shadow-[inset_0_-2px_0_#2f6fe0] [&>td]:shadow-[inset_0_-2px_0_#2f6fe0]';
  return '';
}
