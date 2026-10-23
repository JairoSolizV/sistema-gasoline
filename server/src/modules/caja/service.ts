// Caja (docs/PLAN_CAJA.md): efectivo y banco. Lo que ya se registra (cobros,
// compras al contado, pagos a proveedores, comida, cuota del banco, anticipos,
// lo pagado al cerrar el mes) entra solo; lo demás se anota a mano. El arqueo
// deja la diferencia con lo contado como ajuste. NO toca ningún pago.
import type { Caja } from '@prisma/client';
import {
  CAJAS,
  dateADia,
  diaADate,
  ETIQUETA_CAJA,
  ETIQUETA_CUENTA,
  SERVICIOS_EXTERNOS,
  type ArqueoInput,
  type CajaMesDTO,
  type CategoriaCajaDTO,
  type CategoriaCajaInput,
  type Cuenta,
  type EditarCategoriaCajaInput,
  type InicioCajaInput,
  type MovimientoCajaDTO,
  type MovimientoCajaInput,
  type OrigenCaja,
  type ResumenCajaDTO,
} from '@taller/shared';
import { diaEnBolivia } from '../../lib/hoy.js';
import { AppError } from '../../middleware/errors.js';
import { cajaRepository } from './repository.js';

/** Día siguiente ('aaaa-mm-dd'). */
const sumarDias = (dia: string, n: number) => {
  const d = diaADate(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return dateADia(d);
};
const primerDia = (anio: number, mes: number) => dateADia(new Date(Date.UTC(anio, mes - 1, 1)));
const signo = (m: MovimientoCajaDTO) => (m.tipo === 'ingreso' ? m.monto : -m.monto);
const externas = new Set<Cuenta>(SERVICIOS_EXTERNOS);

// categoría de las compras de un gasto fijo "por compras", según su grupo
const CLAVE_GRUPO: Record<string, string> = {
  personal: 'comida',
  operativos: 'transporte',
  servicios: 'servicios_basicos',
  maquinas: 'maquinas',
  impuestos: 'impuestos',
  otros: 'otros_egreso',
};

const aCategoriaDTO = (c: Awaited<ReturnType<typeof cajaRepository.categorias>>[number]): CategoriaCajaDTO => ({
  id: c.id,
  nombre: c.nombre,
  tipo: c.tipo,
  clave: c.clave,
  activo: c.activo,
});

/** Todos los movimientos de las dos cajas con fecha en [desde, hasta). */
async function movimientos(desde: string, hasta: string): Promise<MovimientoCajaDTO[]> {
  const rango = { gte: diaADate(desde), lt: diaADate(hasta) };
  // instantes (anticipos, cierre de mes): un día de margen y se filtra por día de Bolivia
  const amplio = { gte: diaADate(sumarDias(desde, -1)), lt: diaADate(sumarDias(hasta, 1)) };
  const enRango = (dia: string) => dia >= desde && dia < hasta;
  const [categorias, cobros, pagos, compras, comprasGasto, cuotas, anticipos, cierres, manuales, arqueos] =
    await Promise.all([
      cajaRepository.categorias(),
      cajaRepository.cobros(rango),
      cajaRepository.pagosProveedor(rango),
      cajaRepository.comprasContado(rango),
      cajaRepository.comprasGasto(rango),
      cajaRepository.pagosPrestamo(rango),
      cajaRepository.anticipos(amplio),
      cajaRepository.pagosCierre(amplio),
      cajaRepository.manuales(rango),
      cajaRepository.arqueos(rango),
    ]);
  const cat = (clave: string) => {
    const c = categorias.find((x) => x.clave === clave);
    return c ? { id: c.id, nombre: c.nombre } : null;
  };
  const deCuenta = (cuenta: Cuenta) => cat(externas.has(cuenta) ? 'servicios_externos' : 'operarios');
  const auto = (
    origen: OrigenCaja,
    r: { id: string; caja: Caja },
    fecha: string,
    tipo: 'ingreso' | 'egreso',
    clave: string | null,
    descripcion: string,
    monto: number,
    categoria = clave ? cat(clave) : null,
  ): MovimientoCajaDTO => ({ id: `${origen}:${r.id}`, origen, origenId: r.id, caja: r.caja, fecha, tipo, categoria, descripcion, monto });

  const lista: MovimientoCajaDTO[] = [
    ...cobros.map((c) => auto('cobro', c, dateADia(c.fecha), 'ingreso', 'cobros', `Cobro a ${c.cliente.nombre}${c.nota ? ` · ${c.nota}` : ''}`, c.monto)),
    ...pagos.map((p) => auto('pago_proveedor', p, dateADia(p.fecha), 'egreso', 'insumos', `Pago a ${p.proveedor}${p.nota ? ` · ${p.nota}` : ''}`, p.monto)),
    ...compras.map((c) =>
      auto('compra', c, dateADia(c.fecha), 'egreso', 'insumos', `${c.insumo.nombre} · ${c.tienda}${c.codigoCorte ? ` · COD ${c.codigoCorte}` : ''}`, c.precioTotal),
    ),
    ...comprasGasto.map((c) =>
      auto('compra_gasto', c, dateADia(c.fecha), 'egreso', CLAVE_GRUPO[c.gasto.grupo] ?? 'otros_egreso', `${c.gasto.nombre}${c.nota ? ` · ${c.nota}` : ''}`, c.monto),
    ),
    ...cuotas.map((p) => auto('pago_prestamo', p, dateADia(p.fecha), 'egreso', 'banco', `Cuota ${p.prestamo.banco} ${p.mes}/${p.anio}`, p.monto)),
    ...anticipos
      .filter((a) => enRango(diaEnBolivia(a.fecha)))
      .map((a) =>
        auto('anticipo', a, diaEnBolivia(a.fecha), 'egreso', null, `Anticipo a ${a.operario.nombre} (${ETIQUETA_CUENTA[a.cuenta].toLowerCase()})`, a.monto, deCuenta(a.cuenta)),
      ),
  ];

  // lo pagado al cerrar cada mes, del efectivo: un renglón por mes y por categoría
  const porCierre = new Map<string, MovimientoCajaDTO>();
  for (const l of cierres) {
    const dia = diaEnBolivia(l.periodo.fechaCierre!);
    if (!enRango(dia)) continue;
    const externo = externas.has(l.cuenta);
    const k = `${l.periodo.id}:${externo ? 'ext' : 'int'}`;
    const m = porCierre.get(k) ?? {
      id: `liquidacion:${k}`,
      origen: 'liquidacion' as const,
      origenId: l.periodo.id,
      caja: 'efectivo' as const,
      fecha: dia,
      tipo: 'egreso' as const,
      categoria: deCuenta(l.cuenta),
      descripcion: `Pago del cierre de ${l.periodo.mes}/${l.periodo.anio} · ${externo ? 'servicios externos' : 'operarios'}`,
      monto: 0,
    };
    m.monto += l.pagado;
    porCierre.set(k, m);
  }
  lista.push(...porCierre.values());

  for (const m of manuales) {
    const fecha = dateADia(m.fecha);
    if (m.tipo === 'transferencia') {
      const base = { origen: 'transferencia' as const, origenId: m.id, fecha, categoria: null, monto: m.monto };
      lista.push(
        { ...base, id: `transferencia:${m.id}:sale`, caja: m.caja, tipo: 'egreso', descripcion: `${m.descripcion} (a ${ETIQUETA_CAJA[m.cajaDestino!].toLowerCase()})` },
        { ...base, id: `transferencia:${m.id}:entra`, caja: m.cajaDestino!, tipo: 'ingreso', descripcion: `${m.descripcion} (de ${ETIQUETA_CAJA[m.caja].toLowerCase()})` },
      );
    } else {
      lista.push({
        id: `manual:${m.id}`,
        origen: 'manual',
        origenId: m.id,
        caja: m.caja,
        fecha,
        tipo: m.tipo,
        categoria: m.categoria,
        descripcion: m.descripcion,
        monto: m.monto,
      });
    }
  }
  for (const a of arqueos) {
    if (a.diferencia === 0) continue;
    lista.push({
      id: `arqueo:${a.id}`,
      origen: 'arqueo',
      origenId: a.id,
      caja: a.caja,
      fecha: dateADia(a.fecha),
      tipo: a.diferencia > 0 ? 'ingreso' : 'egreso',
      categoria: null,
      descripcion: `Arqueo: ${a.diferencia > 0 ? 'sobrante' : 'faltante'}${a.nota ? ` · ${a.nota}` : ''}`,
      monto: Math.abs(a.diferencia),
    });
  }
  return lista.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id));
}

