export function Modal({
  children,
  onCerrar,
  ancho = 'max-w-md',
}: {
  children: React.ReactNode;
  onCerrar: () => void;
  ancho?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCerrar}
    >
      <div
        className={`max-h-[90vh] w-full ${ancho} overflow-y-auto rounded-xl bg-white p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
