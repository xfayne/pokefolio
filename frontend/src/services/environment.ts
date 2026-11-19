import { z } from 'zod';

export const STAGING_API = 'https://pokefolio-api-staging.xfayne.workers.dev';
const schema = z.object({
  firebase: z.object({
    projectId: z.literal('pokefolio-staging'),
    authDomain: z.literal('pokefolio-staging.firebaseapp.com'),
    appId: z.literal('1:403637067452:web:ea6738aebf38f14c637ab9'),
    apiKey: z.string().regex(/^AIza[A-Za-z0-9_-]{35}$/),
  }).strict(),
  workerUrl: z.union([z.literal(STAGING_API), z.literal('')]),
}).strict();
export type StagingEnvironment = z.infer<typeof schema>;
export function parseEnvironment(raw: string | undefined): StagingEnvironment | null {
  if (!raw) return null;
  return schema.parse(JSON.parse(raw));
}
// Missing config is disconnected development; invalid config fails closed.
export function getEnvironment() { return parseEnvironment(import.meta.env.VITE_POKEFOLIO_CONFIG); }
