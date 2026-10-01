import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// La lista se dibuja en un portal (document.body) con position: fixed, no
// dentro del contenedor: las tablas de operaciones viven en tarjetas con
// overflow-hidden (bordes redondeados) que la recortaban. Si abajo no hay
// lugar, se abre hacia arriba.
const ALTO_MAX_LISTA = 224; // px (equivale a max-h-56)

interface PosicionLista {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

function calcularPosicion(input: HTMLElement): PosicionLista {
  const r = input.getBoundingClientRect();
  const margen = 8;
  const abajo = window.innerHeight - r.bottom - margen;
  const arriba = r.top - margen;
  const base = { left: r.left, width: r.width };
  if (abajo < ALTO_MAX_LISTA && arriba > abajo) {
    return { ...base, bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(ALTO_MAX_LISTA, arriba) };
  }
  return { ...base, top: r.bottom + 4, maxHeight: Math.min(ALTO_MAX_LISTA, abajo) };
}

// Combobox del catálogo. Decisión del dueño: escribir sirve para BUSCAR, no para
// inventar — el valor guardado siempre sale de una opción del catálogo. Para que
// eso no bloquee la carga de un modelo, si lo tipeado no existe ofrece
// "+ Crear" en la rama actual (docs/PLAN_CATALOGO_MAQUINAS.md §9.4).

export interface OpcionCatalogo {
  id: string;
  nombre: string;
}

export function SelectorCatalogo({
  valor,
  opciones,
  onSeleccionar,
  onCrear,
  placeholder,
  deshabilitadoMotivo,
  permitirVacio = false,
  compacto = false,
  autoFocus = false,
}: {
  valor: string;
  opciones: OpcionCatalogo[];
  onSeleccionar: (nombre: string) => void;
  /** Alta rápida en esta rama. Si falta, el selector es de solo elegir. */
  onCrear?: (nombre: string) => Promise<OpcionCatalogo>;
  placeholder?: string;
  /** Si viene, el campo queda bloqueado y explica por qué (ej. falta la máquina). */
  deshabilitadoMotivo?: string;
  permitirVacio?: boolean;
  compacto?: boolean;
  autoFocus?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [resaltado, setResaltado] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const [posicion, setPosicion] = useState<PosicionLista | null>(null);

  const deshabilitado = deshabilitadoMotivo != null;

  // Buscar ignorando mayúsculas: las máquinas/procesos/piezas están en
  // minúsculas y los grupos en MAYÚSCULAS, y quien carga escribe como quiere.
  const igual = (a: string, b: string) =>
    a.toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es');
    return q ? opciones.filter((o) => o.nombre.toLocaleLowerCase('es').includes(q)) : opciones;
  }, [opciones, busqueda]);

  // Al crear se manda lo tipeado tal cual: el server normaliza según el nivel.
  const tipeado = busqueda.trim();
  const puedeCrear =
    !!onCrear && tipeado.length > 0 && !opciones.some((o) => igual(o.nombre, tipeado));
  const totalItems = filtradas.length + (puedeCrear ? 1 : 0);

  // El valor guardado puede venir de un modelo viejo, anterior al catálogo: se
  // conserva tal cual y se avisa, nunca se pisa ni se borra (C-5).
  const fueraDeCatalogo = valor.trim() !== '' && !opciones.some((o) => igual(o.nombre, valor));

  useEffect(() => {
    if (!abierto) return;
    const alClic = (e: MouseEvent) => {
      const t = e.target as Node;
      // la lista está en un portal: no es hija del contenedor
      if (!contenedor.current?.contains(t) && !lista.current?.contains(t)) cerrar();
    };
    document.addEventListener('mousedown', alClic);
    return () => document.removeEventListener('mousedown', alClic);
  }, [abierto]);

