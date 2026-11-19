import { describe, expect, it } from 'vitest';
import { parseEnvironment, STAGING_API } from './environment';
const config = { firebase: { projectId: 'pokefolio-staging', authDomain: 'pokefolio-staging.firebaseapp.com', appId: '1:403637067452:web:ea6738aebf38f14c637ab9', apiKey: 'AIza' + 'a'.repeat(35) }, workerUrl: STAGING_API };
describe('isolated environment', () => {
  it('allows disconnected development and exact staging configuration', () => {
    expect(parseEnvironment(undefined)).toBeNull();
    expect(parseEnvironment(JSON.stringify(config))).toEqual(config);
  });
  it.each(['pokefolio-production', 'vintage-binder', ''])('rejects a foreign project: %s', (projectId) => {
    expect(() => parseEnvironment(JSON.stringify({ ...config, firebase: { ...config.firebase, projectId } }))).toThrow();
  });
  it('rejects custom Firebase endpoints and alternate API origins', () => {
    expect(() => parseEnvironment(JSON.stringify({ ...config, firebase: { ...config.firebase, databaseURL: 'https://foreign.example' } }))).toThrow();
    expect(() => parseEnvironment(JSON.stringify({ ...config, workerUrl: STAGING_API + '.evil.test' }))).toThrow();
  });
});
