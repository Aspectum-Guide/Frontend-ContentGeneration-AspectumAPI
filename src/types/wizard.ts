import type {
  UUID,
  Session,
  CityDraft,
  SessionAttraction,
  SessionInteractiveLocation,
  SessionCityInfo,
  SessionAttractionInfo,
  SessionAttractionFeedItem,
  SessionAttractionAudioGuide,
  LocaleData,
  FilterItem,
  ReferenceCity,
  ReferenceAttraction,
  GenerationTask,
  TaskStatus,
  GenerationMode,
  MultilangDict,
  FeedItemType,
  LocaleDef,
} from './models';

// ─── Shared context passed to all sub-hooks ───────────────────────────────────
export interface WizardContext {
  // Core
  sessionId: UUID | null;
  session: Session | null;
  setSession: React.Dispatch<React.SetStateAction<Session | null>>;
  showNote: (msg: string, type?: string) => void;
  loadSession: (draftId?: UUID | null, opts?: LoadSessionOpts) => Promise<void>;
  confirm: (message: string) => Promise<boolean>;

  // Locale
  localeData: LocaleData;
  setLocaleData: React.Dispatch<React.SetStateAction<LocaleData>>;
  activeLocale: string;
  setActiveLocale: React.Dispatch<React.SetStateAction<string>>;
  defaultLocale: string;
  setDefaultLocale: React.Dispatch<React.SetStateAction<string>>;

  // City drafts
  cityDrafts: CityDraft[];
  setCityDrafts: React.Dispatch<React.SetStateAction<CityDraft[]>>;
  activeCityDraftId: UUID | null;
  setActiveCityDraftId: React.Dispatch<React.SetStateAction<UUID | null>>;
  activeCityDraftIdRef: React.MutableRefObject<UUID | null>;

  // Reference data
  referenceCities: ReferenceCity[];
  referenceAttractions: ReferenceAttraction[];

  // Navigation
  currentStep: number;
  currentStepRef: React.MutableRefObject<number>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  TOTAL_STEPS: number;

  // Dirty tracking
  hasUnsavedChangesRef: React.MutableRefObject<boolean>;

  // Saving states
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  savingRef: React.MutableRefObject<boolean>;
}

export interface LoadSessionOpts {
  silent?: boolean;
  force?: boolean;
  preserveCurrentEditors?: boolean;
}

// ─── City step return type ────────────────────────────────────────────────────
export interface CityStepState {
  // Locale
  localeData: LocaleData;
  activeLocale: string;
  defaultLocale: string;
  addLocaleOpen: boolean;
  newLocaleCode: string;
  newLocaleLang: string;

  // Coordinates
  lat: string;
  lon: string;
  savedLat: number | null;
  savedLon: number | null;

  // Image
  imageId: UUID | null;
  imagePreview: string;
  imageOriginalUrl: string;
  imageCopyright: string;
  photoUploading: boolean;
  commonsModalOpen: boolean;
  commonsTarget: { type: string; entityId: UUID | null };

  // Tags
  cityTags: string[];
  tagInput: string;

  // Saving
  saving: boolean;
  autoSaving: boolean;
  autoSaved: boolean;

  // City drafts
  cityDrafts: CityDraft[];
  activeCityDraftId: UUID | null;
}

export interface CityStepActions {
  switchLocale: (locale: string) => void;
  setDefaultLocale: (locale: string) => void;
  addLocale: (code: string, langName: string) => void;
  removeLocale: (key: string) => void;
  updateLocaleField: (field: string, value: string) => void;
  setAddLocaleOpen: (open: boolean) => void;
  setNewLocaleCode: (code: string) => void;
  setNewLocaleLang: (lang: string) => void;

  setLat: (lat: string) => void;
  setLon: (lon: string) => void;
  setSavedLat: (lat: number | null) => void;
  setSavedLon: (lon: number | null) => void;
  setMapContainerRef: (el: HTMLDivElement | null) => void;

  setImageId: (id: UUID | null) => void;
  setImagePreview: (url: string) => void;
  setImageOriginalUrl: (url: string) => void;
  setImageCopyright: (copyright: string) => void;
  handlePhotoFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handlePhotoDelete: () => void;
  setCommonsModalOpen: (open: boolean) => void;
  setCommonsTarget: (target: { type: string; entityId: UUID | null }) => void;
  onCommonsImageSelect: (image: { url: string; id?: UUID; copyright?: string }) => void;

