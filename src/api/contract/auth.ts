import { z } from 'zod';

export const AuthLoginRequestSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});
export type AuthLoginRequest = z.infer<typeof AuthLoginRequestSchema>;

// Минимальный контракт, который реально использует фронт.
export const AuthTokenPairSchema = z.object({
  access: z.string().min(1),
  refresh: z.string().min(1),
});
export type AuthTokenPair = z.infer<typeof AuthTokenPairSchema>;

