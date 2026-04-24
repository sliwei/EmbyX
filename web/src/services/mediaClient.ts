import type { ItemDetail, ItemsResponse, LibraryRow, PlaybackPayload } from '../types/media';

const LOCAL_TOKEN = '__LOCAL_MEDIA__';

export function defaultOrigin(): string {
  try {
    return String(window.location.origin || '').replace(/\/$/, '');
  } catch {
    return '';
  }
}

function headers(apiKey: string): HeadersInit {
  const h: Record<string, string> = {};
  if (apiKey.trim()) h['x-api-key'] = apiKey.trim();
  return h;
}

export async function getHealth(server: string, apiKey: string): Promise<boolean> {
  const res = await fetch(`${server.replace(/\/$/, '')}/api/health`, { headers: headers(apiKey) });
  return res.ok;
}

export async function listLibraries(server: string, apiKey: string): Promise<LibraryRow[]> {
  const res = await fetch(`${server.replace(/\/$/, '')}/api/libraries`, { headers: headers(apiKey) });
  if (!res.ok) throw new Error(`libraries ${res.status}`);
  const j = (await res.json()) as { libraries?: LibraryRow[] };
  return j.libraries ?? [];
}

export type FetchItemsParams = {
  server: string;
  apiKey: string;
  limit?: number;
  libraryId?: string | null;
  afterId?: string | null;
  random?: boolean;
  ids?: string[];
};

export async function fetchItems(p: FetchItemsParams): Promise<ItemsResponse> {
  const base = p.server.replace(/\/$/, '');
  const q = new URLSearchParams();
  q.set('limit', String(p.limit ?? 99));
  if (p.random) q.set('random', '1');
  if (p.libraryId && p.libraryId !== 'favorites') q.set('library_id', p.libraryId);
  if (p.afterId) q.set('after_id', p.afterId);
  if (p.ids?.length) q.set('ids', p.ids.join(','));

  const res = await fetch(`${base}/api/items?${q}`, { headers: headers(p.apiKey) });
  if (!res.ok) throw new Error(`items ${res.status}`);
  return res.json() as Promise<ItemsResponse>;
}

export async function fetchItemDetail(server: string, apiKey: string, id: string): Promise<ItemDetail> {
  const base = server.replace(/\/$/, '');
  const res = await fetch(`${base}/api/items/${encodeURIComponent(id)}/detail`, {
    headers: headers(apiKey),
  });
  if (!res.ok) throw new Error(`detail ${res.status}`);
  return res.json() as Promise<ItemDetail>;
}

export async function postPlayback(server: string, apiKey: string, body: PlaybackPayload): Promise<void> {
  const base = server.replace(/\/$/, '');
  await fetch(`${base}/api/playback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers(apiKey) },
    body: JSON.stringify(body),
  });
}

export function streamUrl(server: string, id: string): string {
  return `${server.replace(/\/$/, '')}/media/${id}/stream`;
}

export function coverUrl(server: string, id: string): string {
  return `${server.replace(/\/$/, '')}/covers/${id}.jpg`;
}

export { LOCAL_TOKEN };

export async function deleteItem(server: string, apiKey: string, id: string): Promise<void> {
  const base = server.replace(/\/$/, '');
  const res = await fetch(`${base}/api/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(apiKey),
  });
  if (!res.ok) throw new Error(`delete ${res.status}`);
}
