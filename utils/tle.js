import { TLE_CACHE_MS } from './constants.js';

const CACHE_KEY   = 'iss_tle_data';
const CACHE_TS_KEY = 'iss_tle_ts';

const TLE_URLS = [
  '/tle-proxy?CATNR=25544&FORMAT=TLE',                         
  'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE', 
];

const FALLBACK_TLE = `ISS (ZARYA)
1 25544U 98067A   25174.50000000  .00016717  00000-0  10270-3 0  9999
2 25544  51.6406 208.9163 0001842 121.0000 239.1617 15.49965766100000`;


/**
 * @param {string} raw
 * @returns {{ name: string, line1: string, line2: string }}
 */
export function parseTLEString(raw) {
  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 2) {
    return { name: 'ISS (ZARYA)', line1: lines[0], line2: lines[1] };
  }
  if (lines.length >= 3) {
    return { name: lines[0], line1: lines[1], line2: lines[2] };
  }
  throw new Error(`Unexpected TLE format (${lines.length} lines)`);
}

/**
 * @param {string[]} urls
 * @returns {Promise<string>}
 */
async function fetchFirstSuccess(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const text = await res.text();
        if (text.includes('1 25544')) return text; 
      }
    } catch (_) {
      //Tries Next URL (Why am i writing so many comments?)
    }
  }
  throw new Error('All TLE URLs failed');
}

/**
 *
 * @param {{ onStatus?: (msg: string) => void }} [opts]
 * @returns {Promise<{ name: string, line1: string, line2: string, fromCache: boolean, fromFallback: boolean, fetchedAt: number }>}
 */
export async function fetchTLE(opts = {}) {
  const status = opts.onStatus ?? (() => {});

  // 1. Check sessionStorage cache
  try {
    const cachedTs   = Number(sessionStorage.getItem(CACHE_TS_KEY) ?? 0);
    const cachedData = sessionStorage.getItem(CACHE_KEY);
    if (cachedData && Date.now() - cachedTs < TLE_CACHE_MS) {
      status('Using cached TLE data');
      return { ...JSON.parse(cachedData), fromCache: true, fromFallback: false, fetchedAt: cachedTs };
    }
  } catch (_) { /* sessionStorage may be unavailable */ }

  // 2. Try network
  let raw;
  let fromFallback = false;
  try {
    status('Fetching live TLE from Celestrak…');
    raw = await fetchFirstSuccess(TLE_URLS);
    status('TLE fetched ✓');
  } catch (err) {
    console.warn('[TLE] Network fetch failed, using fallback TLE:', err.message);
    status('Using fallback TLE (offline mode)');
    raw = FALLBACK_TLE;
    fromFallback = true;
  }

  const parsed = parseTLEString(raw);
  const fetchedAt = Date.now();

  // 3. Cache in sessionStorage
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
    sessionStorage.setItem(CACHE_TS_KEY, String(fetchedAt));
  } catch (_) { /* ignore quota errors */ }

  return { ...parsed, fromCache: false, fromFallback, fetchedAt };
}

/**
 * @param {(tle: object) => void} onRefresh
 * @returns {() => void}  cancel function
 */
export function scheduleTLERefresh(onRefresh) {
  let timerId;

  const refresh = async () => {
    try {
      sessionStorage.removeItem(CACHE_TS_KEY);
      const tle = await fetchTLE();
      onRefresh(tle);
    } catch (err) {
      console.warn('[TLE] Refresh failed:', err);
    } finally {
      timerId = setTimeout(refresh, TLE_CACHE_MS);
    }
  };

  timerId = setTimeout(refresh, TLE_CACHE_MS);
  return () => clearTimeout(timerId);
}