  setCityTags: React.Dispatch<React.SetStateAction<string[]>>;
  setTagInput: (input: string) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  handleTagKeyDown: (e: React.KeyboardEvent) => void;
  handleTagBlur: () => void;
  toggleCityTag: (tagId: string) => void;

  saveCityForStep1: () => Promise<void>;
  saveCitySilently: () => Promise<void>;
  handleSelectDraft: (draftId: UUID) => Promise<void>;
  handleCreateDraft: () => Promise<void>;
  handleDeleteDraft: (draftId: UUID) => Promise<void>;
  syncActiveDraftRoute: (draftId: UUID | null) => void;

  // City filters
  cityFilterTree: FilterItem[];
  cityFilterTreeLoading: boolean;
  uploadCityFilterImage: (filterId: UUID, file: File) => Promise<void>;
  createCityFilterFolder: (name: string, parentId?: UUID | null) => Promise<void>;
  createCityFilterTag: (name: string, folderId: UUID) => Promise<void>;
  createCityTag: (name: string, folderId: UUID) => Promise<void>;
  updateCityFilter: (filterId: UUID, data: Partial<FilterItem>) => Promise<void>;
  deleteCityFilter: (filterId: UUID) => Promise<void>;
}

// ─── Attractions step return type ─────────────────────────────────────────────
export interface AttractionsStepState {
  attractions: SessionAttraction[];
  currentAttr: SessionAttraction | null;
  attrView: 'list' | 'detail';
  attrLocaleData: Record<string, { name: string; description: string }>;
  attrActiveLocale: string;
  attrSaving: boolean;
  attrAutoSaving: boolean;
  attrAutoSaved: boolean;

  // Sub-entities
  currentAttractionInfo: SessionAttractionInfo | null;
  currentAttractionFeedItem: SessionAttractionFeedItem | null;
  currentAttractionAudioGuide: SessionAttractionAudioGuide | null;

  // AI generation
  attractionGenerationOpen: boolean;
  attractionGenerationPrompt: string;
  attractionGenerating: boolean;
  attractionGenerationTaskId: UUID | null;
  attractionGenerationProgress: { status: TaskStatus; progress: number; step: string } | null;
  attractionGenerationError: string;
  attractionGenerationAssignedCityType: string;
  attractionGenerationSessionCityId: string;
  attractionGenerationDatabaseCityId: string;
  attractionGenerationLang: string;
  attractionGenerationCount: number;
  attractionDedupeExistingItems: boolean;

  // Photo
  attractionPhotoUploading: boolean;
  attractionPhotoFileRef: React.RefObject<HTMLInputElement>;
}

export interface AttractionsStepActions {
  openAttrDetail: (attrId: UUID) => Promise<void>;
  addAttraction: () => Promise<void>;
  deleteCurrentAttr: () => Promise<void>;
  saveCurrentAttr: (opts?: { silent?: boolean }) => Promise<void>;
  saveCurrentAttrIfDirty: (opts?: { silent?: boolean }) => Promise<void>;
  updateAttrLocaleField: (field: string, value: string) => void;
  updateCurrentAttrPatch: (patch: Partial<SessionAttraction>) => void;
  persistAttractionImage: (file: File) => Promise<void>;
  toggleCurrentAttractionTag: (tagId: string) => void;
  onSetAttrView: (view: 'list' | 'detail') => void;
  onSetCurrentAttr: (attr: SessionAttraction | null) => void;
  onSetAttrActiveLocale: (locale: string) => void;
  onAttractionPhotoFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenAttractionCommonsModal: () => void;

  // Sub-entity actions
  setCurrentAttractionInfo: (info: SessionAttractionInfo | null) => void;
  openAttractionInfoDetail: (infoId: UUID) => void;
  addAttractionInfo: () => void;
  updateCurrentAttractionInfoPatch: (patch: Partial<SessionAttractionInfo>) => void;
  saveCurrentAttractionInfo: () => Promise<void>;
  deleteCurrentAttractionInfo: () => Promise<void>;

