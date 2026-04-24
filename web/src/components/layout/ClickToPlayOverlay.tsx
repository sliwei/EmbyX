import { Play } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../stores/appStore';

const DOUBLE_TAP_MS = 280;

export function ClickToPlayOverlay() {
  const { viewMode, hasVideos, clickToPlay, videoPaused, setClickToPlay, showInterfaceTemp } = useAppStore(
    useShallow((s) => ({
      viewMode: s.viewMode,
      hasVideos: s.videos.length > 0,
      clickToPlay: s.clickToPlay,
      videoPaused: s.videoPaused,
      setClickToPlay: s.setClickToPlay,
      showInterfaceTemp: s.showInterfaceTemp,
    }))
  );

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCount = useRef(0);

  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    []
  );

  const showUnlockOverlay = viewMode === 'stream' && hasVideos && clickToPlay;
  const showPausedButton = viewMode === 'stream' && hasVideos && !clickToPlay && videoPaused;
  if (!showUnlockOverlay && !showPausedButton) return null;

  const onPointerUp = () => {
    clickCount.current += 1;
    if (clickCount.current === 1) {
      clickTimer.current = setTimeout(() => {
        showInterfaceTemp();
        clickCount.current = 0;
      }, DOUBLE_TAP_MS);
    } else if (clickCount.current === 2) {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = null;
      clickCount.current = 0;
      setClickToPlay(false);
      useAppStore.getState().requestTogglePlay();
    }
  };

  if (showUnlockOverlay) {
    return (
      <button
        type="button"
        className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center"
        aria-label="双击开始播放"
        onPointerUp={onPointerUp}
      >
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-full bg-black/50">
            <Play className="h-8 w-8 text-white" strokeWidth={1.5} />
          </div>
          <p className="mt-3 text-base font-medium text-white">双击开始播放</p>
        </div>
      </button>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <button
        type="button"
        className="pointer-events-auto rounded-full bg-black/50 p-4 transition-transform active:scale-95"
        onClick={() => useAppStore.getState().requestTogglePlay()}
        aria-label="继续播放"
      >
        <Play className="h-8 w-8 text-white" strokeWidth={1.5} />
      </button>
    </div>
  );
}
