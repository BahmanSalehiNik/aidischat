import { NativeModules, Platform } from 'react-native';

const DEFAULT_BACKEND_PORT = 8080;
const API_PATH_REGEX = /\/api(\/|$)/i;

const isLikelyDomainName = (host: string) => /[a-z]/i.test(host);

const isPrivateIPv4 = (host: string) => {
  // Very small helper; enough for our dev overrides.
  // Matches: 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12, 127.0.0.0/8
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const [a, b] = host.split('.').map(Number);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 127) return true;
  return false;
};

const getMetroHost = (): string | null => {
  // In dev builds, React Native exposes the packager URL here, e.g.:
  // http://172.20.10.3:8083/node_modules/expo-router/entry.bundle?...
  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  if (!scriptURL) return null;
  try {
    const url = new URL(scriptURL);
    return url.hostname || null;
  } catch {
    return null;
  }
};

export const normalizeApiBaseUrl = (baseUrl?: string | null) => {
  if (!baseUrl) return '';
  const trimmed = baseUrl.trim();
  if (!trimmed) return '';

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  if (API_PATH_REGEX.test(withoutTrailingSlash)) return withoutTrailingSlash;

  return `${withoutTrailingSlash}/api`;
};

export const normalizeWsUrl = (wsUrl?: string | null) => {
  if (!wsUrl) return '';
  const trimmed = wsUrl.trim();
  if (!trimmed) return '';

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  // We expect `/api/realtime` (or a compatible path) from the env.
  return withoutTrailingSlash;
};

export const getResolvedApiBaseUrl = (envApiBaseUrl?: string | null) => {
  const normalizedEnv = normalizeApiBaseUrl(envApiBaseUrl);

  // Default to localhost for non-dev / non-android.
  const fallback = `http://localhost:${DEFAULT_BACKEND_PORT}/api`;

  // In Android dev builds, the phone often reaches Metro via a different IP than your laptop LAN IP.
  // If env points at an IP the phone can't reach, use the Metro host (same IP the phone uses for JS).
  if (__DEV__ && Platform.OS === 'android') {
    const metroHost = getMetroHost();
    if (metroHost) {
      console.log(`[network] metroHost=${metroHost} envApiBaseUrl=${normalizedEnv || '(empty)'}`);
      // If env is a public domain (ngrok / prod), keep it.
      if (normalizedEnv) {
        try {
          const envUrl = new URL(normalizedEnv);
          if (isLikelyDomainName(envUrl.hostname) && !isPrivateIPv4(envUrl.hostname)) {
            return normalizedEnv;
          }

          // If env host is a private IP and differs from metro host, override host to metro host
          // but keep scheme + port (common: http://<ip>:8080/api).
          if (isPrivateIPv4(envUrl.hostname) && envUrl.hostname !== metroHost) {
            const scheme = envUrl.protocol.replace(':', '') || 'http';
            const port = envUrl.port || String(DEFAULT_BACKEND_PORT);
            const resolved = normalizeApiBaseUrl(`${scheme}://${metroHost}:${port}${envUrl.pathname}`);
            console.log(`[network] resolvedApiBaseUrl=${resolved}`);
            return resolved;
          }
        } catch {
          // ignore and fall through
        }
      }

      // No env value (or unparseable): use metro host.
      const resolved = `http://${metroHost}:${DEFAULT_BACKEND_PORT}/api`;
      console.log(`[network] resolvedApiBaseUrl=${resolved}`);
      return resolved;
    }
  }

  return normalizedEnv || fallback;
};

export const getResolvedWsUrl = (envWsUrl?: string | null) => {
  const normalizedEnv = normalizeWsUrl(envWsUrl);
  const fallback = `ws://localhost:${DEFAULT_BACKEND_PORT}/api/realtime`;

  if (__DEV__ && Platform.OS === 'android') {
    const metroHost = getMetroHost();
    if (metroHost) {
      console.log(`[network] metroHost=${metroHost} envWsUrl=${normalizedEnv || '(empty)'}`);
      if (normalizedEnv) {
        try {
          const envUrl = new URL(normalizedEnv);
          if (isLikelyDomainName(envUrl.hostname) && !isPrivateIPv4(envUrl.hostname)) {
            return normalizedEnv;
          }

          if (isPrivateIPv4(envUrl.hostname) && envUrl.hostname !== metroHost) {
            const scheme = envUrl.protocol.replace(':', '') || 'ws';
            const port = envUrl.port || String(DEFAULT_BACKEND_PORT);
            // Preserve path if provided; otherwise default to /api/realtime
            const path = envUrl.pathname && envUrl.pathname !== '/' ? envUrl.pathname : '/api/realtime';
            const resolved = `${scheme}://${metroHost}:${port}${path}`;
            console.log(`[network] resolvedWsUrl=${resolved}`);
            return resolved;
          }
        } catch {
          // ignore
        }
      }

      const resolved = `ws://${metroHost}:${DEFAULT_BACKEND_PORT}/api/realtime`;
      console.log(`[network] resolvedWsUrl=${resolved}`);
      return resolved;
    }
  }

  return normalizedEnv || fallback;
};


