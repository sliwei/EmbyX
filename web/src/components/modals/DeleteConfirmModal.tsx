import { Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';

export function DeleteConfirmModal() {
  const open = useAppStore((s) => s.deleteConfirmOpen);
  const setDeleteConfirmOpen = useAppStore((s) => s.setDeleteConfirmOpen);
  const videos = useAppStore((s) => s.videos);
  const currentIndex = useAppStore((s) => s.currentIndex);
  const confirmDelete = useAppStore((s) => s.confirmDelete);

  const item = videos[currentIndex];
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="w-[85%] max-w-sm rounded-2xl border border-gray-700/50 bg-black/50 p-4 text-center shadow-2xl backdrop-blur-sm">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-secondary/20 bg-secondary/10">
          <Trash2 className="h-5 w-5 text-secondary" strokeWidth={1.8} />
        </div>
        <h3 className="mb-2 text-base font-bold text-white">删除媒体</h3>
        <p className="mb-4 px-2 text-xs font-semibold leading-relaxed text-secondary">
          将从服务器永久删除源文件。
        </p>
        <div className="mb-6 rounded-lg border border-gray-700/30 bg-gray-800/40 p-3">
          <p className="break-all text-xs text-gray-300 opacity-80">{item?.name ?? '—'}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-lg border border-gray-700/50 bg-gray-800/80 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 active:scale-95"
            onClick={() => setDeleteConfirmOpen(false)}
          >
            取消
          </button>
          <button
            type="button"
            className="flex-1 rounded-lg bg-secondary py-2 text-sm font-bold text-white shadow-lg shadow-secondary/20 active:opacity-90"
            onClick={() => void confirmDelete()}
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
