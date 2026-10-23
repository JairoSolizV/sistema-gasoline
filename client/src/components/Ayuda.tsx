import { useState } from 'react';
import { Link } from 'react-router-dom';

// Ayuda de cada pantalla en palabras de todos los días (docs/PLAN_DIDACTICO_REPORTES.md):
// para qué sirve, qué se hace ahí y un ejemplo. Se muestra arriba de la página;
// "Entendido" la oculta (se recuerda) y el botón "?" la vuelve a mostrar.

interface TextoAyuda {
  titulo: string;
  sirve: string;
  pasos: string[];
  ejemplo?: string;
}

const AYUDAS: Record<string, TextoAyuda> = {
  '/': {
    titulo: 'Inicio',
    sirve: 'Es el resumen del día: cuánto hay que pagar en cada tipo de trabajo, qué cortes están en producción y los avisos importantes.',
    pasos: ['Mirá los avisos en rojo primero: son cosas que ya vencieron.', 'Tocá una fila de cuentas para ver el detalle de esos pagos.'],
  },
  '/costos': {
    titulo: 'Costos de producción',
    sirve: 'Para saber cuánto cuesta hacer una prenda y a cuánto venderla. Es lo primero que se hace cuando llega un pedido o una idea.',
    pasos: [
      'Creá una "ficha de costo" por modelo: tela, hilos, cierres, botones, bolsa y la mano de obra.',
      'El sistema suma todo y te da el costo por prenda y el precio de venta.',
    ],
    ejemplo: 'Un jean: tela Bs 38 + hilos y cierre Bs 2 + costura Bs 6 + gastos del taller Bs 21 = Bs 67; con 30 % de ganancia se vende a Bs 87.',
  },
  '/productos': {
    titulo: 'Catálogo de productos',
    sirve: 'Tus modelos con foto, tallas, colores y precio por docena, para mostrarle o imprimirle al cliente.',
    pasos: ['Tocá "Editar" para subir la foto (se puede sacar con el celular).', 'Dejá "Mostrar costos" apagado cuando lo mire un cliente.'],
  },
  '/compras': {
    titulo: 'Compras y proveedores',
    sirve: 'Para anotar todo lo que comprás para producir: primero la tela (materia prima) y después los insumos de costura y empaque.',
    pasos: [
      'Cada compra: qué, cuánto, cuánto pagaste y para qué corte.',
      'Si la pagás después (como la tela de la señora Nancy), marcala "a crédito" con la fecha de pago.',
    ],
  },
  '/inventario': {
    titulo: 'Inventario',
    sirve: 'Para saber qué hay en el depósito: telas, insumos y prendas terminadas, y cuánto vale todo.',
    pasos: [
      'Cada tanto, contá lo que hay y anotalo con "Contar": así el sistema corrige lo que no cuadra.',
      '"Historial" muestra cada entrada (compras) y salida (cortes) de un material.',
    ],
  },
  '/cuentas-por-pagar': {
    titulo: 'Cuentas por pagar',
    sirve: 'Todo lo que debés, ordenado por fecha: proveedores, lavandería, operarios y el banco.',
    pasos: ['Arriba ves lo que ya venció (rojo) y lo que vence esta semana (amarillo).', '"Pagar" te lleva adonde se anota ese pago.'],
  },
  '/cortes': {
    titulo: 'Cortes',
    sirve: 'Cada corte es un lote de prendas de un modelo. Acá se anota qué se cortó y quién cose cada operación.',
    pasos: [
      '"+ Nuevo corte": el modelo y cuántas prendas por talla.',
      'Abrilo y repartí las operaciones entre las costureras.',
      'Marcá dónde está (en mesa, costura, lavandería, empaque, depósito) con el botón "Pasó a…".',
      'Cuando todo está cosido, se cierra y se paga la costura.',
    ],
  },
  '/modelos': {
    titulo: 'Modelos',
    sirve: 'La lista de operaciones de cada prenda (pegar bolsillo, cerrar costado…) y cuánto se paga por cada una.',
    pasos: ['Si cambiás algo de un modelo, se crea una "versión" nueva: los cortes viejos no cambian.'],
  },
  '/plantillas': {
    titulo: 'Plantillas',
    sirve: 'Grupos de operaciones que se repiten (por ejemplo, "delanteros") para armar modelos más rápido.',
    pasos: ['Armá una plantilla una vez y usala en todos los modelos parecidos.'],
  },
  '/catalogo': {
    titulo: 'Catálogo de operaciones',
    sirve: 'Las máquinas, procesos y piezas que se usan para nombrar las operaciones.',
    pasos: ['Se usa al armar modelos y plantillas; casi no hace falta tocarlo.'],
  },
  '/asistencia': {
    titulo: 'Asistencia',
    sirve: 'Para marcar qué días vino cada ayudante: con eso se calcula su sueldo de la semana.',
    pasos: ['Marcá cada día. Para cerrar el mes, la asistencia tiene que estar completa.'],
  },
  '/operarios': {
    titulo: 'Operarios',
    sirve: 'La lista de las personas que trabajan en el taller y de los servicios de afuera (lavandería, bordado…).',
    pasos: ['"+ Nuevo operario" para agregar a alguien. Si alguien se va, se le da de baja (no se borra).'],
  },
  '/anticipos': {
    titulo: 'Anticipos',
    sirve: 'Lo que le adelantás a cada operario en la semana (por ejemplo Bs 400). Se descuenta cuando se le paga el mes.',
    pasos: ['Anotá cada anticipo el mismo día que lo das.'],
  },
  '/liquidacion': {
    titulo: 'Pagos del mes (liquidación)',
    sirve: 'Cuánto ganó cada persona en el mes, cuánto se le adelantó y cuánto falta pagarle.',
    pasos: ['Revisá cada pestaña (operaciones, empaque, lavandería…).', 'Al final del mes, "Liquidar mes" deja todo pagado.'],
    ejemplo: 'Ganó Bs 1 200, se le adelantó Bs 800 (2 semanas de 400): falta pagarle Bs 400.',
  },
  '/rendicion': {
    titulo: 'Cuenta de cada operario',
    sirve: 'La hoja de una sola persona: lo que hizo, lo que ganó y lo que se le dio. Para imprimirle y que la firme.',
    pasos: ['Elegí a la persona y el mes, y tocá "Imprimir".'],
  },
  '/ventas': {
    titulo: 'Ventas y cobros',
    sirve: 'Tus clientes, lo que te encargan (pedidos), lo que les entregás (despachos) y lo que te pagan (cobros).',
    pasos: [
      'Pedido: lo que te encargaron, al precio de la docena en dólares.',
      'Despacho: lo que llevaste, en docenas, con el tipo de cambio de ese día.',
      'Cobro: la plata que te dieron. Si fue en dólares, entra a la caja de dólares; si fue en Bs, a efectivo o banco.',
    ],
    ejemplo: '10 docenas a $us 30 la docena = $us 300. Si ese día el dólar está a 6.96, son Bs 2 088.',
  },
  '/cuentas-por-cobrar': {
    titulo: 'Cuentas por cobrar',
    sirve: 'Lo que te deben tus clientes en dólares, despacho por despacho, y cuándo te lo tienen que pagar.',
    pasos: ['Lo rojo ya venció: hay que llamar al cliente.', '"Cobrar" anota el pago de ese cliente.'],
  },
  '/mi-plata': {
    titulo: '¿Dónde está mi plata?',
    sirve: 'El camino de tus prendas del pedido al cobro: en cada paso, cuánta plata ya pusiste, cuánta falta para terminar y cuánto vale.',
    pasos: [
      'Tocá un paso (por ejemplo "En costura") para ver sus cortes.',
      'El semáforo dice si un corte está tardando más de lo normal.',
    ],
  },
  '/tablero': {
    titulo: 'Tablero de dinero',
    sirve: 'Lo que tenés (telas, prendas, lo que te deben) frente a lo que debés, y el resultado del mes.',
    pasos: ['"Te queda" es lo que queda del mes después de pagar todo, incluido el banco.'],
  },
  '/caja': {
    titulo: 'Caja',
    sirve: 'Cuánta plata hay en efectivo, en el banco y en dólares, y en qué se gasta.',
    pasos: [
      'Lo que anotás en otras pantallas (cobros, compras, anticipos) entra solo.',
      'Los cobros en dólares entran a la caja de dólares y de ahí se le paga la tela a Nancy.',
      '"Cambiar dólares": lo que cambiás a bolivianos sale de dólares y entra al efectivo.',
      'A mano solo va lo demás: luz, agua, transporte, retiros para la casa.',
      '"Contar la plata" (arqueo): contás el efectivo y el sistema dice si sobra o falta.',
    ],
  },
  '/costos-fijos': {
    titulo: 'Costos fijos',
    sirve: 'Lo que cuesta mantener el taller cada mes aunque no se produzca nada: sueldo de ustedes, luz, agua, comida, máquinas, banco.',
    pasos: ['Se reparte entre las prendas del mes y se suma al costo de cada ficha.'],
  },
  '/reportes': {
    titulo: 'Reportes',
    sirve: 'Para mirar cómo te fue mes a mes: ventas, producción, compras y qué modelos te dejan más ganancia.',
    pasos: ['Elegí desde qué mes hasta qué mes.', 'Cambiá de pestaña para ver otro reporte, e imprimilo con el botón de arriba.'],
  },
  '/guia': {
    titulo: 'Cómo se usa',
    sirve: 'El camino del trabajo en el sistema, en el orden en que se hace en el taller.',
    pasos: ['Cada paso tiene un botón para ir a esa pantalla.'],
  },
  '/configuracion': {
    titulo: 'Configuración',
    sirve: 'Los datos generales del taller: tarifas, margen de ganancia, tipo de cambio del dólar…',
    pasos: ['Cambialos solo si estás seguro: afectan los cálculos nuevos.'],
  },
};

