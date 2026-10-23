import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { logout } from '../api/auth';
import { BotonImprimir } from './Imprimir';
import { Ayuda } from './Ayuda';

function Icono({ d }: { d: string }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

// Áreas del sistema, cada una con su color. En el menú van en el orden en que
// trabaja el taller: costear → comprar → producir → personal → vender → finanzas. El color identifica el área en el
// menú y en la franja de arriba de cada página; los botones de acción siguen
// en azul y el verde/rojo quedan para plata a favor o en contra.
type Area = { nombre: string; color: string; claro: string };
export const AREAS = {
  produccion: { nombre: 'Producción', color: '#378ADD', claro: '#85B7EB' },
  personal: { nombre: 'Personal', color: '#1D9E75', claro: '#5DCAA5' },
  compras: { nombre: 'Compras', color: '#BA7517', claro: '#EF9F27' },
  ventas: { nombre: 'Ventas', color: '#7F77DD', claro: '#AFA9EC' },
  costos: { nombre: 'Costos', color: '#D85A30', claro: '#F0997B' },
  finanzas: { nombre: 'Finanzas', color: '#639922', claro: '#97C459' },
  sistema: { nombre: 'Sistema', color: '#888780', claro: '#B4B2A9' },
} satisfies Record<string, Area>;
type ClaveArea = keyof typeof AREAS;

// a qué área pertenece cada ruta (el prefijo más largo gana)
const RUTAS_AREA: [string, ClaveArea][] = [
  ['/modelos', 'produccion'],
  ['/plantillas', 'produccion'],
  ['/catalogo', 'produccion'],
  ['/cortes', 'produccion'],
  ['/asistencia', 'produccion'],
  ['/operarios', 'personal'],
  ['/anticipos', 'personal'],
  ['/liquidacion', 'personal'],
  ['/rendicion', 'personal'],
  ['/compras', 'compras'],
  ['/inventario', 'compras'],
  ['/cuentas-por-pagar', 'compras'],
  ['/ventas', 'ventas'],
  ['/cuentas-por-cobrar', 'ventas'],
  ['/costos-fijos', 'finanzas'],
  ['/productos', 'costos'],
  ['/costos', 'costos'],
  ['/tablero', 'finanzas'],
  ['/mi-plata', 'finanzas'],
  ['/reportes', 'finanzas'],
  ['/caja', 'finanzas'],
  ['/configuracion', 'sistema'],
];
const areaDeRuta = (ruta: string): ClaveArea | null =>
  RUTAS_AREA.filter(([p]) => ruta === p || ruta.startsWith(`${p}/`)).sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
  null;

function ItemMenu({
  a,
  icono,
  children,
  badge,
  area,
}: {
  a: string;
  icono: ReactNode;
  children: ReactNode;
  badge?: string;
  area?: ClaveArea;
}) {
  const color = area ? AREAS[area].color : '#2f6fe0';
  return (
    <NavLink
      to={a}
      end={a === '/'}
      style={({ isActive }) => (isActive ? { boxShadow: `inset 3px 0 0 ${color}`, background: `${color}26` } : undefined)}
      className={({ isActive }) =>
        `flex w-full items-center gap-3 px-4 py-2 text-[13.5px] font-medium transition-colors ${
          isActive ? 'text-[#eef4ff]' : 'text-[#98a2b3] hover:text-[#cdd6e2]'
        }`
      }
    >
      {icono}
      <span>{children}</span>
      {badge && (
        <span className="ml-auto rounded-full bg-acento px-1.5 py-px text-[10px] font-semibold text-white">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

function TituloSeccion({ area }: { area: ClaveArea }) {
  const { nombre, claro } = AREAS[area];
  return (
    <div
      className="flex items-center gap-2 px-5 pt-4 pb-1.5 text-[10.5px] font-semibold tracking-widest uppercase"
      style={{ color: claro }}
    >
      <span className="h-2 w-2 rounded-sm" style={{ background: claro }} />
      {nombre}
    </div>
  );
}

export function Layout() {
  const ruta = useLocation().pathname;
  const area = areaDeRuta(ruta);
  return (
    <div className="flex h-screen w-full overflow-hidden print:block print:h-auto print:overflow-visible">
      <aside className="flex h-full w-[246px] flex-none flex-col border-r border-black/40 bg-lateral">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg bg-acento">
            <Icono d="M4 6l4-2 4 2 4-2 4 2v3l-2 1v9H6v-9l-2-1z" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Taller · Pagos</div>
            <div className="text-[11px] text-[#6b7688]">Panel administrativo</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <ItemMenu a="/" icono={<Icono d="M3 11l9-7 9 7M5 10v9h14v-9" />}>
            Inicio
          </ItemMenu>
          <ItemMenu a="/guia" icono={<Icono d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01" />}>
            Cómo se usa
          </ItemMenu>

          <TituloSeccion area="costos" />
          <ItemMenu
            area="costos"
            a="/costos"
            icono={<Icono d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3" />}
          >
            Costos de producción
          </ItemMenu>
          <ItemMenu area="costos" a="/productos" icono={<Icono d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />}>
            Catálogo de productos
          </ItemMenu>

          <TituloSeccion area="compras" />
          <ItemMenu area="compras" a="/compras" icono={<Icono d="M5 7h14l-1.5 9h-11zM9 7V5h6v2M9 20h.01M15 20h.01" />}>
            Compras y proveedores
          </ItemMenu>
          <ItemMenu area="compras" a="/inventario" icono={<Icono d="M4 8l8-4 8 4v10l-8 4-8-4zM4 8l8 4 8-4M12 12v10" />}>
            Inventario
          </ItemMenu>
          <ItemMenu area="compras" a="/cuentas-por-pagar" icono={<Icono d="M4 5h16v14H4zM4 9h16M8 14h4M15 14h1" />}>
            Cuentas por pagar
          </ItemMenu>

          <TituloSeccion area="produccion" />
          <ItemMenu area="produccion" a="/cortes" badge="central" icono={<Icono d="M3.5 4.5h17v15h-17zM3.5 9.5h17M9 9.5v10" />}>
            Cortes
          </ItemMenu>
          <ItemMenu area="produccion" a="/modelos" icono={<Icono d="M12 3l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16.5l8 4 8-4" />}>
            Modelos
          </ItemMenu>
          <ItemMenu area="produccion" a="/plantillas" icono={<Icono d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7" />}>
            Plantillas
          </ItemMenu>
          <ItemMenu area="produccion" a="/catalogo" icono={<Icono d="M4 6h16M4 12h10M4 18h6M18 12v6M15 15h6" />}>
            Catálogo de operaciones
          </ItemMenu>
          <ItemMenu area="produccion" a="/asistencia" icono={<Icono d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8.5 15l2 2 4-4" />}>
            Asistencia
          </ItemMenu>

          <TituloSeccion area="personal" />
          <ItemMenu
            area="personal"
            a="/operarios"
            icono={<Icono d="M12 11a3.2 3.2 0 1 0-3.2-3.2A3.2 3.2 0 0 0 12 11zm-6 8c0-3 2.7-4.6 6-4.6s6 1.6 6 4.6" />}
          >
            Operarios
          </ItemMenu>
          <ItemMenu area="personal" a="/anticipos" icono={<Icono d="M3 6h18v12H3zM12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z" />}>
            Anticipos
          </ItemMenu>
          <ItemMenu
            area="personal"
            a="/liquidacion"
            icono={<Icono d="M9.5 6h10M9.5 12h10M9.5 18h10M4 5.6l1.3 1.3L7.6 4.6M4 11.6l1.3 1.3 2.3-2.3M4 17.6l1.3 1.3 2.3-2.3" />}
          >
            Pagos del mes
          </ItemMenu>
          <ItemMenu area="personal" a="/rendicion" icono={<Icono d="M6 3h8l4 4v14H6zM14 3v4h4M9 12.5h6M9 16h6" />}>
            Cuenta de cada operario
          </ItemMenu>

          <TituloSeccion area="ventas" />
          <ItemMenu area="ventas" a="/ventas" icono={<Icono d="M3 7h18l-2 11H5zM8 7V5a4 4 0 0 1 8 0v2" />}>
            Ventas y cobros
          </ItemMenu>
          <ItemMenu area="ventas" a="/cuentas-por-cobrar" icono={<Icono d="M4 5h16v14H4zM4 9h16M15 14h1M8 14h4" />}>
            Cuentas por cobrar
          </ItemMenu>

          <TituloSeccion area="finanzas" />
          <ItemMenu area="finanzas" a="/mi-plata" icono={<Icono d="M12 2v20M7 7h7.5a3.5 3.5 0 0 1 0 7H8M6 18h9" />}>
            ¿Dónde está mi plata?
          </ItemMenu>
          <ItemMenu area="finanzas" a="/tablero" icono={<Icono d="M4 19V10M10 19V5M16 19v-7M22 19H2" />}>
            Tablero de dinero
          </ItemMenu>
          <ItemMenu area="finanzas" a="/caja" icono={<Icono d="M3 7h18v12H3zM3 11h18M7 15h3" />}>
            Caja
          </ItemMenu>
          <ItemMenu area="finanzas" a="/costos-fijos" icono={<Icono d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h5" />}>
            Costos fijos
          </ItemMenu>
          <ItemMenu area="finanzas" a="/reportes" icono={<Icono d="M4 20h16M7 16v-5M12 16V8M17 16v-8" />}>
            Reportes
          </ItemMenu>

          <TituloSeccion area="sistema" />
          <ItemMenu area="sistema" a="/configuracion" icono={<Icono d="M5 7h14M5 12h14M5 17h14" />}>
            Configuración
          </ItemMenu>
        </nav>

        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3.5">
          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#2a3644] text-xs font-semibold text-[#cdd6e2]">
            DT
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-[12.5px] font-medium text-[#e5e9ef]">Dueño del taller</div>
            <div className="text-[11px] text-[#6b7688]">Administrador</div>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="rounded-md p-1.5 text-[#6b7688] hover:bg-white/5 hover:text-[#cdd6e2]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </div>
      </aside>

      <main className="h-full flex-1 overflow-y-auto">
        {area && (
          <div className="print:hidden" style={{ borderTop: `3px solid ${AREAS[area].color}` }}>
            <div className="flex items-center justify-between px-8 pt-3">
              <span className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: AREAS[area].color }}>
                {AREAS[area].nombre}
              </span>
              <BotonImprimir />
            </div>
          </div>
        )}
        <Ayuda ruta={ruta} />
        {/* encabezado de cada hoja impresa */}
        <div className="hidden px-0 pb-2 text-[10px] text-gray-500 print:block">
          Taller · {area ? AREAS[area].nombre : 'Inicio'} · impreso el{' '}
          {new Date().toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </div>
        <Outlet />
      </main>
    </div>
  );
}
