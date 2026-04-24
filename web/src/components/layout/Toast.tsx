import { useAppStore } from '../../stores/appStore';

export function Toast() {
  const message = useAppStore((s) => s.toastMessage);
  const visible = useAppStore((s) => s.toastVisible);

  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-12 z-[100] max-w-[80vw] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/50 px-3 py-1.5 text-center text-xs text-white backdrop-blur-sm transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {message}
    </div>
  );
}