const ayudaDe = (ruta: string) => {
  const clave = Object.keys(AYUDAS)
    .filter((k) => ruta === k || (k !== '/' && ruta.startsWith(`${k}/`)))
    .sort((a, b) => b.length - a.length)[0];
  return clave ? { clave, ...AYUDAS[clave] } : null;
};

const CLAVE = 'taller_ayudas_ocultas';
const leerOcultas = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
  } catch {
    return [];
  }
};

export function Ayuda({ ruta }: { ruta: string }) {
  const ayuda = ayudaDe(ruta);
  const [ocultas, setOcultas] = useState<string[]>(leerOcultas);
  if (!ayuda) return null;
  const oculta = ocultas.includes(ayuda.clave);
  const guardar = (lista: string[]) => {
    setOcultas(lista);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch {
      // sin almacenamiento: se oculta solo por ahora
    }
  };

  if (oculta) {
    return (
      <div className="px-8 pt-2 print:hidden">
        <button
          onClick={() => guardar(ocultas.filter((x) => x !== ayuda.clave))}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-acento"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white font-bold">?</span>
          ¿Para qué sirve esta pantalla?
        </button>
      </div>
    );
  }
  return (
    <div className="mx-8 mt-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 print:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">💡 ¿Para qué sirve «{ayuda.titulo}»?</div>
          <p className="mt-0.5">{ayuda.sirve}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {ayuda.pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {ayuda.ejemplo && <p className="mt-1 text-xs text-sky-800">Ejemplo: {ayuda.ejemplo}</p>}
          <Link to="/guia" className="mt-1 inline-block text-xs font-semibold text-acento hover:underline">
            Ver la guía completa: cómo se usa el sistema paso a paso ›
          </Link>
        </div>
        <button
          onClick={() => guardar([...ocultas, ayuda.clave])}
          className="flex-none rounded-lg border border-sky-300 bg-white px-3 py-1 text-xs font-medium hover:bg-sky-100"
        >
          Entendido, ocultar
        </button>
      </div>
    </div>
  );
}
