import { NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { logout } from '../api/auth';

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

function ItemMenu({
  a,
  icono,
  children,
  badge,
}: {
  a: string;
  icono: ReactNode;
  children: ReactNode;
  badge?: string;
}) {
  return (
    <NavLink
      to={a}
      className={({ isActive }) =>
        `flex w-full items-center gap-3 px-4 py-2.5 text-[13.5px] font-medium transition-colors ${
          isActive
            ? 'bg-[rgba(47,111,224,0.14)] text-[#eef4ff] shadow-[inset_3px_0_0_#2f6fe0]'
            : 'text-[#98a2b3] hover:text-[#cdd6e2]'
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

function TituloSeccion({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 pt-4 pb-2 text-[10.5px] font-semibold tracking-widest text-[#5a6473] uppercase">
      {children}
    </div>
  );
}

export function Layout() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
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
          <TituloSeccion>General</TituloSeccion>
          <ItemMenu a="/" icono={<Icono d="M3 11l9-7 9 7M5 10v9h14v-9" />}>
            Inicio
          </ItemMenu>
          <ItemMenu
            a="/operarios"
            icono={<Icono d="M12 11a3.2 3.2 0 1 0-3.2-3.2A3.2 3.2 0 0 0 12 11zm-6 8c0-3 2.7-4.6 6-4.6s6 1.6 6 4.6" />}
          >
            Operarios
          </ItemMenu>
          <ItemMenu a="/modelos" icono={<Icono d="M12 3l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 16.5l8 4 8-4" />}>
            Modelos
          </ItemMenu>

          <TituloSeccion>Producción</TituloSeccion>
          <ItemMenu a="/cortes" badge="central" icono={<Icono d="M3.5 4.5h17v15h-17zM3.5 9.5h17M9 9.5v10" />}>
            Cortes
          </ItemMenu>
          <ItemMenu a="/anticipos" icono={<Icono d="M3 6h18v12H3zM12 9.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z" />}>
            Anticipos
          </ItemMenu>
          <ItemMenu
            a="/liquidacion"
            icono={<Icono d="M9.5 6h10M9.5 12h10M9.5 18h10M4 5.6l1.3 1.3L7.6 4.6M4 11.6l1.3 1.3 2.3-2.3M4 17.6l1.3 1.3 2.3-2.3" />}
          >
            Liquidación
          </ItemMenu>
          <ItemMenu a="/rendicion" icono={<Icono d="M6 3h8l4 4v14H6zM14 3v4h4M9 12.5h6M9 16h6" />}>
            Rendición de cuentas
          </ItemMenu>

          <TituloSeccion>Sistema</TituloSeccion>
          <ItemMenu a="/configuracion" icono={<Icono d="M5 7h14M5 12h14M5 17h14" />}>
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
        <Outlet />
      </main>
    </div>
  );
}