  setCurrentAttractionFeedItem: (item: SessionAttractionFeedItem | null) => void;
  openAttractionFeedItemDetail: (itemId: UUID) => void;
  addAttractionFeedItem: (type: FeedItemType) => void;
  updateCurrentAttractionFeedItemPatch: (patch: Partial<SessionAttractionFeedItem>) => void;
  saveCurrentAttractionFeedItem: () => Promise<void>;
  deleteCurrentAttractionFeedItem: () => Promise<void>;
  handleAttractionFeedPhotoFile: (e: React.ChangeEvent<HTMLInputElement>) => void;

  setCurrentAttractionAudioGuide: (guide: SessionAttractionAudioGuide | null) => void;
  openAttractionAudioGuideDetail: (guideId: UUID) => void;
  addAttractionAudioGuide: () => void;
  updateCurrentAttractionAudioGuidePatch: (patch: Partial<SessionAttractionAudioGuide>) => void;
  saveCurrentAttractionAudioGuide: () => Promise<void>;
  deleteCurrentAttractionAudioGuide: () => Promise<void>;

  // AI generation actions
  openAttractionGenerationModal: () => void;
  closeAttractionGenerationModal: () => void;
  setAttractionGenerationPrompt: (prompt: string) => void;
  setAttractionGenerationAssignedCityTypeSafe: (type: string) => void;
  setAttractionGenerationSessionCityId: (id: string) => void;
  setAttractionGenerationDatabaseCityId: (id: string) => void;
  setAttractionGenerationLang: (lang: string) => void;
  setAttractionGenerationCount: (count: number) => void;
  setAttractionDedupeExistingItems: (val: boolean) => void;
  generateAttractionsFromPrompt: () => Promise<void>;
}

// ─── Interactive locations step return type ────────────────────────────────────
export interface IlStepState {
  interactiveLocations: SessionInteractiveLocation[];
  currentIl: SessionInteractiveLocation | null;
  ilView: 'list' | 'detail';
  ilLocaleData: Record<string, { name: string; description: string }>;
  ilActiveLocale: string;
  ilSaving: boolean;
  ilAutoSaving: boolean;
  ilAutoSaved: boolean;

  // AI generation
  ilGenerationOpen: boolean;
  ilGenerationPrompt: string;
  ilGenerating: boolean;
  ilGenerationTaskId: UUID | null;
  ilGenerationProgress: { status: TaskStatus; progress: number; step: string } | null;
  ilGenerationError: string;
  ilGenerationAssignedCityType: string;
  ilGenerationSessionCityId: string;
  ilGenerationDatabaseCityId: string;
  ilGenerationLang: string;
  ilDedupeExistingLocations: boolean;
  ilGenerationCount: number;

  // Photo
  ilPhotoUploading: boolean;
  ilPhotoFileRef: React.RefObject<HTMLInputElement>;
}

export interface IlStepActions {
  openIlDetail: (ilId: UUID) => Promise<void>;
  addInteractiveLocation: () => Promise<void>;
  deleteCurrentIl: () => Promise<void>;
  saveCurrentIl: (opts?: { silent?: boolean }) => Promise<void>;
  saveCurrentIlIfDirty: (opts?: { silent?: boolean }) => Promise<void>;
  updateIlLocaleField: (field: string, value: string) => void;
  updateCurrentIlPatch: (patch: Partial<SessionInteractiveLocation>) => void;
  persistInteractiveLocationImage: (file: File) => Promise<void>;
  toggleCurrentIlTag: (tagId: string) => void;
  handleIlPhotoFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  leaveIlDetailView: () => void;

  // AI generation
  openIlGenerationModal: () => void;
  closeIlGenerationModal: () => void;
  setIlGenerationPrompt: (prompt: string) => void;
  setIlGenerationAssignedCityTypeSafe: (type: string) => void;
  setIlGenerationSessionCityId: (id: string) => void;
  setIlGenerationDatabaseCityId: (id: string) => void;
  setIlGenerationLang: (lang: string) => void;
  setIlDedupeExistingLocations: (val: boolean) => void;
  setIlGenerationCount: (count: number) => void;
  generateInteractiveLocationsFromPrompt: () => Promise<void>;

  // Filters
  eventFilterTree: FilterItem[];
  eventFilterTreeLoading: boolean;
}

