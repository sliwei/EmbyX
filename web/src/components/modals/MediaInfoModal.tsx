import { Loader2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

export function MediaInfoModal() {
  const open = useAppStore((s) => s.mediaInfoOpen);
  const setMediaInfoOpen = useAppStore((s) => s.setMediaInfoOpen);
  const detail = useAppStore((s) => s.mediaInfoDetail);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-opacity">
      <div className="max-h-[80vh] w-[85%] max-w-sm overflow-y-auto rounded-2xl border border-gray-700/50 bg-black/50 p-4 shadow-2xl backdrop-blur-sm">
        <h3 className="mb-3 text-center text-base font-bold text-white">流媒体信息</h3>
        <div className="text-xs text-gray-300">
          {!detail ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-500" strokeWidth={1.8} />
            </div>
          ) : (
            <dl className="space-y-2">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">ID</dt>
                <dd className="text-right">{detail.id}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">容器</dt>
                <dd className="text-right">{detail.container}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">大小</dt>
                <dd className="text-right">{detail.size_bytes} B</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-gray-500">编码提示</dt>
                <dd className="break-all font-mono text-[11px] text-gray-400">{detail.codec_hint || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">时长(ms)</dt>
                <dd className="text-right">{detail.duration_ms}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-gray-500">路径</dt>
                <dd className="break-all text-[11px]">{detail.rel_path}</dd>
              </div>
            </dl>
          )}
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-lg border border-gray-700/50 bg-gray-800/80 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 active:scale-95"
          onClick={() => setMediaInfoOpen(false)}
        >
          关闭
        </button>
      </div>
    </div>
  );
}
