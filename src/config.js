// API base: EAS `extra.apiBaseUrl` > `.env` @env > default production (Bull4X).
// For local backend only, set API_BASE_URL=http://10.0.2.2:8000 (Android) or http://127.0.0.1:8000 (iOS).
import Constants from 'expo-constants';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';

const extraUrl = Constants?.expoConfig?.extra?.apiBaseUrl;
const fromExtra = typeof extraUrl === 'string' ? extraUrl.trim() : '';
const fromDotEnv =
  typeof ENV_API_BASE_URL === 'string' && ENV_API_BASE_URL.trim()
    ? ENV_API_BASE_URL.trim().replace(/\/+$/, '')
    : '';

const PRODUCTION_DEFAULT = 'https://api.bull4x.com';

export const API_BASE_URL = fromExtra || fromDotEnv || PRODUCTION_DEFAULT;
export const API_URL = `${API_BASE_URL}/api`;
