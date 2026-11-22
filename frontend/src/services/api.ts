import axios from 'axios';
import { STAGING_API } from './environment';

export function createApiClient(baseURL: string, token: () => Promise<string | null>) {
  if (baseURL !== STAGING_API) throw new Error('Unapproved API endpoint');
  const client = axios.create({ baseURL, timeout: 20_000, allowAbsoluteUrls: false });
  client.interceptors.request.use(async (config) => {
    // Axios instances are mutable. Validate again before obtaining a bearer token.
    if (config.baseURL !== STAGING_API || !config.url?.startsWith('/') || config.url.startsWith('//') || /[\\?#]/.test(config.url) || config.url.includes('..')) {
      throw new Error('API requests require an approved origin and relative path');
    }
    const value = await token();
    if (value) config.headers.set('Authorization', `Bearer ${value}`);
    return config;
  });
  return client;
}
