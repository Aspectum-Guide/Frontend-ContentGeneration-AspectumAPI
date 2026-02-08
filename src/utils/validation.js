import { z } from 'zod';

// Схема валидации для создания сессии
export const createSessionSchema = z.object({
  name: z.string().optional(),
  content_type: z.enum(['city_only', 'city_with_attractions']).default('city_only'),
  use_ai: z.boolean().default(true),
  target_languages: z.array(z.string()).min(2, 'Необходимо выбрать минимум 2 языка'),
  notes: z.string().optional(),
});

// Схема валидации для города
export const citySchema = z.object({
  name: z.record(z.string(), z.string()).refine(
    (obj) => Object.keys(obj).length > 0,
    'Необходимо указать название хотя бы на одном языке'
  ),
  description: z.record(z.string(), z.string()).optional(),
  country: z.string().min(1, 'Необходимо указать страну'),
  main_image: z.instanceof(File).optional(),
});

// Схема валидации для достопримечательности
export const attractionSchema = z.object({
  name: z.record(z.string(), z.string()).refine(
    (obj) => Object.keys(obj).length > 0,
    'Необходимо указать название хотя бы на одном языке'
  ),
  description: z.record(z.string(), z.string()).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  order: z.number().int().min(0),
});

// Схема валидации для контента
export const contentSchema = z.object({
  language: z.string().min(1, 'Необходимо указать язык'),
  title: z.record(z.string(), z.string()).optional(),
  content: z.record(z.string(), z.string()).optional(),
  short_description: z.record(z.string(), z.string()).optional(),
  long_description: z.record(z.string(), z.string()).optional(),
});
