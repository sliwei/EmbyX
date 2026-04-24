import { useAppStore } from '../../stores/appStore';

export function LibraryModal() {
  const open = useAppStore((s) => s.libraryOpen);
  const setLibraryOpen = useAppStore((s) => s.setLibraryOpen);
  const libraries = useAppStore((s) => s.libraries);
  const pickLibrary = useAppStore((s) => s.pickLibrary);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="max-h-[70vh] w-[90%] max-w-lg overflow-y-auto rounded-xl border border-gray-700/50 bg-black/50 p-3.5 shadow-2xl backdrop-blur-sm">
        <h3 className="mb-3 text-center text-base font-bold text-white">选择媒体源</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-lg border border-gray-700/50 bg-gray-800/60 py-3 text-sm text-gray-200 hover:bg-gray-700/80"
            onClick={() => pickLibrary(null)}
          >
            全部视频
          </button>
          <button
            type="button"
            className="rounded-lg border border-amber-700/40 bg-amber-900/20 py-3 text-sm text-amber-100 hover:bg-amber-900/40"
            onClick={() => pickLibrary('favorites')}
          >
            收藏夹
          </button>
          {libraries.map((lib) => (
            <button
              key={lib.id}
              type="button"
              className="rounded-lg border border-gray-700/50 bg-gray-800/60 py-3 text-sm text-gray-200 hover:bg-gray-700/80"
              onClick={() => pickLibrary(lib.id)}
            >
              {lib.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded border border-white/10 bg-white/10 py-2 text-xs font-medium text-gray-300 hover:bg-white/20 active:scale-95"
          onClick={() => setLibraryOpen(false)}
        >
          关闭
        </button>
      </div>
    </div>
  );
}
