import type { ReactNode } from 'react';

// Base de las hojas imprimibles en papel OFICIO vertical (21.5 × 33 cm).
// Solo se ve al imprimir (hidden print:block); la vista de pantalla de la
// página debe llevar print:hidden.
//
// Columnas "ajustadas": el contenido se encoge a su ancho natural (contenedor
// display:table centrado) en vez de estirarse a toda la hoja, así no quedan
// huecos entre columnas cortas. Filas compactas: a 10pt cada fila mide ~0.55 cm
// y el alto útil es ~30.8 cm (≈ 50 filas por hoja).
//
// El @page va en un <style> que solo existe mientras la hoja está montada:
// no cambia el tamaño de papel de otras impresiones (Liquidación, Rendición).
const CSS_HOJA = `
@page { size: 21.5cm 33cm; margin: 1.2cm 1.2cm 1cm; }
.hoja-oficio { color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.hoja-oficio .contenido { display: table; margin: 0 auto; }
.hoja-oficio table { width: 100%; border-collapse: collapse; margin-top: 8pt; }
.hoja-oficio th, .hoja-oficio td { padding: 1.2pt 7pt; line-height: 1.2; border-bottom: 0.5pt solid #bbb; white-space: nowrap; text-align: left; }
.hoja-oficio thead th { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1pt solid #000; }
.hoja-oficio thead { display: table-header-group; }
.hoja-oficio .num { text-align: right; font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
.hoja-oficio .tenue { color: #555; }
.hoja-oficio tr.grupo td { background: #e9ecf1; font-weight: 600; border-top: 1pt solid #000; padding-top: 2.5pt; }
.hoja-oficio tr { break-inside: avoid; }
.hoja-oficio tfoot td { border-top: 1.5pt solid #000; border-bottom: none; font-weight: 700; padding-top: 3pt; }
/* variante para tablas anchas (muchas columnas): celdas más angostas */
.hoja-oficio.angosta th, .hoja-oficio.angosta td { padding-left: 5pt; padding-right: 5pt; }
.hoja-oficio td.envolver { white-space: normal; max-width: 4cm; }
`;

export function HojaOficio({
  titulo,
  detalle,
  resumen,
  tamanoLetra = '10pt',
  className = '',
  children,
}: {
  titulo: string;
  detalle?: string | null; // línea chica bajo el título
  resumen: string; // texto a la derecha, ej. "36 operarios"
  tamanoLetra?: string;
  className?: string; // variantes propias de cada hoja (ver CSS_HOJA)
  children: ReactNode; // la <table>
}) {
  const fecha = new Date().toLocaleDateString('es-BO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className={`hoja-oficio hidden print:block ${className}`} style={{ fontSize: tamanoLetra }}>
      <style>{CSS_HOJA}</style>
      <div className="contenido">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '24pt' }}
        >
          <div>
            <div style={{ fontSize: '14pt', fontWeight: 700 }}>{titulo}</div>
            {detalle && <div style={{ fontSize: '9pt' }}>{detalle}</div>}
          </div>
          <div style={{ fontSize: '9pt', textAlign: 'right' }}>
            {resumen} · impreso {fecha}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
