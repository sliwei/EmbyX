import { BadgeInfo, ChevronDown, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import { defaultOrigin } from '../../services/mediaClient';
import { useAppStore } from '../../stores/appStore';

export function ProfileDrawer() {
  const open = useAppStore((s) => s.profileOpen);
  const setProfileOpen = useAppStore((s) => s.setProfileOpen);
  const saveServerConfig = useAppStore((s) => s.saveServerConfig);
  const resetAll = useAppStore((s) => s.resetAll);

  const serverBase = useAppStore((s) => s.serverBase);
  const useStatic = useAppStore((s) => s.useStatic);
  const autoplay = useAppStore((s) => s.autoplay);
  const deleteMode = useAppStore((s) => s.deleteMode);
  const apiKey = useAppStore((s) => s.apiKey);

  const [server, setServer] = useState('');
  const [staticChk, setStaticChk] = useState(true);
  const [autoChk, setAutoChk] = useState(true);
  const [delChk, setDelChk] = useState(false);
  const [key, setKey] = useState('');

  useEffect(() => {
    if (open) {
      setServer(serverBase || defaultOrigin());
      setStaticChk(useStatic);
      setAutoChk(autoplay);
      setDelChk(deleteMode);
      setKey(apiKey);
    }
  }, [open, serverBase, useStatic, autoplay, deleteMode, apiKey]);

  return (
    <div
      className={`fixed inset-0 z-[60] flex flex-col bg-black/95 text-white backdrop-blur-sm transition-transform duration-300 ease-in-out ${
        open ? 'translate-y-0 pointer-events-auto' : 'translate-y-full pointer-events-none'
      }`}
    >
      <div className="shrink-0 border-b border-gray-700/50 pt-[env(safe-area-inset-top)]">
        <div className="relative flex h-14 items-center justify-center px-4">
          <span className="text-base font-bold">个人中心</span>
          <button
            type="button"
            className="absolute right-5 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 active:text-gray-300"
            onClick={() => setProfileOpen(false)}
          >
            <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5">
          <div className="mb-5 mt-5">
            <h2 className="mb-5 flex items-center text-sm font-bold text-primary">
              <Server className="mr-2 h-4 w-4" strokeWidth={1.8} />
              服务器配置
            </h2>
            <div className="space-y-4 rounded-lg border border-gray-700/50 bg-gray-800/40 p-4">
              <div>
                <label className="mb-1.5 block text-xs text-gray-400">服务地址</label>
                <input
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary"
                />
                <p className="mt-1.5 text-[11px] leading-snug text-gray-500">
                  留空保存则使用当前页面 origin（Vite 开发时建议填后端完整地址）
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-gray-400">API Key（可选）</label>
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="与 Docker 服务端 X-API-KEY 一致时填写"
                  className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primary"
                />
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-transparent bg-gray-900/40 px-3 py-2.5 hover:bg-gray-800/60">
                <span className="text-sm text-gray-300">直接播放（不转码）</span>
                <input
                  type="checkbox"
                  checked={staticChk}
                  onChange={(e) => setStaticChk(e.target.checked)}
                  className="h-4 w-4 rounded border-none bg-gray-700 text-primary"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-transparent bg-gray-900/40 px-3 py-2.5 hover:bg-gray-800/60">
                <span className="text-sm text-gray-300">自动连播</span>
                <input
                  type="checkbox"
                  checked={autoChk}
                  onChange={(e) => setAutoChk(e.target.checked)}
                  className="h-4 w-4 rounded border-none bg-gray-700 text-primary"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-transparent bg-gray-900/40 px-3 py-2.5 hover:bg-gray-800/60">
                <span className="text-sm font-medium text-yellow-500/90">允许删除媒体 ⚠️</span>
                <input
                  type="checkbox"
                  checked={delChk}
                  onChange={(e) => setDelChk(e.target.checked)}
                  className="h-4 w-4 rounded border-none bg-gray-700 text-primary"
                />
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-gray-700 py-3 text-sm text-white hover:bg-gray-600 active:scale-95"
                  onClick={() => {
                    if (window.confirm('确定要重置所有配置吗？')) resetAll();
                  }}
                >
                  重置
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 active:opacity-80"
                  onClick={() =>
                    void saveServerConfig({
                      server,
                      useStatic: staticChk,
                      autoplay: autoChk,
                      deleteMode: delChk,
                      apiKey: key,
                    })
                  }
                >
                  保存
                </button>
              </div>
            </div>
          </div>

          <div className="my-5 w-full border-t border-dashed border-gray-600" />

          <div>
            <h2 className="mb-5 flex items-center text-sm font-bold text-primary">
              <BadgeInfo className="mr-2 h-4 w-4" strokeWidth={1.8} />
              关于与快捷键
            </h2>
            <div className="space-y-3 rounded-xl border border-gray-700/50 bg-gray-800/40 p-5 text-sm leading-relaxed text-gray-300">
              <p>本页为 React 重构示例，对接自建后端 GET /api/health、/api/items、/media/:id/stream。</p>
              <p className="text-xs text-gray-500">
                W/S/↑/↓ 切换 · A/D/←/→ ±15s · Space 播放暂停 · U 收藏 · J 比例 · M 静音 · I 设置 · E 视图 · R
                播放模式 · F 全屏 · G 媒体库 · V 详情
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
