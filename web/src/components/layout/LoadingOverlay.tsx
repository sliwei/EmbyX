import { useAppStore } from '../../stores/appStore';

export function LoadingOverlay() {
  const loading = useAppStore((s) => s.loading);
  if (!loading) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-transparent">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-gray-600 border-t-primary" />
    </div>
  );
}
