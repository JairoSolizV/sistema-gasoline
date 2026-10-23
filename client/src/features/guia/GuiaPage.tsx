import { Link } from 'react-router-dom';

// Guía "Cómo se usa" (docs/PLAN_DIDACTICO_REPORTES.md): el camino del trabajo
// en el sistema, en el orden en que trabaja el taller, con palabras simples y
// un botón para ir a cada pantalla.

interface Paso {
  icono: string;
  titulo: string;
  texto: string;
  ir: { a: string; texto: string };
}

const ETAPAS: { nombre: string; color: string; pasos: Paso[] }[] = [
  {
    nombre: '1. Sacar el costo y el precio',
    color: '#D85A30',
    pasos: [
      {
        icono: '🧮',
        titulo: 'Hacer la ficha de costo',
        texto: 'Cuando llega un pedido o una idea, armás la ficha con un molde parecido: cuánta tela, hilos, cierres, bolsa y mano de obra. El sistema te da el costo y el precio de venta.',
        ir: { a: '/costos', texto: 'Costos de producción' },
      },
      {
        icono: '📋',
        titulo: 'Anotar el pedido del cliente',
        texto: 'Con el precio, anotás qué modelo, cuántas prendas y para cuándo. Queda "por hacer".',
        ir: { a: '/ventas?tab=pedidos', texto: 'Pedidos' },
      },
    ],
  },
  {
    nombre: '2. Comprar',
    color: '#BA7517',
    pasos: [
      {
        icono: '🧶',
        titulo: 'Comprar la tela y los insumos',
        texto: 'Primero la tela (jeans, popelina), después los insumos de costura (cierres, tallas, hilos) y de empaque (bolsas, tags). Si es a crédito, marcalo y poné cuándo se paga.',
        ir: { a: '/compras', texto: 'Compras' },
      },
      {
        icono: '📦',
        titulo: 'Revisar el depósito',
        texto: 'Mirá si alcanza lo que hay. De vez en cuando contá lo que hay y anotalo con "Contar".',
        ir: { a: '/inventario', texto: 'Inventario' },
      },
    ],
  },
  {
    nombre: '3. Producir',
    color: '#378ADD',
    pasos: [
      {
        icono: '✂️',
        titulo: 'Cortar',
        texto: 'Creás el corte: el modelo y cuántas prendas por talla. Queda "en mesa".',
        ir: { a: '/cortes/nuevo', texto: 'Nuevo corte' },
      },
      {
        icono: '🧵',
        titulo: 'Repartir la costura',
        texto: 'Abrís el corte y repartís cada operación entre las costureras. Tocá "Pasó a costura".',
        ir: { a: '/cortes', texto: 'Cortes' },
      },
      {
        icono: '🫧',
        titulo: 'Lavandería y empaque',
        texto: 'Cuando las prendas van a la lavandería o al empaque, tocá el botón "Pasó a…" del corte. Así siempre sabés dónde está cada cosa.',
        ir: { a: '/mi-plata', texto: '¿Dónde está mi plata?' },
      },
    ],
  },
  {
    nombre: '4. Pagar al personal',
    color: '#1D9E75',
    pasos: [
      {
        icono: '💵',
        titulo: 'Anticipos de la semana',
        texto: 'Lo que le das a cada uno en la semana (por ejemplo Bs 400). Se descuenta al final del mes.',
        ir: { a: '/anticipos', texto: 'Anticipos' },
      },
      {
        icono: '🗓️',
        titulo: 'Pagos del mes',
        texto: 'A fin de mes ves cuánto ganó cada uno, cuánto se le adelantó y cuánto falta pagarle. Imprimís la cuenta de cada operario para que la firme.',
        ir: { a: '/liquidacion', texto: 'Pagos del mes' },
      },
    ],
  },
  {
    nombre: '5. Vender y cobrar',
    color: '#7F77DD',
    pasos: [
      {
        icono: '🚚',
        titulo: 'Entregar (despachar)',
        texto: 'Anotás lo que llevás al cliente, en docenas. Queda lo que te debe y para cuándo.',
        ir: { a: '/ventas?tab=despachos', texto: 'Despachos' },
      },
      {
        icono: '💰',
        titulo: 'Cobrar',
        texto: 'Cuando te pagan, anotás el cobro (efectivo o banco). Lo vencido aparece en rojo.',
        ir: { a: '/cuentas-por-cobrar', texto: 'Cuentas por cobrar' },
      },
    ],
  },
  {
    nombre: '6. Ver cómo va la plata',
    color: '#639922',
    pasos: [
      {
        icono: '🧭',
        titulo: '¿Dónde está mi plata?',
        texto: 'El camino completo: cuánto está puesto en cada paso y cuánto falta para terminar.',
        ir: { a: '/mi-plata', texto: '¿Dónde está mi plata?' },
      },
      {
        icono: '👛',
        titulo: 'La caja',
        texto: 'Cuánto hay en efectivo y en el banco, y en qué se fue. Anotá a mano la luz, el agua, el transporte.',
        ir: { a: '/caja', texto: 'Caja' },
      },
      {
        icono: '📊',
        titulo: 'Reportes',
        texto: 'Ventas, producción, compras y qué modelos dejan más ganancia, para decidir qué hacer el mes que viene.',
        ir: { a: '/reportes', texto: 'Reportes' },
      },
    ],
  },
];

export function GuiaPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Cómo se usa el sistema</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">
        El camino del trabajo, en el mismo orden en que se hace en el taller. Cada paso dice qué hacer y tiene un botón para
        ir a esa pantalla. En cada pantalla también hay un recuadro azul que explica para qué sirve.
      </p>
      <div className="mt-6 space-y-6">
        {ETAPAS.map((e) => (
          <section key={e.nombre}>
            <h2 className="mb-2 text-base font-semibold" style={{ color: e.color }}>
              {e.nombre}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {e.pasos.map((p) => (
                <div
                  key={p.titulo}
                  className="flex break-inside-avoid flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  style={{ borderLeft: `4px solid ${e.color}`, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden="true">
                      {p.icono}
                    </span>
                    <span className="font-semibold">{p.titulo}</span>
                  </div>
                  <p className="mt-1 flex-1 text-sm text-gray-700">{p.texto}</p>
                  <Link to={p.ir.a} className="mt-2 text-sm font-semibold text-acento hover:underline print:hidden">
                    Ir a {p.ir.texto} ›
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