// ─── Tags step return type ────────────────────────────────────────────────────
export interface TagsStepState {
  cityFilterTree: FilterItem[];
  cityFilterTreeLoading: boolean;
  cityFilterTreeError: string;
  eventFilterTree: FilterItem[];
  eventFilterTreeLoading: boolean;
  eventFilterTreeError: string;
  cityTagCatalog: FilterItem[];
  cityTagCatalogLoading: boolean;
  cityTagCatalogError: string;
  deletingCityFilterIds: Set<UUID>;
  deletingEventFilterIds: Set<UUID>;
}

export interface TagsStepActions {
  loadCityFilterTree: () => Promise<void>;
  loadEventFilterTree: () => Promise<void>;
  loadCityTagCatalog: () => Promise<void>;
  uploadCityFilterImage: (filterId: UUID, file: File) => Promise<void>;
  createCityFilterFolder: (name: string, parentId?: UUID | null) => Promise<void>;
  createCityFilterTag: (name: string, folderId: UUID) => Promise<void>;
  createCityTag: (name: string, folderId: UUID) => Promise<void>;
  updateCityFilter: (filterId: UUID, data: Partial<FilterItem>) => Promise<void>;
  deleteCityFilter: (filterId: UUID) => Promise<void>;
  uploadEventFilterImage: (filterId: UUID, file: File) => Promise<void>;
  createEventFilterFolder: (name: string, parentId?: UUID | null) => Promise<void>;
  createEventFilterTag: (name: string, folderId: UUID) => Promise<void>;
  updateEventFilter: (filterId: UUID, data: Partial<FilterItem>) => Promise<void>;
  deleteEventFilter: (filterId: UUID) => Promise<void>;
}

// ─── Publish step return type ─────────────────────────────────────────────────
export interface PublishStepState {
  preparingPublishStep: boolean;
  closeOpen: boolean;
  closeMode: 'save' | 'discard';
  closing: boolean;
  publishing: boolean;
  translating: boolean;
}

export interface PublishStepActions {
  handleClose: () => Promise<void>;
  handlePublish: () => Promise<void>;
  handleTranslateSession: () => Promise<void>;
  setCloseOpen: (open: boolean) => void;
  setCloseMode: (mode: 'save' | 'discard') => void;
}

// ─── Audio guides return type ─────────────────────────────────────────────────
export interface AudioGuidesState {
  currentAttractionAudioGuide: SessionAttractionAudioGuide | null;
  attractionAudioGuideActiveLocale: string;
  attractionAudioGuideSaving: boolean;
  attractionAudioGuideAutoSaving: boolean;
  attractionAudioGuideAutoSaved: boolean;
  audioGuidePlanGenerationState: 'idle' | 'generating' | 'done' | 'error';
  audioGuideTtsVoiceId: string;
  audioGuideTtsModelId: string;
  elevenLabsSettingsLoading: boolean;
  elevenLabsSettingsError: string | null;
}

export interface AudioGuidesActions {
  setCurrentAttractionAudioGuide: (guide: SessionAttractionAudioGuide | null) => void;
  setAttractionAudioGuideActiveLocale: (locale: string) => void;
  openAttractionAudioGuideDetail: (guideId: UUID) => void;
  addAttractionAudioGuide: () => void;
  updateCurrentAttractionAudioGuidePatch: (patch: Partial<SessionAttractionAudioGuide>) => void;
  updateAttractionAudioGuideLocaleField: (field: string, value: string) => void;
  saveCurrentAttractionAudioGuide: () => Promise<void>;
  deleteCurrentAttractionAudioGuide: () => Promise<void>;
  uploadAttractionAudioGuideTrack: (guideId: UUID, file: File, lang: string) => Promise<void>;
  removeAttractionAudioGuideTrack: (guideId: UUID, trackId: UUID) => Promise<void>;
  generateAttractionAudioGuideTrackAudio: (guideId: UUID, trackId: UUID) => Promise<void>;
  generateAttractionAudioGuidePlan: () => Promise<void>;
  setAttractionAudioGuidePlanGenerationPrompt: (prompt: string) => void;
  setAttractionAudioGuideItemsCount: (count: number) => void;
  generateAttractionAudioGuideMainText: () => Promise<void>;
  generateAttractionAudioGuideMainTextItem: (itemId: string) => Promise<void>;
  loadElevenLabsSettings: () => Promise<void>;
  updateAudioGuideTtsVoiceId: (voiceId: string) => void;
  updateAudioGuideTtsModelId: (modelId: string) => void;
}