async function inicioDe(caja: Caja) {
  return (await cajaRepository.inicios()).find((i) => i.caja === caja) ?? null;
}

/** Saldo de una caja al final del día indicado (incluye arqueos anteriores). */
async function saldoAl(caja: Caja, dia: string): Promise<number> {
  const inicio = await inicioDe(caja);
  if (!inicio) throw new AppError('CAJA_SIN_INICIO', `Configurá primero el inicio de la caja ${ETIQUETA_CAJA[caja].toLowerCase()}`, 409);
  const desde = dateADia(inicio.desde);
  if (dia < desde) throw new AppError('VALIDACION', `La caja empieza el ${desde.split('-').reverse().join('/')}`, 400);
  const movs = await movimientos(desde, sumarDias(dia, 1));
  return inicio.saldoInicial + movs.filter((m) => m.caja === caja).reduce((a, m) => a + signo(m), 0);
}

export const cajaService = {
  async mes(anio: number, mes: number): Promise<CajaMesDTO> {
    const inicioMes = primerDia(anio, mes);
    const finMes = mes === 12 ? primerDia(anio + 1, 1) : primerDia(anio, mes + 1);
    const [inicios, categorias] = await Promise.all([cajaRepository.inicios(), cajaRepository.categorias()]);
    const desdeMin = inicios.map((i) => dateADia(i.desde)).sort()[0] ?? inicioMes;
    const todos = await movimientos(desdeMin < inicioMes ? desdeMin : inicioMes, finMes);

    const cajas: ResumenCajaDTO[] = [];
    const delMes: MovimientoCajaDTO[] = [];
    for (const caja of CAJAS) {
      const inicio = inicios.find((i) => i.caja === caja);
      if (!inicio) {
        cajas.push({ caja, configurada: false, desde: null, saldoInicial: 0, saldoInicioMes: 0, ingresos: 0, egresos: 0, ajustes: 0, saldoFinal: 0, ultimoArqueo: null });
        continue;
      }
      const desde = dateADia(inicio.desde);
      const propios = todos.filter((m) => m.caja === caja && m.fecha >= desde);
      const desdeMes = desde > inicioMes ? desde : inicioMes;
      const antes = propios.filter((m) => m.fecha < desdeMes);
      const enMes = propios.filter((m) => m.fecha >= desdeMes && m.fecha < finMes);
      delMes.push(...enMes);
      const saldoInicioMes = desde >= finMes ? 0 : inicio.saldoInicial + antes.reduce((a, m) => a + signo(m), 0);
      const normales = enMes.filter((m) => m.origen !== 'arqueo');
      const ingresos = normales.filter((m) => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0);
      const egresos = normales.filter((m) => m.tipo === 'egreso').reduce((a, m) => a + m.monto, 0);
      const ajustes = enMes.filter((m) => m.origen === 'arqueo').reduce((a, m) => a + signo(m), 0);
      const arqueo = await cajaRepository.ultimoArqueo(caja, diaADate(finMes));
      cajas.push({
        caja,
        configurada: true,
        desde,
        saldoInicial: inicio.saldoInicial,
        saldoInicioMes,
        ingresos,
        egresos,
        ajustes,
        saldoFinal: saldoInicioMes + ingresos - egresos + ajustes,
        ultimoArqueo: arqueo && { fecha: dateADia(arqueo.fecha), contado: arqueo.contado, diferencia: arqueo.diferencia },
      });
    }

    // por categoría: sin transferencias ni arqueos (no son gastos ni ingresos)
    const porCategoria = new Map<string, CajaMesDTO['porCategoria'][number]>();
    for (const m of delMes) {
      if (!m.categoria) continue;
      const k = `${m.tipo}:${m.categoria.id}`;
      const x = porCategoria.get(k) ?? { categoria: m.categoria, tipo: m.tipo, monto: 0 };
      x.monto += m.monto;
      porCategoria.set(k, x);
    }
    return {
      anio,
      mes,
      cajas,
      porCategoria: [...porCategoria.values()].sort((a, b) => b.monto - a.monto),
      movimientos: delMes.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id)),
      categorias: categorias.map(aCategoriaDTO),
    };
  },

  async guardarInicio(caja: Caja, input: InicioCajaInput): Promise<void> {
    await cajaRepository.guardarInicio(caja, diaADate(input.desde), input.saldoInicial);
  },

  async crearMovimiento(input: MovimientoCajaInput): Promise<void> {
    const inicio = await inicioDe(input.caja);
    if (!inicio) throw new AppError('CAJA_SIN_INICIO', 'Configurá primero el inicio de la caja', 409);
    if (input.fecha < dateADia(inicio.desde)) {
      throw new AppError('VALIDACION', 'La fecha es anterior al inicio de la caja', 400);
    }
    if (input.tipo !== 'transferencia') {
      const c = await cajaRepository.obtenerCategoria(input.categoriaId!);
      if (!c || !c.activo) throw new AppError('NO_ENCONTRADO', 'Categoría no encontrada', 404);
      if (c.tipo !== input.tipo) {
        throw new AppError('VALIDACION', `"${c.nombre}" es una categoría de ${c.tipo === 'ingreso' ? 'ingresos' : 'gastos'}`, 400);
      }
    }
    await cajaRepository.crearMovimiento({
      tipo: input.tipo,
      caja: input.caja,
      cajaDestino: input.tipo === 'transferencia' ? input.cajaDestino! : null,
      fecha: diaADate(input.fecha),
      monto: input.monto,
      categoriaId: input.tipo === 'transferencia' ? null : input.categoriaId!,
      descripcion: input.descripcion,
    });
  },

  async eliminarMovimiento(id: string): Promise<void> {
    if (!(await cajaRepository.obtenerMovimiento(id))) throw new AppError('NO_ENCONTRADO', 'Movimiento no encontrado', 404);
    await cajaRepository.eliminarMovimiento(id);
  },

  async cambiarCaja(origen: OrigenCaja, id: string, caja: Caja): Promise<void> {
    if (!(await cajaRepository.cambiarCaja(origen, id, caja))) {
      throw new AppError('NO_ENCONTRADO', 'Registro no encontrado', 404);
    }
  },

  /** Guarda lo contado, lo que decía el sistema y la diferencia. */
  async crearArqueo(input: ArqueoInput): Promise<{ sistema: number; diferencia: number }> {
    const sistema = await saldoAl(input.caja, input.fecha);
    const diferencia = input.contado - sistema;
    await cajaRepository.crearArqueo({
      caja: input.caja,
      fecha: diaADate(input.fecha),
      contado: input.contado,
      sistema,
      diferencia,
      nota: input.nota ?? null,
    });
    return { sistema, diferencia };
  },

  async eliminarArqueo(id: string): Promise<void> {
    if (!(await cajaRepository.obtenerArqueo(id))) throw new AppError('NO_ENCONTRADO', 'Arqueo no encontrado', 404);
    await cajaRepository.eliminarArqueo(id);
  },

  async crearCategoria(input: CategoriaCajaInput): Promise<CategoriaCajaDTO> {
    if (await cajaRepository.categoriaPorNombre(input.nombre)) {
      throw new AppError('NOMBRE_REPETIDO', `Ya hay una categoría "${input.nombre}"`, 409);
    }
    return aCategoriaDTO(await cajaRepository.crearCategoria({ nombre: input.nombre, tipo: input.tipo, orden: 50 }));
  },

  /** Las que usa el sistema (con clave) se renombran pero no se desactivan. */
  async editarCategoria(id: string, input: EditarCategoriaCajaInput): Promise<CategoriaCajaDTO> {
    const c = await cajaRepository.obtenerCategoria(id);
    if (!c) throw new AppError('NO_ENCONTRADO', 'Categoría no encontrada', 404);
    if (input.activo === false && c.clave) {
      throw new AppError('EN_USO', `"${c.nombre}" la usa el sistema para lo que entra solo: se puede renombrar, no desactivar`, 409);
    }
    if (input.nombre) {
      const otra = await cajaRepository.categoriaPorNombre(input.nombre);
      if (otra && otra.id !== id) throw new AppError('NOMBRE_REPETIDO', `Ya hay una categoría "${input.nombre}"`, 409);
    }
    return aCategoriaDTO(await cajaRepository.actualizarCategoria(id, input));
  },
};
