export function EnConstruccion({ titulo, nota }: { titulo: string; nota: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">{titulo}</h1>
      <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        En construcción · {nota}
      </div>
    </div>
  );
}
