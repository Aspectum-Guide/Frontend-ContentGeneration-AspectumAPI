import {
  BadgeDollarSign, BookOpen, Bot, Building2, Camera, ChartColumn, Check, CircleCheck, CircleX,
  ClipboardList, Clock, Compass, Download, Euro, FileText, Folder, Globe, Headphones, Hourglass,
  Image, KeyRound, Landmark, Library, Lightbulb, Link, Lock, MapPin, MessageSquare, Newspaper,
  Package, PartyPopper, PenLine, Pencil, Play, Puzzle, Receipt, RefreshCw, ScrollText, Search,
  ShieldCheck, ShoppingCart, Square, Star, Tag, Ticket, Trash2, TrendingUp, TriangleAlert, User,
  Volume2, X, Zap, ChevronDown, ChevronRight, ChevronUp, RotateCw, Upload,
} from 'lucide-react';

/**
 * Emoji used across the admin as stand-in icons (empty states, section cards, headers)
 * mapped to lucide icons. Call sites keep passing the glyph as a semantic key; the kit
 * renders the icon, so the whole app switches look in one place and stops depending on
 * each OS's emoji font. Anything not listed (flags, text symbols) is rendered as-is.
 */
export const GLYPH_ICONS = {
  '🏙': Building2, '🎟': Ticket, '📍': MapPin, '📋': ClipboardList, '🎪': PartyPopper,
  '🎧': Headphones, '📈': TrendingUp, '🔑': KeyRound, '🖼': Image, '🏷': Tag, '🧾': Receipt,
  '🕒': Clock, '🛒': ShoppingCart, '⚠': TriangleAlert, '💰': BadgeDollarSign, '🔐': ShieldCheck,
  '📜': ScrollText, '📝': FileText, '👤': User, '🧭': Compass, '🧩': Puzzle, '📰': Newspaper,
  '🏛': Landmark, '🔊': Volume2, '💶': Euro, '💡': Lightbulb, '🌐': Globe, '🔒': Lock, '📁': Folder,
  '✓': Check, '✗': X, '🔍': Search, '🔎': Search, '📊': ChartColumn, '✍': PenLine, '🔗': Link,
  '✅': CircleCheck, '❌': CircleX, '🗑': Trash2, '📄': FileText, '📚': Library, '📦': Package,
  '🔄': RefreshCw, '📷': Camera, '⬇': Download, '🤖': Bot, '⚡': Zap, '⏹': Square, '📖': BookOpen,
  '✏': Pencil, '✎': Pencil, '⏳': Hourglass, '▶': Play, '★': Star, '💬': MessageSquare, '🌍': Globe,
  '↻': RotateCw, '✕': X, '▸': ChevronRight, '▾': ChevronDown, '▼': ChevronDown, '▲': ChevronUp, '⬆': Upload,
};

// Variation selector U+FE0F follows many emoji ("🏙️"); the map is keyed without it.
export function normalizeGlyph(value) {
  return String(value ?? '').replace(/️/g, '').trim();
}

export function glyphComponent(value) {
  return typeof value === 'string' ? GLYPH_ICONS[normalizeGlyph(value)] ?? null : null;
}

/** A string that is a known glyph becomes a lucide icon; nodes and unknown strings pass through. */
export function renderIcon(icon, className = 'size-6') {
  const Icon = glyphComponent(icon);
  return Icon ? <Icon className={className} aria-hidden="true" /> : icon;
}

/**
 * An inline icon for a known glyph, sized to the surrounding text so it can replace an
 * emoji/symbol in a button label or sentence: `<Glyph name="⬇" /> Скачать`.
 * Unknown glyphs are rendered unchanged.
 */
export function Glyph({ name, className = '' }) {
  const Icon = glyphComponent(name);
  if (!Icon) return <>{name}</>;
  return <Icon aria-hidden="true" className={`inline-block size-[1.1em] shrink-0 align-[-0.15em] ${className}`.trim()} />;
}
