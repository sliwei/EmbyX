import { create } from 'zustand';
import type { ItemDto, ItemDetail, LibraryRow, NormalizedVideo } from '../types/media';
import {
  LOCAL_TOKEN,
  coverUrl,
  defaultOrigin,
  deleteItem,
  fetchItemDetail,
  fetchItems,
  getHealth,
  listLibraries,
  postPlayback,
  streamUrl,
} from '../services/mediaClient';

const LS = {
  server: 'emby_server',
  token: 'emby_token',
  uid: 'emby_uid',
  user: 'emby_user',
  static: 'emby_static',
  autoplay: 'emby_autoplay',
  deleteMode: 'emby_delete_mode',
  playMode: 'emby_play_mode',
  libId: 'emby_lib_id',
  scaleFill: 'emby_is_scale_fill',
  muted: 'emby_is_muted',
  favorites: 'emby_favorites',
  apiKey: 'embyx_x_api_key',
};

function loadLs(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveLs(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function normalize(d: ItemDto): NormalizedVideo {
  const dur = d.duration_ms || 0;
  const pos = d.position_ms || 0;
  let resumeSec = 0;
  if (dur > 0 && pos > 0 && pos < dur - 5000) resumeSec = pos / 1000;
  return {
    id: String(d.id),
    name: d.name || '未知',
    durationMs: dur,
    positionMs: pos,
    resumeSec,
  };
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

export type ViewMode = 'stream' | 'grid';
export type PlayMode = 'sequence' | 'random';

type ToastFn = (msg: string) => void;

interface AppStore {
  serverBase: string;
  apiKey: string;
  token: string;
  userId: string;
  useStatic: boolean;
  autoplay: boolean;
  deleteMode: boolean;
  isLocal: boolean;

  videos: NormalizedVideo[];
  currentIndex: number;
  totalCount: number;
  nextAfterId: string | null;

  viewMode: ViewMode;
  playMode: PlayMode;
  sequenceAutoplay: boolean;

  favorites: string[];
  currentLibraryId: string | null;

  libraries: LibraryRow[];
  librariesLoaded: boolean;

  loading: boolean;
  interfaceHidden: boolean;
  profileOpen: boolean;
  libraryOpen: boolean;
  mediaInfoOpen: boolean;
  mediaInfoDetail: ItemDetail | null;
  deleteConfirmOpen: boolean;
  clickToPlay: boolean;

  toastMessage: string;
  toastVisible: boolean;

  progressScrubbing: boolean;
  progressPercent: number;
  playbackCurrent: number;
  playbackDuration: number;

  isMuted: boolean;
  isScaleFill: boolean;
  videoPaused: boolean;
  /** 递增以触发当前激活视频的播放/暂停切换（替代 window 自定义事件） */
  playToggleSeq: number;

  boot: () => Promise<void>;
  hydrateFromStorage: () => void;
  saveServerConfig: (input: {
    server: string;
    useStatic: boolean;
    autoplay: boolean;
    deleteMode: boolean;
    apiKey: string;
  }) => Promise<void>;
  resetAll: () => void;

  setToastImpl: (fn: ToastFn) => void;
  showToast: (msg: string) => void;

  setLoading: (v: boolean) => void;
  setProfileOpen: (v: boolean) => void;
  setLibraryOpen: (v: boolean) => void;
  setMediaInfoOpen: (v: boolean) => void;
  setDeleteConfirmOpen: (v: boolean) => void;
  toggleInterfaceHidden: () => void;
  showInterfaceTemp: () => void;
  clearHideTimer: () => void;

  setViewMode: (m: ViewMode) => void;
  cyclePlayControl: () => void;
  toggleMute: () => void;
  toggleScale: () => void;

  loadLibraries: () => Promise<void>;
  pickLibrary: (id: string | null) => void;

  refreshList: (opts?: { loadMore?: boolean; random?: boolean }) => Promise<void>;

  setCurrentIndex: (i: number) => void;
  nextVideo: () => void;
  prevVideo: () => void;

  toggleFavorite: () => void;
  isFavorite: (id: string) => boolean;

  openMediaInfo: () => Promise<void>;
  confirmDelete: () => Promise<void>;
  removeVideoFromList: (id: string) => void;

  setProgressScrubbing: (v: boolean) => void;
  setProgressPercent: (n: number) => void;
  setPlaybackTimes: (current: number, duration: number) => void;

  reportProgress: (fileId: string, positionMs: number, durationMs: number) => void;

  setClickToPlay: (v: boolean) => void;
  setVideoPaused: (v: boolean) => void;
  requestTogglePlay: () => void;
}

let toastImpl: ToastFn = (msg) => console.info(msg);
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let reportTimer: ReturnType<typeof setTimeout> | null = null;
let lastReportKey = '';

export const useAppStore = create<AppStore>((set, get) => ({
  serverBase: '',
  apiKey: '',
  token: '',
  userId: '',
  useStatic: true,
  autoplay: true,
  deleteMode: false,
  isLocal: false,

  videos: [],
  currentIndex: 0,
  totalCount: 0,
  nextAfterId: null,

  viewMode: 'stream',
  playMode: 'sequence',
  sequenceAutoplay: true,

  favorites: [],
  currentLibraryId: null,

  libraries: [],
  librariesLoaded: false,

  loading: false,
  interfaceHidden: false,
  profileOpen: false,
  libraryOpen: false,
  mediaInfoOpen: false,
  mediaInfoDetail: null,
  deleteConfirmOpen: false,
  clickToPlay: false,

  toastMessage: '',
  toastVisible: false,

  progressScrubbing: false,
  progressPercent: 0,
  playbackCurrent: 0,
  playbackDuration: 0,

  isMuted: false,
  isScaleFill: false,
  videoPaused: true,
  playToggleSeq: 0,

  setToastImpl: (fn) => {
    toastImpl = fn;
  },

  showToast: (msg) => {
    toastImpl(msg);
    set({ toastMessage: msg, toastVisible: true });
    setTimeout(() => set({ toastVisible: false }), 2200);
  },

  hydrateFromStorage: () => {
    const server = loadLs(LS.server, defaultOrigin());
    const token = loadLs(LS.token, '');
    const uid = loadLs(LS.uid, '');
    const useStatic = loadLs(LS.static, 'true') !== 'false';
    const autoplay = loadLs(LS.autoplay, 'true') !== 'false';
    const deleteMode = loadLs(LS.deleteMode, 'false') === 'true';
    const playMode = (loadLs(LS.playMode, 'sequence') === 'random' ? 'random' : 'sequence') as PlayMode;
    const libId = loadLs(LS.libId, '');
    const favRaw = loadLs(LS.favorites, '[]');
    let favorites: string[] = [];
    try {
      favorites = JSON.parse(favRaw) as string[];
      if (!Array.isArray(favorites)) favorites = [];
    } catch {
      favorites = [];
    }
    const apiKey = loadLs(LS.apiKey, '');
    const isScaleFill = loadLs(LS.scaleFill, 'false') === 'true';
    const isMuted = loadLs(LS.muted, 'false') === 'true';

    set({
      serverBase: server,
      token,
      userId: uid,
      useStatic,
      autoplay,
      deleteMode,
      playMode,
      sequenceAutoplay: autoplay,
      currentLibraryId: libId || null,
      favorites,
      apiKey,
      isScaleFill,
      isMuted,
      isLocal: token === LOCAL_TOKEN,
    });
  },

  boot: async () => {
    get().hydrateFromStorage();
    const origin = defaultOrigin();
    const { token, serverBase } = get();

    if (token === LOCAL_TOKEN && !serverBase && origin) {
      set({ serverBase: origin });
      saveLs(LS.server, origin);
    }

    if (token === LOCAL_TOKEN) {
      set({ isLocal: true });
      if (serverBase || origin) {
        const s = serverBase || origin;
        const ok = await getHealth(s, get().apiKey);
        if (ok) {
          set({ serverBase: s, isLocal: true });
          await get().refreshList();
          return;
        }
      }
    }

    if (serverBase && token) {
      const ok = await getHealth(serverBase, get().apiKey).catch(() => false);
      if (ok) {
        set({ isLocal: true });
        await get().refreshList();
        return;
      }
    }

    if (token === LOCAL_TOKEN || !token) {
      if (origin) {
        const ok = await getHealth(origin, get().apiKey).catch(() => false);
        if (ok) {
          saveLs(LS.server, origin);
          saveLs(LS.user, 'local');
          saveLs(LS.token, LOCAL_TOKEN);
          saveLs(LS.uid, 'local');
          set({ serverBase: origin, token: LOCAL_TOKEN, userId: 'local', isLocal: true });
          await get().refreshList();
          return;
        }
      }
    }

    setTimeout(() => set({ profileOpen: true }), 400);
  },

  saveServerConfig: async ({ server, useStatic, autoplay, deleteMode, apiKey }) => {
    const base = (server.trim() || defaultOrigin()).replace(/\/$/, '');
    if (!base) {
      get().showToast('无法解析服务地址');
      return;
    }
    set({ loading: true });
    try {
      const ok = await getHealth(base, apiKey);
      if (!ok) {
        get().showToast('无法连接本地媒体服务（需要 GET /api/health）');
        return;
      }
      saveLs(LS.server, base);
      saveLs(LS.user, 'local');
      saveLs(LS.token, LOCAL_TOKEN);
      saveLs(LS.uid, 'local');
      saveLs(LS.static, String(useStatic));
      saveLs(LS.autoplay, String(autoplay));
      saveLs(LS.deleteMode, String(deleteMode));
      saveLs(LS.apiKey, apiKey);

      set({
        serverBase: base,
        token: LOCAL_TOKEN,
        userId: 'local',
        useStatic,
        autoplay,
        deleteMode,
        sequenceAutoplay: autoplay,
        isLocal: true,
        apiKey,
        profileOpen: false,
      });
      get().showToast('已连接本地媒体库');
      await get().refreshList();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误';
      get().showToast(`连接失败：${msg}`);
    } finally {
      set({ loading: false });
    }
  },

  resetAll: () => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.reload();
  },

  setLoading: (v) => set({ loading: v }),
  setProfileOpen: (v) => set({ profileOpen: v }),
  setLibraryOpen: (v) => set({ libraryOpen: v }),
  setMediaInfoOpen: (v) => set({ mediaInfoOpen: v, mediaInfoDetail: v ? get().mediaInfoDetail : null }),
  setDeleteConfirmOpen: (v) => set({ deleteConfirmOpen: v }),

  clearHideTimer: () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  },

  showInterfaceTemp: () => {
    const st = get();
    if (st.mediaInfoOpen || st.deleteConfirmOpen || st.profileOpen || st.libraryOpen) return;
    set({ interfaceHidden: false });
    get().clearHideTimer();
    // 暂停时保持控制条常显，恢复播放后再走自动隐藏
    if (get().viewMode === 'stream' && get().videoPaused) return;
    hideTimer = setTimeout(() => {
      if (get().viewMode === 'stream') set({ interfaceHidden: true });
    }, 3000);
  },

  toggleInterfaceHidden: () => {
    set((s) => ({ interfaceHidden: !s.interfaceHidden }));
    if (!get().interfaceHidden) get().showInterfaceTemp();
    else get().clearHideTimer();
  },

  setViewMode: (m) => {
    set({ viewMode: m, interfaceHidden: false });
    get().showInterfaceTemp();
  },

  cyclePlayControl: () => {
    const { playMode, sequenceAutoplay } = get();
    if (playMode === 'random') {
      saveLs(LS.playMode, 'sequence');
      set({ playMode: 'sequence', sequenceAutoplay: get().autoplay });
      get().showToast('已切换：顺序播放');
      return;
    }
    if (sequenceAutoplay) {
      saveLs(LS.autoplay, 'false');
      set({ sequenceAutoplay: false, autoplay: false });
      get().showToast('单集播放');
      return;
    }
    saveLs(LS.playMode, 'random');
    saveLs(LS.autoplay, 'true');
    set({ playMode: 'random', sequenceAutoplay: true, autoplay: true });
    const v = [...get().videos];
    shuffleInPlace(v);
    set({ videos: v, currentIndex: 0 });
    get().showToast('随机顺序');
  },

  toggleMute: () => {
    set((s) => {
      const next = !s.isMuted;
      saveLs(LS.muted, String(next));
      return { isMuted: next };
    });
  },

  toggleScale: () => {
    set((s) => {
      const next = !s.isScaleFill;
      saveLs(LS.scaleFill, String(next));
      return { isScaleFill: next };
    });
  },

  loadLibraries: async () => {
    const { serverBase, apiKey } = get();
    if (!serverBase) return;
    set({ loading: true });
    try {
      const rows = await listLibraries(serverBase, apiKey);
      set({ libraries: rows, librariesLoaded: true });
    } catch {
      get().showToast('媒体库列表加载失败');
    } finally {
      set({ loading: false });
    }
  },

  pickLibrary: (id) => {
    if (id) saveLs(LS.libId, id);
    else localStorage.removeItem(LS.libId);
    set({ currentLibraryId: id, libraryOpen: false });
    void get().refreshList();
  },

  refreshList: async (opts) => {
    const { serverBase, apiKey, currentLibraryId, favorites, playMode } = get();
    if (!serverBase || !get().token) {
      get().showToast('请先配置服务器');
      return;
    }
    set({ loading: true });
    try {
      const loadMore = opts?.loadMore ?? false;
      const random = opts?.random ?? false;
      if (loadMore && !get().nextAfterId) {
        get().showToast('没有更多视频了');
        set({ loading: false });
        return;
      }
      const afterId = loadMore && get().nextAfterId ? String(get().nextAfterId) : null;

      const ids =
        currentLibraryId === 'favorites' ? favorites.slice(0, 500) : undefined;

      if (currentLibraryId === 'favorites' && (!ids || ids.length === 0)) {
        get().showToast('暂无收藏');
        set({ videos: [], loading: false });
        return;
      }

      const data = await fetchItems({
        server: serverBase,
        apiKey,
        libraryId: currentLibraryId === 'favorites' ? null : currentLibraryId,
        afterId: loadMore ? afterId : null,
        random,
        ids: currentLibraryId === 'favorites' ? ids : undefined,
      });

      let items = data.items.map(normalize);
      if (playMode === 'random' && !random && !loadMore) {
        shuffleInPlace(items);
      }

      if (loadMore) {
        const merged = [...get().videos, ...items];
        set({
          videos: merged,
          nextAfterId: data.next_after_id != null ? String(data.next_after_id) : null,
          totalCount: data.total,
        });
      } else {
        set({
          videos: items,
          currentIndex: 0,
          nextAfterId: data.next_after_id != null ? String(data.next_after_id) : null,
          totalCount: data.total,
        });
      }

      if (items.length === 0 && !loadMore) get().showToast('没有找到视频');
      if (items.length === 0 && loadMore) get().showToast('没有更多视频了');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '未知错误';
      get().showToast(`加载失败：${msg}`);
    } finally {
      set({ loading: false });
    }
  },

  setCurrentIndex: (i) => {
    const { videos } = get();
    if (i < 0 || i >= videos.length) return;
    set({ currentIndex: i });
    get().showInterfaceTemp();
  },

  nextVideo: () => {
    const { videos, currentIndex, sequenceAutoplay, playMode, viewMode } = get();
    if (viewMode !== 'stream') return;
    if (currentIndex < videos.length - 1) {
      set({ currentIndex: currentIndex + 1 });
      get().showInterfaceTemp();
      return;
    }
    if (playMode === 'sequence' && sequenceAutoplay && videos.length > 0) {
      set({ currentIndex: 0 });
      get().showInterfaceTemp();
    }
  },

  prevVideo: () => {
    const { currentIndex, viewMode } = get();
    if (viewMode !== 'stream') return;
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
      get().showInterfaceTemp();
    }
  },

  isFavorite: (id) => get().favorites.includes(id),

  toggleFavorite: () => {
    const v = get().videos[get().currentIndex];
    if (!v) return;
    const id = v.id;
    const has = get().favorites.includes(id);
    const next = has ? get().favorites.filter((x) => x !== id) : [...get().favorites, id];
    saveLs(LS.favorites, JSON.stringify(next));
    set({ favorites: next });
    get().showToast(has ? '已取消收藏' : '已收藏');
  },

  openMediaInfo: async () => {
    const v = get().videos[get().currentIndex];
    if (!v) return;
    set({ mediaInfoOpen: true, mediaInfoDetail: null });
    try {
      const d = await fetchItemDetail(get().serverBase, get().apiKey, v.id);
      set({ mediaInfoDetail: d });
    } catch {
      get().showToast('详情加载失败');
      set({ mediaInfoOpen: false });
    }
  },

  confirmDelete: async () => {
    const v = get().videos[get().currentIndex];
    if (!v) return;
    set({ loading: true });
    try {
      await deleteItem(get().serverBase, get().apiKey, v.id);
      get().showToast('已删除');
      get().removeVideoFromList(v.id);
      set({ deleteConfirmOpen: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '删除失败';
      get().showToast(msg);
    } finally {
      set({ loading: false });
    }
  },

  removeVideoFromList: (id) => {
    const { videos, currentIndex } = get();
    const idx = videos.findIndex((x) => x.id === id);
    if (idx === -1) return;
    const next = videos.filter((x) => x.id !== id);
    let ci = currentIndex;
    if (idx < currentIndex) ci = currentIndex - 1;
    else if (idx === currentIndex) ci = Math.min(currentIndex, Math.max(0, next.length - 1));
    set({ videos: next, currentIndex: ci });
  },

  setProgressScrubbing: (v) => set({ progressScrubbing: v }),
  setProgressPercent: (n) => set({ progressPercent: Math.min(100, Math.max(0, n)) }),
  setPlaybackTimes: (current, duration) => set({ playbackCurrent: current, playbackDuration: duration }),

  reportProgress: (fileId, positionMs, durationMs) => {
    const key = `${fileId}:${Math.floor(positionMs / 2000)}`;
    if (key === lastReportKey) return;
    lastReportKey = key;
    if (reportTimer) clearTimeout(reportTimer);
    reportTimer = setTimeout(() => {
      lastReportKey = '';
    }, 800);
    void postPlayback(get().serverBase, get().apiKey, {
      file_id: Number(fileId),
      position_ms: Math.floor(positionMs),
      duration_ms: Math.floor(durationMs),
    }).catch(() => {});
  },

  setClickToPlay: (v) => set({ clickToPlay: v }),
  setVideoPaused: (v) => set({ videoPaused: v }),

  requestTogglePlay: () => set((s) => ({ playToggleSeq: s.playToggleSeq + 1 })),
}));

export function posterForItem(server: string, id: string): string {
  return coverUrl(server, id);
}

export { streamUrl };
