import { Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { posterForItem, useAppStore } from '../../stores/appStore';

export function GridView() {
  const {
    serverBase,
    videos,
    totalCount,
    currentLibraryId,
    currentIndex,
    nextAfterId,
    setViewMode,
    setCurrentIndex,
    refreshList,
    libraries,
  } = useAppStore(
    useShallow((s) => ({
      serverBase: s.serverBase,
      videos: s.videos,
      totalCount: s.totalCount,
      currentLibraryId: s.currentLibraryId,
      currentIndex: s.currentIndex,
      nextAfterId: s.nextAfterId,
      setViewMode: s.setViewMode,
      setCurrentIndex: s.setCurrentIndex,
      refreshList: s.refreshList,
      libraries: s.libraries,
    }))
  );

  const countStr = totalCount > 999 ? '999+' : String(totalCount);

  const libraryName = useMemo(() => {
    if (currentLibraryId === 'favorites') return '收藏夹';
    if (!currentLibraryId) return '全部视频';
    const lib = libraries.find((l) => l.id === currentLibraryId);
    return lib?.name ?? '全部视频';
  }, [currentLibraryId, libraries]);

  const item = videos[currentIndex];
  const bg = item ? posterForItem(serverBase, item.id) : '';

  return (
    <div className="absolute inset-0 z-10 flex flex-col overflow-hidden bg-black/40">
      <div
        className="pointer-events-none absolute inset-0 -z-[1] scale-[1.15] bg-cover bg-center opacity-70 blur-xl"
        style={bg ? { backgroundImage: `url('${bg}')` } : undefined}
      />

      <div
        className="flex w-full items-center gap-1.5 border-b border-gray-800/50 bg-black/50 px-2 pb-2 backdrop-blur-sm"
        style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 8px))' }}
      >
        <span className="text-xs font-bold text-gray-200">{libraryName}</span>
        <span className="flex items-center gap-1 text-xs tabular-nums text-primary/70">
          {countStr}
          <button
            type="button"
            title="随机换一批"
            className="rounded-full bg-white/10 p-0.5 transition-transform hover:bg-white/20 active:scale-90"
            onClick={() => void refreshList({ random: true })}
          >
            <Sparkles className="h-3 w-3 text-white" strokeWidth={1.5} />
          </button>
        </span>
        <span className="flex-1" />
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="grid grid-cols-3 gap-1 p-1 sm:grid-cols-4">
          {videos.map((v, i) => (
            <button
              key={v.id}
              type="button"
              className={`relative aspect-[9/16] overflow-hidden bg-gray-900 ring-2 transition-transform active:scale-95 ${
                i === currentIndex ? 'ring-primary' : 'ring-transparent'
              }`}
              onClick={() => {
                setCurrentIndex(i);
                setViewMode('stream');
              }}
            >
              <img
                src={posterForItem(serverBase, v.id)}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>

        {nextAfterId && videos.length > 0 ? (
          <div className="p-3 pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
            <button
              type="button"
              className="w-full rounded-lg bg-white/10 py-3 text-xs text-gray-200 hover:bg-white/20"
              onClick={() => void refreshList({ loadMore: true })}
            >
              加载更多
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
