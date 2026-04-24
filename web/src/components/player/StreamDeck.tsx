import { useCallback, useEffect, useRef, useState } from 'react';
import type { NormalizedVideo } from '../../types/media';
import { posterForItem, streamUrl, useAppStore } from '../../stores/appStore';

function videoIdxForSlot(slot: number, current: number, len: number): number | null {
  for (const o of [-1, 0, 1] as const) {
    const vi = current + o;
    if (vi < 0 || vi >= len) continue;
    if (((vi % 3) + 3) % 3 === slot) return vi;
  }
  return null;
}

function SlideVideo({
  slot,
  videoIdx,
  item,
  serverBase,
  isScaleFill,
  isMutedForSlot,
  active,
  zoomScale,
  zoomX,
  zoomY,
}: {
  slot: number;
  videoIdx: number | null;
  item: NormalizedVideo | null;
  serverBase: string;
  isScaleFill: boolean;
  isMutedForSlot: boolean;
  active: boolean;
  zoomScale: number;
  zoomX: number;
  zoomY: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const setProgressPercent = useAppStore((s) => s.setProgressPercent);
  const setPlaybackTimes = useAppStore((s) => s.setPlaybackTimes);
  const reportProgress = useAppStore((s) => s.reportProgress);
  const progressScrubbing = useAppStore((s) => s.progressScrubbing);
  const nextVideo = useAppStore((s) => s.nextVideo);
  const viewMode = useAppStore((s) => s.viewMode);
  const playMode = useAppStore((s) => s.playMode);
  const sequenceAutoplay = useAppStore((s) => s.sequenceAutoplay);
  const showInterfaceTemp = useAppStore((s) => s.showInterfaceTemp);
  const setClickToPlay = useAppStore((s) => s.setClickToPlay);
  const setLoading = useAppStore((s) => s.setLoading);
  const setVideoPaused = useAppStore((s) => s.setVideoPaused);
  const playToggleSeq = useAppStore((s) => s.playToggleSeq);
  const activeRef = useRef(active);

  const src = item ? streamUrl(serverBase, item.id) : '';
  const prevHandledToggleSeq = useRef(playToggleSeq);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !item) return;

    v.muted = isMutedForSlot;
    if (v.src !== src && src) {
      v.src = src;
      v.load();
      v.style.opacity = '0';
    }

    const onMeta = () => {
      if (item.resumeSec > 0 && v.duration && item.resumeSec < v.duration - 5) {
        v.currentTime = item.resumeSec;
      }
    };
    v.addEventListener('loadedmetadata', onMeta, { once: true });

    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
    };
  }, [item, src, isMutedForSlot, item?.resumeSec]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const seek = (e: Event) => {
      const ce = e as CustomEvent<number>;
      if (!active || typeof ce.detail !== 'number') return;
      if (v.duration && Number.isFinite(v.duration)) {
        v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + ce.detail));
      }
    };
    const seekTo = (e: Event) => {
      const ce = e as CustomEvent<{ ratio?: number }>;
      if (!active) return;
      const r = ce.detail?.ratio;
      if (v.duration && typeof r === 'number' && Number.isFinite(r)) {
        v.currentTime = Math.min(v.duration, Math.max(0, r * v.duration));
      }
    };
    window.addEventListener('embyx:seek', seek);
    window.addEventListener('embyx:seek-to', seekTo);
    return () => {
      window.removeEventListener('embyx:seek', seek);
      window.removeEventListener('embyx:seek-to', seekTo);
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      prevHandledToggleSeq.current = playToggleSeq;
      return;
    }
    if (prevHandledToggleSeq.current === playToggleSeq) return;
    const v = ref.current;
    if (!v) return;
    prevHandledToggleSeq.current = playToggleSeq;
    if (v.paused) void v.play().catch(() => setClickToPlay(true));
    else v.pause();
  }, [active, playToggleSeq, setClickToPlay, item]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!active) {
      v.pause();
      v.currentTime = 0;
      return;
    }
    v.muted = isMutedForSlot;
    const p = v.play();
    if (p !== undefined) {
      p.catch(() => {
        if (!activeRef.current) return;
        setClickToPlay(true);
        useAppStore.getState().showToast('点击屏幕开始播放');
      });
    }
  }, [active, isMutedForSlot, src, setClickToPlay]);

  const onTime = () => {
    const v = ref.current;
    if (!v || !active || !v.duration) return;
    if (!progressScrubbing) {
      setProgressPercent((v.currentTime / v.duration) * 100);
    }
    setPlaybackTimes(v.currentTime, v.duration);
    reportProgress(item?.id ?? '0', v.currentTime * 1000, v.duration * 1000);
  };

  const onEnded = () => {
    if (viewMode !== 'stream') return;
    const auto =
      playMode === 'random' || (playMode === 'sequence' && sequenceAutoplay);
    if (auto) nextVideo();
  };

  let t = '';
  if (videoIdx != null) t = `translateY(${videoIdx * 100}%)`;

  if (!item || videoIdx == null) {
    return (
      <div
        className="slide-item hidden"
        data-slot={slot}
        style={{ transform: t || undefined }}
      />
    );
  }

  const poster = posterForItem(serverBase, item.id);

  return (
    <div
      className="slide-item"
      style={{ transform: t }}
      data-slot={slot}
    >
      <div className="relative h-full w-full overflow-hidden bg-black">
        <div
          className="absolute inset-0 z-[5]"
          style={
            active
              ? {
                  transform: `translate(${zoomX}px, ${zoomY}px) scale(${zoomScale})`,
                  transformOrigin: 'center center',
                }
              : undefined
          }
        >
          <img
            src={poster}
            alt=""
            className={`absolute inset-0 z-0 h-full w-full object-cover ${isScaleFill ? '' : 'opacity-0'}`}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div
            className={`absolute inset-0 z-0 scale-[1.15] bg-cover bg-center blur-xl transition-opacity duration-300 ${
              isScaleFill ? 'opacity-0' : 'opacity-70'
            }`}
            style={{ backgroundImage: `url('${poster}')` }}
          />
          <div
            className={`absolute inset-0 z-0 bg-black/40 transition-opacity duration-300 ${
              isScaleFill ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <video
            ref={ref}
            className={`video-fullscreen z-10 opacity-0 transition-opacity duration-500 ${
              isScaleFill ? 'object-cover' : 'object-contain'
            }`}
            playsInline
            muted={isMutedForSlot}
            onTimeUpdate={onTime}
            onEnded={onEnded}
            onPlay={() => {
              if (!active) return;
              setVideoPaused(false);
              setClickToPlay(false);
            }}
            onPlaying={() => {
              setLoading(false);
              if (ref.current) ref.current.style.opacity = '1';
              showInterfaceTemp();
            }}
            onCanPlay={() => {
              setLoading(false);
              if (ref.current) ref.current.style.opacity = '1';
            }}
            onWaiting={() => {
              if (active) setLoading(true);
            }}
            onPause={() => {
              if (active) setVideoPaused(true);
              showInterfaceTemp();
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function StreamDeck() {
  const serverBase = useAppStore((s) => s.serverBase);
  const videos = useAppStore((s) => s.videos);
  const currentIndex = useAppStore((s) => s.currentIndex);
  const nextAfterId = useAppStore((s) => s.nextAfterId);
  const isScaleFill = useAppStore((s) => s.isScaleFill);
  const isMuted = useAppStore((s) => s.isMuted);
  const nextVideo = useAppStore((s) => s.nextVideo);
  const prevVideo = useAppStore((s) => s.prevVideo);
  const showInterfaceTemp = useAppStore((s) => s.showInterfaceTemp);
  const toggleInterfaceHidden = useAppStore((s) => s.toggleInterfaceHidden);
  const viewMode = useAppStore((s) => s.viewMode);
  const setProgressScrubbing = useAppStore((s) => s.setProgressScrubbing);
  const setProgressPercent = useAppStore((s) => s.setProgressPercent);

  const x0 = useRef(0);
  const y0 = useRef(0);
  const t0 = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCount = useRef(0);
  const seekDragging = useRef(false);
  const dragAxis = useRef<'none' | 'x' | 'y'>('none');
  const activeTouchPointers = useRef(new Map<number, { x: number; y: number }>());
  const multiTouchSession = useRef(false);
  const pinchStartDistance = useRef(0);
  const pinchStartScale = useRef(1);
  const pinchStartCenter = useRef({ x: 0, y: 0 });
  const pinchStartOffset = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });

  const [zoomScale, setZoomScale] = useState(1);
  const [zoomX, setZoomX] = useState(0);
  const [zoomY, setZoomY] = useState(0);

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const clampOffset = useCallback(
    (host: HTMLDivElement, scale: number, x: number, y: number) => {
      const maxX = ((scale - 1) * host.clientWidth) / 2;
      const maxY = ((scale - 1) * host.clientHeight) / 2;
      return {
        x: clamp(x, -maxX, maxX),
        y: clamp(y, -maxY, maxY),
      };
    },
    []
  );

  useEffect(() => {
    setZoomScale(1);
    setZoomX(0);
    setZoomY(0);
    activeTouchPointers.current.clear();
    multiTouchSession.current = false;
  }, [currentIndex]);

  const emitSeekByPoint = useCallback(
    (host: HTMLDivElement, clientX: number) => {
      const rect = host.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
      setProgressPercent(ratio * 100);
      window.dispatchEvent(new CustomEvent('embyx:seek-to', { detail: { ratio } }));
    },
    [setProgressPercent]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (viewMode !== 'stream') return;
      if (e.pointerType === 'touch') {
        activeTouchPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const touches = [...activeTouchPointers.current.values()];

        if (touches.length >= 2) {
          multiTouchSession.current = true;
          const a = touches[0]!;
          const b = touches[1]!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          if (pinchStartDistance.current <= 0) {
            pinchStartDistance.current = dist || 1;
            pinchStartScale.current = zoomScale;
            pinchStartCenter.current = center;
            pinchStartOffset.current = { x: zoomX, y: zoomY };
            return;
          }
          const nextScale = clamp((pinchStartScale.current * dist) / pinchStartDistance.current, 1, 3);
          const nextX = pinchStartOffset.current.x + (center.x - pinchStartCenter.current.x);
          const nextY = pinchStartOffset.current.y + (center.y - pinchStartCenter.current.y);
          const clamped = clampOffset(e.currentTarget, nextScale, nextX, nextY);
          setZoomScale(nextScale);
          setZoomX(clamped.x);
          setZoomY(clamped.y);
          return;
        }

        if (zoomScale > 1) {
          const dxPan = e.clientX - x0.current;
          const dyPan = e.clientY - y0.current;
          const next = clampOffset(
            e.currentTarget,
            zoomScale,
            panStartOffset.current.x + dxPan,
            panStartOffset.current.y + dyPan
          );
          setZoomX(next.x);
          setZoomY(next.y);
          return;
        }
      }
      const dx = e.clientX - x0.current;
      const dy = e.clientY - y0.current;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (dragAxis.current === 'none' && (adx > 12 || ady > 12)) {
        dragAxis.current = adx > ady ? 'x' : 'y';
      }
      if (dragAxis.current !== 'x') return;

      if (!seekDragging.current) {
        seekDragging.current = true;
        setProgressScrubbing(true);
      }
      emitSeekByPoint(e.currentTarget, e.clientX);
    },
    [viewMode, setProgressScrubbing, emitSeekByPoint, zoomScale, zoomX, zoomY, clampOffset]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (viewMode !== 'stream') return;
      if (e.pointerType === 'touch') {
        activeTouchPointers.current.delete(e.pointerId);
        if (activeTouchPointers.current.size < 2) pinchStartDistance.current = 0;
        if (multiTouchSession.current) {
          if (activeTouchPointers.current.size === 0) multiTouchSession.current = false;
          return;
        }
      }
      if (zoomScale > 1) return;
      if (e.pointerType === 'touch' && activeTouchPointers.current.size >= 1) return;
      if (seekDragging.current) {
        emitSeekByPoint(e.currentTarget, e.clientX);
        seekDragging.current = false;
        dragAxis.current = 'none';
        setProgressScrubbing(false);
        showInterfaceTemp();
        return;
      }
      const dx = e.clientX - x0.current;
      const dy = e.clientY - y0.current;
      const dt = Date.now() - t0.current;
      dragAxis.current = 'none';

      if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0) {
          if (currentIndex >= videos.length - 1 && !nextAfterId) {
            useAppStore.getState().showToast('没有更多了');
          } else {
            nextVideo();
          }
        } else if (currentIndex <= 0) {
          useAppStore.getState().showToast('已经是第一条');
        } else {
          prevVideo();
        }
        return;
      }

      if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
        clickCount.current += 1;
        if (clickCount.current === 1) {
          clickTimer.current = setTimeout(() => {
            toggleInterfaceHidden();
            clickCount.current = 0;
          }, 280);
        } else if (clickCount.current === 2) {
          if (clickTimer.current) clearTimeout(clickTimer.current);
          clickCount.current = 0;
          useAppStore.getState().requestTogglePlay();
        }
      }
    },
    [viewMode, currentIndex, videos.length, nextAfterId, nextVideo, prevVideo, showInterfaceTemp, toggleInterfaceHidden, emitSeekByPoint, setProgressScrubbing, zoomScale]
  );

  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    []
  );

  if (!videos.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        暂无视频，请在「我的」中连接服务或选择媒体库
      </div>
    );
  }

  return (
    <div
      className="relative h-full w-full touch-none select-none"
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') {
          if (activeTouchPointers.current.size === 0) multiTouchSession.current = false;
          activeTouchPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (activeTouchPointers.current.size >= 2) {
            multiTouchSession.current = true;
            dragAxis.current = 'none';
            if (seekDragging.current) {
              seekDragging.current = false;
              setProgressScrubbing(false);
            }
            const touches = [...activeTouchPointers.current.values()];
            const a = touches[0]!;
            const b = touches[1]!;
            pinchStartDistance.current = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            pinchStartScale.current = zoomScale;
            pinchStartCenter.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            pinchStartOffset.current = { x: zoomX, y: zoomY };
            return;
          }
          if (zoomScale > 1) {
            x0.current = e.clientX;
            y0.current = e.clientY;
            panStartOffset.current = { x: zoomX, y: zoomY };
            return;
          }
        }
        x0.current = e.clientX;
        y0.current = e.clientY;
        t0.current = Date.now();
        dragAxis.current = 'none';
        seekDragging.current = false;
      }}
      onPointerMove={onPointerMove}
      onPointerCancel={() => {
        dragAxis.current = 'none';
        activeTouchPointers.current.clear();
        multiTouchSession.current = false;
        pinchStartDistance.current = 0;
        if (seekDragging.current) {
          seekDragging.current = false;
          setProgressScrubbing(false);
        }
      }}
      onPointerUp={onPointerUp}
    >
      <div
        className="relative h-full w-full transition-transform duration-300 ease-out"
        style={{ transform: `translateY(-${currentIndex * 100}%)` }}
      >
        {[0, 1, 2].map((slot) => {
          const vi = videoIdxForSlot(slot, currentIndex, videos.length);
          const item = vi != null ? videos[vi] ?? null : null;
          const active = vi === currentIndex;
          const offset = vi != null ? vi - currentIndex : null;
          const muted = offset !== 0 ? true : isMuted;
          return (
            <SlideVideo
              key={slot}
              slot={slot}
              videoIdx={vi}
              item={item}
              serverBase={serverBase}
              isScaleFill={isScaleFill}
              isMutedForSlot={muted}
              active={active}
              zoomScale={active ? zoomScale : 1}
              zoomX={active ? zoomX : 0}
              zoomY={active ? zoomY : 0}
            />
          );
        })}
      </div>
    </div>
  );
}
