// ============================================================================
//  Resolver vixsrc (lato renderer, basato su fetch)
//  Ottiene l'URL .m3u8 di un contenuto da vixsrc, con:
//   - pattern multipli (token/expires/master) -> resiliente ai cambi di layout
//   - validazione reale (il master scaricato deve iniziare con #EXTM3U)
//   - retry+backoff su 503/429 (vixsrc rate-limita sotto raffica)
//   - limiter di concorrenza (non innescare il 503 a monte)
//  vixsrc espone Access-Control-Allow-Origin: * e non richiede Referer,
//  quindi il fetch dal renderer Electron funziona senza proxy.
//  NB: questo è il "tier 1". Se fallisce, l'app ripiega sull'iframe embedded.
// ============================================================================

const ROOT = 'https://vixsrc.to';

const PATTERNS = {
  token: [
    /['"]?token['"]?\s*[:=]\s*['"]([0-9A-Za-z_-]{16,})['"]/i,
    /[?&]token=([0-9A-Za-z_-]{16,})/i,
  ],
  expires: [
    /['"]?expires['"]?\s*[:=]\s*['"]?(\d{10,})['"]?/i,
    /[?&]expires=(\d{10,})/i,
  ],
  master: [
    /masterPlaylist\s*=\s*\{[\s\S]*?url:\s*'([^']+)'/i,
    /['"](https?:\/\/[^'"\s]+\/playlist\/\d+[^'"\s]*)['"]/i,
    /(https?:\/\/[^'"\s]+\/playlist\/\d+[^'"\s]*)/i,
    /(https?:\/\/[^'"\s]+\.m3u8[^'"\s]*)/i,
  ],
};

const RETRIABLE = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── limiter: max richieste in volo verso vixsrc ─────────────────────────────
class Limiter {
  constructor(max = 4) { this.max = max; this.active = 0; this.q = []; }
  acquire() { return new Promise((res) => { this.q.push(res); this._drain(); }); }
  _drain() {
    if (this.active >= this.max || this.q.length === 0) return;
    this.active++;
    const res = this.q.shift();
    res(() => { this.active--; this._drain(); });
    this._drain();
  }
}
const limiter = new Limiter(4);

async function httpGet(url, { timeout = 15000, retries = 4 } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    const release = await limiter.acquire();
    let r;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeout);
      r = await fetch(url, { signal: ctrl.signal, credentials: 'omit' });
      clearTimeout(t);
    } catch (e) {
      last = e;
    } finally {
      release();
    }
    if (r && !RETRIABLE.has(r.status)) return r;
    if (r) last = new Error('HTTP ' + r.status);
    if (i < retries) await sleep(Math.min(4000, 300 * 2 ** i) + Math.random() * 200);
  }
  throw last || new Error('richiesta fallita');
}

function firstMatch(patterns, text) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

// genera le varianti d'URL (con e senza b=1); la validazione sceglie quella
// con le tracce audio separate
function buildCandidates(masterBase, token, expires) {
  const out = new Set();
  const add = (base) => {
    if (!base) return;
    let u = base;
    if (!/[?&]token=/.test(u) && token) u += (u.includes('?') ? '&' : '?') + 'token=' + token;
    if (!/[?&]expires=/.test(u) && expires) u += (u.includes('?') ? '&' : '?') + 'expires=' + expires;
    if (!/[?&]h=1/.test(u)) u += '&h=1';
    out.add(u);
  };
  add(masterBase);
  add(masterBase.replace(/([?&])b=1(&|$)/, (m, p1, p2) => (p2 === '&' ? p1 : '')));
  return [...out];
}

async function validateMaster(url) {
  try {
    const r = await httpGet(url);
    if (!r || r.status !== 200) return { ok: false };
    const body = await r.text();
    const ok = body.trimStart().startsWith('#EXTM3U');
    return { ok, hasAudio: /TYPE=AUDIO/i.test(body) };
  } catch {
    return { ok: false };
  }
}

// Tier 1+2: fetch puro dal renderer (API + pagina embed, pattern multipli).
async function resolveViaHttp({ type, id, season, episode }) {
  // 1) API -> { src: "/embed/..." }
  const apiUrl = type === 'movie'
    ? `${ROOT}/api/movie/${id}`
    : `${ROOT}/api/tv/${id}/${season}/${episode}`;

  let embedUrl = null;
  // L'API risponde 404 NETTO quando il contenuto non esiste affatto su vixsrc
  // (verificato: per un id inesistente torna sempre 404, mai 200 senza 'src').
  // È un segnale diverso da "il sito ha cambiato layout": qui non c'è nulla da
  // trovare in nessun modo, quindi niente tier 3 dopo — vedi resolveStream.
  let apiNotFound = false;
  try {
    const apiRes = await httpGet(apiUrl);
    if (apiRes) {
      if (apiRes.status === 404) apiNotFound = true;
      if (apiRes.status === 200) {
        const api = await apiRes.json();
        if (api && api.src) embedUrl = ROOT + api.src;
      }
    }
  } catch { /* si tenta la pagina player sotto */ }

  // fallback: pagina player diretta se l'API non dà 'src'
  if (!embedUrl) {
    embedUrl = type === 'movie'
      ? `${ROOT}/movie/${id}`
      : `${ROOT}/tv/${id}/${season}/${episode}`;
  }

  // 2) pagina embed -> estrai token/expires/master con pattern multipli
  const html = await (await httpGet(embedUrl)).text();
  const token = firstMatch(PATTERNS.token, html);
  const expires = firstMatch(PATTERNS.expires, html);
  const master = firstMatch(PATTERNS.master, html);
  if (!master) {
    const err = new Error('Master playlist non trovato (layout cambiato?)');
    err.notFound = apiNotFound;
    throw err;
  }

  // 3) valida i candidati, preferendo quello con tracce audio separate
  let best = null;
  for (const candidate of buildCandidates(master, token, expires)) {
    const v = await validateMaster(candidate);
    if (v.ok && v.hasAudio) return { url: candidate };
    if (v.ok && !best) best = candidate;
  }
  if (best) return { url: best };

  const err = new Error('Nessun master HLS valido');
  err.notFound = apiNotFound;
  throw err;
}

/**
 * Risolve lo stream HLS di un contenuto vixsrc.
 * Tier 1+2: fetch diretto (API + pagina embed). Se fallisce E l'API non ha
 * risposto un 404 netto (cioè: il contenuto ESISTE ma vixsrc ha cambiato
 * markup, non è semplicemente assente) e siamo in Electron, tier 3: una
 * finestra nascosta carica la pagina del player e intercetta la richiesta
 * della playlist via rete reale — indipendente da qualunque pattern HTML/JS.
 * Se l'API ha già detto 404, saltiamo il tier 3: aspettare un browser-sniff
 * per un contenuto confermato assente è solo tempo perso (nessuna richiesta
 * di playlist arriverà mai, perché non c'è nulla da riprodurre) — risaliamo
 * subito così l'app passa veloce all'iframe come prima.
 * @returns {Promise<{url:string}>}  l'URL del master playlist (.m3u8)
 * @throws  se nessuna strategia produce un master valido
 */
export async function resolveStream({ type = 'movie', id, season = 1, episode = 1 } = {}) {
  if (!id) throw new Error('id mancante');

  try {
    return await resolveViaHttp({ type, id, season, episode });
  } catch (httpError) {
    if (httpError.notFound) throw httpError;
    if (!window.electronAPI?.browserSniff) throw httpError;
    try {
      const { url } = await window.electronAPI.browserSniff({ type, id, season, episode });
      if (url) {
        const v = await validateMaster(url);
        if (v.ok) return { url };
      }
    } catch { /* ricade sull'errore originale del tier HTTP */ }
    throw httpError;
  }
}
