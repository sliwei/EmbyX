import {
  FolderOpen,
  GalleryVertical,
  Heart,
  LayoutGrid,
  Maximize,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  Trash2,
  UserRound,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useRef } from 'react';
import { formatTime } from '../../lib/formatTime';
import { useAppStore } from '../../stores/appStore';

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type IOSVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
};

export function BottomChrome() {
  const videos = useAppStore((s) => s.videos);
  const currentIndex = useAppStore((s) => s.currentIndex);
  const viewMode = useAppStore((s) => s.viewMode);
  const playMode = useAppStore((s) => s.playMode);
  const sequenceAutoplay = useAppStore((s) => s.sequenceAutoplay);
  const interfaceHidden = useAppStore((s) => s.interfaceHidden);
  const deleteMode = useAppStore((s) => s.deleteMode);
  const progressPercent = useAppStore((s) => s.progressPercent);
  const progressScrubbing = useAppStore((s) => s.progressScrubbing);
  const videoPaused = useAppStore((s) => s.videoPaused);
  const playbackCurrent = useAppStore((s) => s.playbackCurrent);
  const playbackDuration = useAppStore((s) => s.playbackDuration);
  const isMuted = useAppStore((s) => s.isMuted);
  const isScaleFill = useAppStore((s) => s.isScaleFill);
  const favorites = useAppStore((s) => s.favorites);

  const setProgressScrubbing = useAppStore((s) => s.setProgressScrubbing);
  const setProgressPercent = useAppStore((s) => s.setProgressPercent);
  const setProfileOpen = useAppStore((s) => s.setProfileOpen);
  const setLibraryOpen = useAppStore((s) => s.setLibraryOpen);
  const setDeleteConfirmOpen = useAppStore((s) => s.setDeleteConfirmOpen);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const cyclePlayControl = useAppStore((s) => s.cyclePlayControl);
  const toggleMute = useAppStore((s) => s.toggleMute);
  const toggleScale = useAppStore((s) => s.toggleScale);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const showInterfaceTemp = useAppStore((s) => s.showInterfaceTemp);
  const requestTogglePlay = useAppStore((s) => s.requestTogglePlay);

  const item = videos[currentIndex];
  const hidden = interfaceHidden || viewMode === 'grid';
  const showMiniProgress = interfaceHidden && viewMode === 'stream' && videos.length > 0;
  /** 网格页仍显示底部导航条，仅随「隐藏界面」收起 */
  const bottomBarHidden = interfaceHidden;
  const barRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);

  const onScrubPointer = useCallback(
    (clientX: number) => {
      const el = barRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - r.left) / Math.max(1, r.width)));
      setProgressPercent(ratio * 100);
      window.dispatchEvent(new CustomEvent('embyx:seek-to', { detail: { ratio } }));
    },
    [setProgressPercent]
  );

  const toggleFullscreen = useCallback(() => {
    const doc = document as FullscreenDoc;
    const currentFs = document.fullscreenElement ?? doc.webkitFullscreenElement;
    if (currentFs) {
      if (document.exitFullscreen) {
        void document.exitFullscreen();
        return;
      }
      void doc.webkitExitFullscreen?.();
      return;
    }

    if (document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => {
        const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video.video-fullscreen'));
        const activeVideo =
          videos.find((v) => {
            const r = v.getBoundingClientRect();
            return r.top < window.innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0;
          }) ?? videos[0];
        (activeVideo as IOSVideo | undefined)?.webkitEnterFullscreen?.();
      });
      return;
    }

    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video.video-fullscreen'));
    const activeVideo =
      videos.find((v) => {
        const r = v.getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0;
      }) ?? videos[0];
    (activeVideo as IOSVideo | undefined)?.webkitEnterFullscreen?.();
  }, []);

  const fav = item ? favorites.includes(item.id) : false;

  return (
    <>
      <div
        className={`absolute bottom-32 right-3 z-30 flex flex-col items-center space-y-4 transition-opacity duration-300 ${
          hidden ? 'pointer-events-none opacity-0' : ''
        }`}
      >
        <button
          type="button"
          className="flex flex-col items-center transition-transform active:scale-90"
          onClick={() => toggleFavorite()}
        >
          <Heart
            className={`h-4 w-4 drop-shadow-md ${fav ? 'fill-secondary text-secondary' : 'stroke-white'}`}
            strokeWidth={1.8}
          />
        </button>
        <button
          type="button"
          className="flex flex-col items-center transition-transform active:scale-90"
          onClick={() => toggleScale()}
        >
          {isScaleFill ? (
            <Maximize className="h-4 w-4 stroke-white drop-shadow-md" strokeWidth={1.8} />
          ) : (
            <Minimize2 className="h-4 w-4 stroke-white drop-shadow-md" strokeWidth={1.8} />
          )}
        </button>
        <button
          type="button"
          className="flex flex-col items-center transition-transform active:scale-90"
          onClick={() => toggleMute()}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-secondary drop-shadow-md" strokeWidth={1.8} />
          ) : (
            <Volume2 className="h-4 w-4 stroke-white drop-shadow-md" strokeWidth={1.8} />
          )}
        </button>
      </div>

      {deleteMode ? (
        <div
          className={`absolute left-4 z-30 transition-opacity duration-300 ${
            hidden ? 'pointer-events-none opacity-0' : ''
          }`}
          style={{ top: 'calc(10px + env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 transition-transform active:scale-90"
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 stroke-white drop-shadow-md" strokeWidth={1.8} />
          </button>
        </div>
      ) : null}

      <div
        className={`absolute right-4 z-30 transition-opacity duration-300 ${
          hidden ? 'pointer-events-none opacity-0' : ''
        }`}
        style={{ top: 'calc(10px + env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 transition-transform active:scale-90"
          onClick={toggleFullscreen}
        >
          <Maximize className="h-3.5 w-3.5 stroke-white drop-shadow-md" strokeWidth={1.8} />
        </button>
      </div>

      <div
        className={`pointer-events-none absolute bottom-14 left-3 right-3 z-20 transition-opacity duration-300 ${
          hidden ? 'opacity-0' : ''
        }`}
      >
        {/* hidden 时必须整层 pointer-events-none，否则子项 pointer-events-auto 在 opacity-0 下仍可点击 */}
        <div className={hidden ? 'pointer-events-none' : 'pointer-events-auto'}>
        <button
          type="button"
          className="mb-2 w-[75%] cursor-pointer pr-3 text-left transition-opacity active:opacity-75"
          onClick={() => void useAppStore.getState().openMediaInfo()}
        >
          <h3 className="mb-0.5 truncate text-base font-medium text-white drop-shadow-md">
            {item?.name ?? '—'}
          </h3>
        </button>

        <div className="mb-0.5 flex items-center gap-2">
          <button
            type="button"
            className="flex flex-shrink-0 flex-col items-center transition-transform active:scale-90"
            onClick={() => requestTogglePlay()}
          >
            {videoPaused ? (
              <Play className="h-4 w-4 stroke-white drop-shadow-md" strokeWidth={1.8} />
            ) : (
              <Pause className="h-4 w-4 stroke-white drop-shadow-md" strokeWidth={1.8} />
            )}
          </button>
          <div
            ref={barRef}
            role="slider"
            aria-valuenow={Math.round(progressPercent)}
            tabIndex={0}
            className="relative flex min-h-[2.25rem] min-w-0 flex-1 cursor-pointer touch-none select-none items-center overflow-visible"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              scrubbingRef.current = true;
              setProgressScrubbing(true);
              onScrubPointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (!scrubbingRef.current) return;
              onScrubPointer(e.clientX);
            }}
            onPointerUp={(e) => {
              scrubbingRef.current = false;
              setProgressScrubbing(false);
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                /* noop */
              }
              showInterfaceTemp();
            }}
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/30"
              aria-hidden
            />
            <div
              className={`pointer-events-none absolute left-0 top-1/2 h-1 max-w-full -translate-y-1/2 rounded-full bg-white ${
                progressScrubbing ? '' : 'transition-[width] duration-75 ease-linear'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className={`absolute top-1/2 z-[12] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-1 ring-white/40 touch-manipulation ${
                progressScrubbing ? '' : 'transition-[left] duration-75 ease-linear'
              }`}
              style={{ left: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between text-xs text-gray-300 drop-shadow">
          <span>{formatTime(playbackCurrent)}</span>
          <span>{formatTime(playbackDuration)}</span>
        </div>
        </div>
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 z-30 bg-black/50 pb-1.5 pt-0.5 backdrop-blur-sm transition-opacity duration-300 ${
          bottomBarHidden ? 'pointer-events-none opacity-0' : ''
        }`}
      >
        <div className="flex h-8 items-center justify-around">
          <button
            type="button"
            className={`nav-btn relative z-10 flex h-full w-1/4 flex-col items-center justify-center transition-colors duration-300 ${
              viewMode === 'grid' ? 'text-primary' : 'text-gray-400'
            }`}
            onClick={() => setViewMode(viewMode === 'stream' ? 'grid' : 'stream')}
          >
            {viewMode === 'grid' ? (
              <GalleryVertical className="h-3.5 w-3.5 stroke-current" strokeWidth={1.8} />
            ) : (
              <LayoutGrid className="h-3.5 w-3.5 stroke-current" strokeWidth={1.8} />
            )}
          </button>
          <button
            type="button"
            className="relative z-10 flex h-full w-1/4 flex-col items-center justify-center text-gray-400 transition-colors duration-300"
            onClick={() => cyclePlayControl()}
          >
            {playMode === 'random' ? (
              <Shuffle className="h-3.5 w-3.5 stroke-current" strokeWidth={1.8} />
            ) : sequenceAutoplay ? (
              <Repeat className="h-3.5 w-3.5 stroke-current" strokeWidth={1.8} />
            ) : (
              <Repeat1 className="h-3.5 w-3.5 stroke-current" strokeWidth={1.8} />
            )}
          </button>
          <button
            type="button"
            className="relative z-10 flex h-full w-1/4 flex-col items-center justify-center text-gray-400 transition-colors duration-300"
            onClick={() => {
              void useAppStore.getState().loadLibraries();
              setLibraryOpen(true);
            }}
          >
            <FolderOpen className="h-3.5 w-3.5 stroke-current" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="relative z-10 flex h-full w-1/4 flex-col items-center justify-center text-gray-400 transition-colors duration-300"
            onClick={() => setProfileOpen(true)}
          >
            <UserRound className="h-3.5 w-3.5 stroke-current" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div
        className={`pointer-events-none absolute bottom-0 left-0 right-0 z-40 h-1 transition-opacity duration-300 ${
          showMiniProgress ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="h-full w-full bg-white/20">
          <div
            className="h-full bg-white/60 transition-[width] duration-75 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <style>{`
        .nav-btn:active { color: #52B54B; }
      `}</style>
    </>
  );
}