  // Posición fija junto al input; se recalcula al hacer scroll (cualquier
  // contenedor, por eso capture) o al cambiar el tamaño de la ventana.
  useLayoutEffect(() => {
    if (!abierto) return;
    const ubicar = () => {
      if (entrada.current) setPosicion(calcularPosicion(entrada.current));
    };
    ubicar();
    window.addEventListener('scroll', ubicar, true);
    window.addEventListener('resize', ubicar);
    return () => {
      window.removeEventListener('scroll', ubicar, true);
      window.removeEventListener('resize', ubicar);
    };
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
    setBusqueda('');
    setError(null);
    // Soltar el foco: si el input quedara enfocado y cerrado, lo próximo que se
    // tipee se pegaría al valor ya elegido en vez de empezar una búsqueda nueva.
    entrada.current?.blur();
  }

  function abrir() {
    if (deshabilitado) return;
    setAbierto(true);
    setBusqueda('');
    setResaltado(0);
  }

  function elegir(nombre: string) {
    onSeleccionar(nombre);
    cerrar();
  }

  async function crear() {
    if (!onCrear || creando) return;
    setCreando(true);
    setError(null);
    try {
      const nuevo = await onCrear(tipeado);
      elegir(nuevo.nombre);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear');
    } finally {
      setCreando(false);
    }
  }

  function activar(indice: number) {
    if (indice < filtradas.length) elegir(filtradas[indice].nombre);
    else if (puedeCrear) void crear();
  }

  function alTeclado(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!abierto) return abrir();
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      setResaltado((i) => (totalItems === 0 ? 0 : (i + paso + totalItems) % totalItems));
    } else if (e.key === 'Enter') {
      if (!abierto) return;
      e.preventDefault();
      activar(resaltado);
    } else if (e.key === 'Escape') {
      cerrar();
    }
  }

  const alto = compacto ? 'px-2 py-1.5 text-sm' : 'px-3 py-2 text-sm';
  const borde = fueraDeCatalogo ? 'border-amber-400' : 'border-gray-300';

  return (
    <div ref={contenedor} className="relative">
      <input
        ref={entrada}
        value={abierto ? busqueda : valor}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setResaltado(0);
          if (!abierto) setAbierto(true);
        }}
        onFocus={abrir}
        onClick={abrir}
        onKeyDown={alTeclado}
        disabled={deshabilitado}
        autoFocus={autoFocus}
        placeholder={deshabilitadoMotivo ?? placeholder}
        title={fueraDeCatalogo ? `"${valor}" no está en el catálogo` : undefined}
        className={`w-full rounded-md border ${borde} ${alto} outline-none focus:border-acento disabled:bg-gray-50 disabled:text-gray-400`}
      />

      {abierto &&
        posicion &&
        createPortal(
          <ul
            ref={lista}
            style={{
              position: 'fixed',
              left: posicion.left,
              width: Math.max(posicion.width, 144),
              top: posicion.top,
              bottom: posicion.bottom,
              maxHeight: posicion.maxHeight,
            }}
            // z-[60]: por encima de los Modal (z-50), donde también se usa
            className="z-[60] overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          >
            {permitirVacio && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegir('')}
                  className="block w-full px-3 py-1.5 text-left text-sm text-gray-400 italic hover:bg-gray-50"
                >
                  — sin pieza —
                </button>
              </li>
            )}

            {filtradas.map((o, i) => (
              <li key={o.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegir(o.nombre)}
                  onMouseEnter={() => setResaltado(i)}
                  className={`block w-full px-3 py-1.5 text-left text-sm ${
                    i === resaltado ? 'bg-acento/10' : ''
                  } ${igual(o.nombre, valor) ? 'font-semibold' : ''}`}
                >
                  {o.nombre}
                </button>
              </li>
            ))}

            {puedeCrear && (
              <li className="border-t border-gray-100">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void crear()}
                  onMouseEnter={() => setResaltado(filtradas.length)}
                  disabled={creando}
                  className={`block w-full px-3 py-1.5 text-left text-sm text-acento ${
                    resaltado === filtradas.length ? 'bg-acento/10' : ''
                  }`}
                >
                  {creando ? 'Creando…' : `+ Crear «${tipeado}»`}
                </button>
              </li>
            )}

            {filtradas.length === 0 && !puedeCrear && (
              <li className="px-3 py-1.5 text-sm text-gray-400">Sin coincidencias</li>
            )}

            {error && <li className="px-3 py-1.5 text-xs text-error">{error}</li>}
          </ul>,
          document.body,
        )}
    </div>
  );
}
