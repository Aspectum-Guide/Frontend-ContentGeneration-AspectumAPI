// ─── Multilingual dictionary ──────────────────────────────────────────────────
export type LangCode = string;
export type MultilangDict = Partial<Record<LangCode, string>>;

// ─── IDs ─────────────────────────────────────────────────────────────────────
export type UUID = string;

// ─── Pagination / common API ─────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ─── Session ─────────────────────────────────────────────────────────────────
export type SessionStatus =
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'published'
  | 'closed_saved'
  | 'closed_discarded'
  | 'corrected';

export interface Session {
  id: UUID;
  session_uuid: UUID;
  name: string;
  description: string;
  status: SessionStatus;
  status_display: string;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_with_save?: boolean;
  upload_batch_id: UUID | null;
  upload_batch_order: number;
  city: SessionCity | null;
  city_drafts: CityDraft[];
  attractions: SessionAttraction[];
  interactive_locations: SessionInteractiveLocation[];
  city_infos: SessionCityInfo[];
  attraction_infos: SessionAttractionInfo[];
  attraction_feed_items: SessionAttractionFeedItem[];
  attraction_audio_guides: SessionAttractionAudioGuide[];
}

// ─── City ────────────────────────────────────────────────────────────────────
export interface SessionCity {
  id: UUID;
  name: MultilangDict;
  description: MultilangDict;
  country: MultilangDict | string;
  lat: number | null;
  lon: number | null;
  tags: string[];
  city_tags?: string[];
  image_id: UUID | null;
  image_url: string | null;
  image_original_url: string | null;
  image_copyright: string | null;
  [key: string]: unknown;
}

export interface CityDraft {
  id: UUID;
  name: MultilangDict;
  description: MultilangDict;
  country: MultilangDict | string;
  lat: number | null;
  lon: number | null;
  tags: string[];
  order: number;
  is_primary: boolean;
  image_id: UUID | null;
  image_url: string | null;
  image_original_url: string | null;
  image_copyright: string | null;
  created_at?: string;
  [key: string]: unknown;
}

// ─── Attraction ──────────────────────────────────────────────────────────────
export type AssignedCityType = 'none' | 'database' | 'draft';

export interface SessionAttraction {
  id: UUID;
  name: MultilangDict;
  description: MultilangDict;
  lat: number | null;
  lon: number | null;
  index: number;
  rank: number;
  city: UUID | null;
  city_id: UUID | null;
  session_city: UUID | null;
  session_city_id: UUID | null;
  assigned_city_type: AssignedCityType;
  image_id: UUID | null;
  image_url: string | null;
  image_original_url: string | null;
  image_copyright: string | null;
  tags: string[];
  contents: Record<LangCode, AttractionContent>;
}

export interface AttractionContent {
  text: string;
  audio_id: UUID | null;
  audio_filename: string | null;
}

// ─── Interactive Location ─────────────────────────────────────────────────────
export interface SessionInteractiveLocation {
  id: UUID;
  name: MultilangDict;
  description: MultilangDict;
  lat: number | null;
  lon: number | null;
  index: number;
  order: number;
  rank: number;
  city: UUID | null;
  city_id: UUID | null;
  session_city: UUID | null;
  session_city_id: UUID | null;
  assigned_city_type: AssignedCityType;
  assigned_city_name: string | null;
  image_id: UUID | null;
  image_url: string | null;
  image_original_url: string | null;
  image_copyright: string | null;
  tags: string[];
  published_interactive_location_id: UUID | null;
}

// ─── City Info ───────────────────────────────────────────────────────────────
export interface SessionCityInfo {
  id: UUID;
  name: MultilangDict;
  description: MultilangDict;
  city: UUID | null;
  session_city_draft: UUID | null;
  index: number;
}

// ─── Attraction Info ─────────────────────────────────────────────────────────
export interface SessionAttractionInfo {
  id: UUID;
  name: MultilangDict;
  description: MultilangDict;
  attraction: UUID | null;
  event: UUID | null;
  index: number;
}

// ─── Feed Item ───────────────────────────────────────────────────────────────
export type FeedItemType = 'text' | 'image';

export interface SessionAttractionFeedItem {
  id: UUID;
  name: MultilangDict;
  description: MultilangDict;
  text: MultilangDict;
  lat: number | null;
  lon: number | null;
  index: number;
  item_type: FeedItemType;
  attraction: UUID | null;
  event: UUID | null;
  image_id: UUID | null;
  image_url: string | null;
  image_original_url: string | null;
  image_copyright: string | null;
}

// ─── Audio Guide ─────────────────────────────────────────────────────────────
export interface AudioGuideTrack {
  id: UUID;
  language: string;
  audio_id: UUID | null;
  audio_filename: string | null;
}

export interface SessionAttractionAudioGuide {
  id: UUID;
  name: MultilangDict;
  description: MultilangDict;
  attraction: UUID | null;
  event: UUID | null;
  tracks: AudioGuideTrack[];
  content_plan: AudioGuidePlanItem[] | null;
  content_texts: Record<LangCode, string> | null;
}

export interface AudioGuidePlanItem {
  id: string;
  title: string;
  duration_seconds: number;
}

// ─── Generation Task ─────────────────────────────────────────────────────────
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface GenerationTask {
  id: UUID;
  session_id: UUID;
  task_type: string;
  task_type_display: string;
  status: TaskStatus;
  status_display: string;
  progress: number;
  current_step: string;
  result_data: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

// ─── Image / Media ───────────────────────────────────────────────────────────
export interface UploadedImage {
  id: UUID;
  url: string;
  copyright: string | null;
}

// ─── Reference data ──────────────────────────────────────────────────────────
export interface ReferenceCity {
  id: UUID;
  name: MultilangDict;
  country: MultilangDict | string;
  lat: number | null;
  lon: number | null;
}

export interface ReferenceAttraction {
  id: UUID;
  name: MultilangDict;
  description: MultilangDict;
  city: UUID | null;
}

// ─── Tags / Filters ──────────────────────────────────────────────────────────
export interface FilterItem {
  id: UUID;
  name: MultilangDict;
  type: string;
  parent: UUID | null;
  children?: FilterItem[];
  image_id?: UUID | null;
  image_url?: string | null;
}

// ─── AI Generation ───────────────────────────────────────────────────────────
export type GenerationMode = 'basic' | 'advanced';

export interface AiGenerationStartResponse {
  task_id: UUID;
}

export interface AiSettings {
  provider: string;
  model: string;
  api_key: string;
  base_url: string;
}

// ─── Publish ─────────────────────────────────────────────────────────────────
export interface PublishConflict {
  session_id: UUID;
  existing_city_id: UUID | null;
  existing_event_id: UUID | null;
  conflict_type: string;
}

export interface PublishResult {
  city_id?: UUID;
  event_id?: UUID;
  [key: string]: unknown;
}

// ─── Locale ──────────────────────────────────────────────────────────────────
export interface LocaleDef {
  key: string;
  lang: string;
  code: string;
  langName: string;
  isDefault: boolean;
}

export interface LocaleDataEntry {
  name: string;
  description: string;
  country: string;
  isDefault: boolean;
  lang?: string;
  [key: string]: unknown;
}

export type LocaleData = Record<string, LocaleDataEntry>;
