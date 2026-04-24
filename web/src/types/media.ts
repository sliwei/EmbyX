export interface LibraryRow {
  id: string;
  name: string;
  mount_path: string;
}

export interface ItemDto {
  id: number;
  library_id: number;
  name: string;
  rel_path: string;
  duration_ms: number;
  position_ms: number;
}

export interface ItemsResponse {
  items: ItemDto[];
  next_after_id: number | null;
  total: number;
}

export interface ItemDetail {
  id: number;
  container: string;
  size_bytes: number;
  codec_hint: string;
  duration_ms: number;
  rel_path: string;
}

export interface PlaybackPayload {
  file_id: number;
  position_ms: number;
  duration_ms: number;
}

export interface NormalizedVideo {
  id: string;
  name: string;
  durationMs: number;
  positionMs: number;
  resumeSec: number;
}
