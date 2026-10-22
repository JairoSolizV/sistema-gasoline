/** Marca de una operación de empaque: se paga por prenda como la costura, pero
 *  su costo se informa aparte (docs/PLAN_AYUDANTES.md §2.10). */
export function MarcaEmpaque() {
  return (
    <span
      title="Operación de empaque: su costo se muestra aparte de la costura"
      className="ml-2 inline-block rounded-full border border-violet-300 bg-violet-50 px-1.5 py-px text-[10px] font-semibold text-violet-700"
    >
      empaque
    </span>
  );
}
