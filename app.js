/* ═══════════════════════════════════════════════════════════
   SWERVE — Music Discovery App
   Powered by Tidal via api.monochrome.tf
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ─── CONFIG ───────────────────────────────────────────────────────
const API_BASE = 'https://api.monochrome.tf';
const TIDAL_IMG = 'https://resources.tidal.com/images';
const DISCOGS_BASE = 'https://api.discogs.com';
const DISCOGS_TOKEN = 'fvYYQHvhAEHVshXGPHYtbAWSlTUNQpnNJcBBbYCB';
const QUEUE_REFILL_AT = 20;
const QUEUE_TARGET = 60;
const API_TIMEOUT = 9000;
const RARE_POP_MAX = 40;  // filter out mainstream hits (pop > this)
const DISCOGS_HAVE_MAX = 500; // Discogs community.have ceiling — above this = too mainstream
const LASTFM_KEY = 'acd1fbf80c19d2febdf1bf378293eedf';
const LASTFM_SECRET = 'acd1fbf80c19d2febdf1bf378293eedf';
const SPOTIFY_CLIENT_ID = '5d04043e27d04cee91b233ab4e7791fc';
const SPOTIFY_SECRET = '14dce712909a4311986a2c86dfae9848';
const SPOTIFY_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH = 'https://accounts.spotify.com/api/token';
const LASTFM_BASE = 'https://ws.audioscrobbler.com';
const LISTEN_LONG_SEC = 30;  // seconds → implicit like signal
const LISTEN_SKIP_SEC = 10;  // seconds → implicit dislike signal
const MB_BASE = 'https://musicbrainz.org/ws/2';
const MB_UA = 'Swerve/1.0 (https://github.com/fides402/swerve)';
const LB_BASE = 'https://api.listenbrainz.org/1';
const GEMINI_API_KEY = 'AIzaSyDPJwhIY4J0Q0UEK1U6haPg_Xkf6OHpJV8';
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ─── COUNTRY LIST (for picker) ───────────────────────────────────────────────
const COUNTRIES = [
  { name: 'Algeria', flag: '🇩🇿', val: 'Algeria' },
  { name: 'Argentina', flag: '🇦🇷', val: 'Argentina' },
  { name: 'Australia', flag: '🇦🇺', val: 'Australia' },
  { name: 'Austria', flag: '🇦🇹', val: 'Austria' },
  { name: 'Belgium', flag: '🇧🇪', val: 'Belgium' },
  { name: 'Brazil', flag: '🇧🇷', val: 'Brazil' },
  { name: 'Bulgaria', flag: '🇧🇬', val: 'Bulgaria' },
  { name: 'Canada', flag: '🇨🇦', val: 'Canada' },
  { name: 'Chile', flag: '🇨🇱', val: 'Chile' },
  { name: 'Colombia', flag: '🇨🇴', val: 'Colombia' },
  { name: 'Cuba', flag: '🇨🇺', val: 'Cuba' },
  { name: 'Czechoslovakia', flag: '🇨🇿', val: 'Czechoslovakia' },
  { name: 'Denmark', flag: '🇩🇰', val: 'Denmark' },
  { name: 'Egypt', flag: '🇪🇬', val: 'Egypt' },
  { name: 'Ethiopia', flag: '🇪🇹', val: 'Ethiopia' },
  { name: 'Finland', flag: '🇫🇮', val: 'Finland' },
  { name: 'France', flag: '🇫🇷', val: 'France' },
  { name: 'Germany', flag: '🇩🇪', val: 'Germany' },
  { name: 'Ghana', flag: '🇬🇭', val: 'Ghana' },
  { name: 'Greece', flag: '🇬🇷', val: 'Greece' },
  { name: 'Hungary', flag: '🇭🇺', val: 'Hungary' },
  { name: 'India', flag: '🇮🇳', val: 'India' },
  { name: 'Iran', flag: '🇮🇷', val: 'Iran' },
  { name: 'Israel', flag: '🇮🇱', val: 'Israel' },
  { name: 'Italy', flag: '🇮🇹', val: 'Italy' },
  { name: 'Jamaica', flag: '🇯🇲', val: 'Jamaica' },
  { name: 'Japan', flag: '🇯🇵', val: 'Japan' },
  { name: 'Kenya', flag: '🇰🇪', val: 'Kenya' },
  { name: 'Lebanon', flag: '🇱🇧', val: 'Lebanon' },
  { name: 'Mexico', flag: '🇲🇽', val: 'Mexico' },
  { name: 'Morocco', flag: '🇲🇦', val: 'Morocco' },
  { name: 'Netherlands', flag: '🇳🇱', val: 'Netherlands' },
  { name: 'Nigeria', flag: '🇳🇬', val: 'Nigeria' },
  { name: 'Norway', flag: '🇳🇴', val: 'Norway' },
  { name: 'Peru', flag: '🇵🇪', val: 'Peru' },
  { name: 'Poland', flag: '🇵🇱', val: 'Poland' },
  { name: 'Portugal', flag: '🇵🇹', val: 'Portugal' },
  { name: 'Romania', flag: '🇷🇴', val: 'Romania' },
  { name: 'Senegal', flag: '🇸🇳', val: 'Senegal' },
  { name: 'South Africa', flag: '🇿🇦', val: 'South Africa' },
  { name: 'South Korea', flag: '🇰🇷', val: 'South Korea' },
  { name: 'Spain', flag: '🇪🇸', val: 'Spain' },
  { name: 'Sweden', flag: '🇸🇪', val: 'Sweden' },
  { name: 'Switzerland', flag: '🇨🇭', val: 'Switzerland' },
  { name: 'Turkey', flag: '🇹🇷', val: 'Turkey' },
  { name: 'UK', flag: '🇬🇧', val: 'UK' },
  { name: 'US', flag: '🇺🇸', val: 'US' },
  { name: 'Venezuela', flag: '🇻🇪', val: 'Venezuela' },
  { name: 'Yugoslavia', flag: '🇷🇸', val: 'Yugoslavia' },
];

// ─── CATALOG (from CSV) ───────────────────────────────────────────
const CATALOG = JSON.parse(document.getElementById('catalog-data').textContent);

// ─── PRESET SESSIONS ──────────────────────────────────────────────
const PRESETS = {
  'general': { id: 'general', name: 'Generale', emoji: '🎵', seeds: null },
  'ost-70': { id: 'ost-70', name: "OST '70", emoji: '🎬', seeds: true },
  'soul-70': { id: 'soul-70', name: "Soul '70", emoji: '🎶', seeds: true },
  'jazz-70': { id: 'jazz-70', name: "Jazz '70", emoji: '🎷', seeds: true },
};

// ─── DISCOGS SEARCH CONFIGS PER PRESET ────────────────────────────
// Each entry has a group `g` — one config per group is picked per refill,
// guaranteeing geographic and stylistic diversity every session.
const DISCOGS_CONFIGS = {
  'ost-70': [
    // g:it — Italian cinema (Giallo, Spaghetti, general)
    { g: 'it', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Italy', year: '1965-1982' },
    { g: 'it', genre: 'Stage & Screen', style: 'Score', country: 'Italy', year: '1965-1982' },
    { g: 'it', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Italy', year: '1968-1979' },
    // g:fr — French (Nouvelle Vague, polar, polar-adjacent)
    { g: 'fr', genre: 'Stage & Screen', style: 'Soundtrack', country: 'France', year: '1963-1981' },
    { g: 'fr', genre: 'Stage & Screen', style: 'Score', country: 'France', year: '1963-1981' },
    // g:de — German (Krimi, library, Neue Deutsche Welle)
    { g: 'de', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Germany', year: '1965-1980' },
    { g: 'de', genre: 'Stage & Screen', style: 'Score', country: 'Germany', year: '1965-1980' },
    // g:jp — Japanese (highly specific, very rare on Discogs)
    { g: 'jp', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Japan', year: '1965-1982' },
    { g: 'jp', genre: 'Stage & Screen', style: 'Score', country: 'Japan', year: '1965-1982' },
    // g:es — Spanish & Latin American
    { g: 'es', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Spain', year: '1963-1981' },
    { g: 'es', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Brazil', year: '1963-1981' },
    // g:eeu — Eastern Europe (hidden gems: Yugoslavia, Poland, Hungary, Czechoslovakia)
    { g: 'eeu', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Yugoslavia', year: '1963-1981' },
    { g: 'eeu', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Poland', year: '1963-1981' },
    { g: 'eeu', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Hungary', year: '1963-1981' },
    { g: 'eeu', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Czechoslovakia', year: '1963-1981' },
    // g:uk — British & international
    { g: 'uk', genre: 'Stage & Screen', style: 'Soundtrack', country: 'UK', year: '1963-1981' },
    { g: 'uk', genre: 'Stage & Screen', style: 'Score', country: 'UK', year: '1963-1981' },
    // g:world — Scandinavia, Turkey, Greece, Argentina
    { g: 'world', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Sweden', year: '1963-1981' },
    { g: 'world', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Turkey', year: '1963-1981' },
    { g: 'world', genre: 'Stage & Screen', style: 'Soundtrack', country: 'Argentina', year: '1963-1981' },
    // g:lib — Library music & general Score (no country filter)
    { g: 'lib', genre: 'Stage & Screen', style: 'Score', year: '1963-1982' },
    { g: 'lib', genre: 'Stage & Screen', style: 'Soundtrack', year: '1968-1978' },
  ],

  'soul-70': [
    // g:deep — Deep Southern Soul, raw gospel-influenced
    { g: 'deep', genre: 'Funk / Soul', style: 'Southern Soul', year: '1962-1978' },
    { g: 'deep', genre: 'Funk / Soul', style: 'Soul', year: '1962-1975' },
    // g:funk — Funk, Deep Funk, hard groove
    { g: 'funk', genre: 'Funk / Soul', style: 'Funk', year: '1965-1980' },
    { g: 'funk', genre: 'Funk / Soul', style: 'Deep Funk', year: '1965-1980' },
    // g:rnb — R&B and classic crossover
    { g: 'rnb', genre: 'Funk / Soul', style: 'Rhythm & Blues', year: '1958-1976' },
    { g: 'rnb', genre: 'Funk / Soul', style: 'Soul', year: '1963-1979' },
    // g:philly — Philly Soul, sweet soul, proto-disco
    { g: 'philly', genre: 'Funk / Soul', style: 'Soul', country: 'US', year: '1968-1979' },
    { g: 'philly', genre: 'Funk / Soul', style: 'Disco', year: '1973-1979' },
    // g:uk — UK Soul, British rare groove
    { g: 'uk', genre: 'Funk / Soul', style: 'Soul', country: 'UK', year: '1965-1980' },
    { g: 'uk', genre: 'Funk / Soul', country: 'UK', year: '1965-1980' },
    // g:world — Non Anglo-Saxon soul (Nigeria, Jamaica, Italy, Brazil)
    { g: 'world', genre: 'Funk / Soul', country: 'Nigeria', year: '1965-1981' },
    { g: 'world', genre: 'Funk / Soul', country: 'Brazil', year: '1965-1981' },
    { g: 'world', genre: 'Funk / Soul', country: 'Jamaica', year: '1965-1981' },
    { g: 'world', genre: 'Funk / Soul', country: 'Italy', year: '1965-1981' },
    // g:jazz-soul — Soul-adjacent jazz crossover
    { g: 'jazz-soul', genre: 'Funk / Soul', style: 'Soul-Jazz', year: '1962-1980' },
    { g: 'jazz-soul', genre: 'Jazz', style: 'Soul-Jazz', year: '1962-1980' },
  ],

  'jazz-70': [
    // g:avant — Avant-garde, Free Jazz, outside playing
    { g: 'avant', genre: 'Jazz', style: 'Avant-garde Jazz', year: '1960-1980' },
    { g: 'avant', genre: 'Jazz', style: 'Free Jazz', year: '1960-1980' },
    // g:modal — Modal, Post Bop (Miles-era influence)
    { g: 'modal', genre: 'Jazz', style: 'Post Bop', year: '1960-1980' },
    { g: 'modal', genre: 'Jazz', style: 'Modal', year: '1960-1980' },
    // g:latin — Latin Jazz, Afro-Cuban, Bossa-jazz
    { g: 'latin', genre: 'Jazz', style: 'Latin Jazz', year: '1960-1980' },
    { g: 'latin', genre: 'Jazz', country: 'Brazil', year: '1960-1980' },
    { g: 'latin', genre: 'Jazz', country: 'Cuba', year: '1960-1980' },
    // g:jp — Japanese jazz (incredibly rare, underrated)
    { g: 'jp', genre: 'Jazz', country: 'Japan', year: '1960-1980' },
    { g: 'jp', genre: 'Jazz', country: 'Japan', year: '1968-1979' },
    // g:eu-south — Italian & Spanish jazz
    { g: 'eu-south', genre: 'Jazz', country: 'Italy', year: '1960-1980' },
    { g: 'eu-south', genre: 'Jazz', country: 'Spain', year: '1960-1980' },
    // g:eu-west — French & British jazz
    { g: 'eu-west', genre: 'Jazz', country: 'France', year: '1960-1980' },
    { g: 'eu-west', genre: 'Jazz', country: 'UK', year: '1960-1980' },
    // g:eu-north — German, Scandinavian, Dutch (ECM territory)
    { g: 'eu-north', genre: 'Jazz', country: 'Germany', year: '1960-1980' },
    { g: 'eu-north', genre: 'Jazz', country: 'Sweden', year: '1960-1980' },
    { g: 'eu-north', genre: 'Jazz', country: 'Norway', year: '1960-1980' },
    { g: 'eu-north', genre: 'Jazz', country: 'Netherlands', year: '1960-1980' },
    // g:fusion — Jazz-Funk, Jazz-Rock, crossover groove
    { g: 'fusion', genre: 'Jazz', style: 'Jazz-Funk', year: '1965-1980' },
    { g: 'fusion', genre: 'Jazz', style: 'Jazz-Rock', year: '1965-1980' },
    // g:eeu — Eastern European jazz (Poland, Yugoslavia, Hungary — extremely rare)
    { g: 'eeu', genre: 'Jazz', country: 'Poland', year: '1960-1980' },
    { g: 'eeu', genre: 'Jazz', country: 'Yugoslavia', year: '1960-1980' },
    { g: 'eeu', genre: 'Jazz', country: 'Hungary', year: '1960-1980' },
    // g:world — Africa, Middle East, Asia outside Japan
    { g: 'world', genre: 'Jazz', country: 'South Africa', year: '1960-1980' },
    { g: 'world', genre: 'Jazz', country: 'Turkey', year: '1960-1980' },
    { g: 'world', genre: 'Jazz', country: 'India', year: '1960-1980' },
  ],
};

// ─── STATE ────────────────────────────────────────────────────────
const S = {
  // Discovery
  queue: [],           // upcoming Tinder cards
  seenIds: new Set(),  // Tidal IDs + spotifyIds seen in discover
  seedInfo: '',        // label shown above cards
  isFetching: false,   // prevent concurrent fetches
  activePreset: 'general',   // which preset tab is active
  sessionSeedTrack: null, // track used to start a specific session
  currentCardLiked: false,   // tracks two-stage like state for current card

  // User data (persisted)
  myLiked: [],         // [{...track, likedAt}]
  mySkipped: new Set(),// Set of spotifyId/tidalId
  playlists: [],       // [{id, name, trackIds, createdAt}]

  // Taste profile (persisted)
  taste: {
    artists: {},   // name → {liked:0, skipped:0}
    decades: {},   // decade → {liked:0, skipped:0}
    seeds: [],     // [{id:tidalId, weight, title}]
    total: 0
  },

  // Tidal ID cache (persisted)
  tidalCache: {},

  // Preset seed cache: resolved Tidal IDs for preset seed queries (persisted)
  presetSeedCache: {},   // { presetId: { 'title|artist': tidalId } }
  presetSeedCursor: {},  // { presetId: number } — rotation cursor, not persisted

  // Discogs config weights: feedback loop from likes/skips (persisted)
  // { presetId: { cfgKey: weight } } — higher = more likely to be picked
  discogsWeights: {},
  lastSkipped: null,   // session-only: track to recover with undo

  // Rolling artist cooldown (persisted)
  recentArtists: [],

  // ── ENRICHMENT & FEATURE MODEL (persisted) ──────────────────────
  // Per-track enrichment: 'artist|title' → { tags:[{n,w}], ts }
  enrichCache: {},
  // Sparse user profile vector built from liked/skipped feature vectors
  profileVector: {},   // { 'sty:soundtrack': 1.4, 'tag:rare groove': 0.9, … }
  profileTotal: 0,    // sum of |weights| added (for normalization)
  // Session-only: timestamp when current player track started (implicit signals)
  listenStart: 0,
  // Stream quality preference (persisted): 'LOW' | 'HIGH' | 'LOSSLESS'
  streamQuality: 'HIGH',
  forcedCountry: null,  // null = use cfg.country; string = override
  // ── MUSICBRAINZ / LISTENBRAINZ / LASTFM ─────────────────────────
  mbCache: {},              // 'artist|title' → {mbid, firstRelease, country, label, isOriginal, ts}
  lbUser: null,             // ListenBrainz username (persisted)
  lbToken: null,            // ListenBrainz user token (persisted)
  lbRecQueries: [],         // [{t, a, mbid}] — pre-fetched LB CF recs, used as queue supplement
  lbRecsTs: 0,              // last LB recs fetch timestamp
  lbTracks: [],             // resolved Tidal tracks from LB recs (ready to use)
  lfmSecret: null,          // Last.fm API secret (persisted)
  lfmSessionKey: null,      // Last.fm session key (persisted, never store password)
  lfmUsername: null,        // Last.fm username (persisted)
  dislikeVec: {},           // cumulative feature vector of skipped tracks (Plan E)
  dislikeTotal: 0,          // normalization counter for dislikeVec
  artistCooldown: {},       // artistKey → timestamp of last queue appearance (Plan B)
  frontierTracks: [],       // recently surfaced tracks used as seeds for constellation chaining
  spotifyToken: null,       // Spotify client-credentials access token
  spotifyTokenExp: 0,       // token expiry timestamp (ms)
  spotifyCache: {},         // track key -> {energy,valence,tempo,key,mode,spotifyId,ts}
  audioProfile: null,       // computed stats from liked tracks audio features
  genreSeeds: [],           // valid Spotify/EveryNoise genre seed names from available-genre-seeds
  frontierGenres: [],       // genres discovered from recs' artists → seeds for next batch (genre chaining)

  // Player
  audio: new Audio(),
  playerTrack: null,
  playerQueue: [],
  playerIdx: 0,
  isPlaying: false,
  shuffle: false,
  repeat: 'none',      // 'none' | 'all' | 'one'
  volume: 0.8,
  isPreview: false,

  // UI
  view: 'discover',
  fullPlayerOpen: false,
  lyricsOpen: false,
  queueOpen: false,
  libraryFilter: 'all',
  openPlaylistId: null,
  currentCardTrack: null, // track shown on top card
};

// ─── STORAGE ──────────────────────────────────────────────────────
function _pruneMbCache(cache) {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(cache || {})
      .filter(([, v]) => now - (v.ts || 0) < 30 * 86400_000) // 30-day TTL
      .slice(-1500)
  );
}

function saveState() {
  try {
    // Prune enrichCache: keep only entries < 7 days old, max 2000
    const now = Date.now();
    const enrichPruned = Object.fromEntries(
      Object.entries(S.enrichCache)
        .filter(([, v]) => now - (v.ts || 0) < 7 * 86400_000)
        .slice(-2000)
    );
    // Prune artistCooldown: remove entries older than 2 hours
    for (const k in S.artistCooldown) {
      if (Date.now() - S.artistCooldown[k] > 2 * 3600_000) delete S.artistCooldown[k];
    }
    localStorage.setItem('swerve_v2', JSON.stringify({
      myLiked: S.myLiked,
      mySkipped: [...S.mySkipped],
      playlists: S.playlists,
      taste: S.taste,
      tidalCache: S.tidalCache,
      seenIds: [...S.seenIds].slice(-500),
      volume: S.volume,
      shuffle: S.shuffle,
      repeat: S.repeat,
      recentArtists: S.recentArtists,
      discogsWeights: S.discogsWeights,
      presetSeedCache: S.presetSeedCache,
      enrichCache: enrichPruned,
      profileVector: S.profileVector,
      profileTotal: S.profileTotal,
      streamQuality: S.streamQuality,
      forcedCountry: S.forcedCountry,
      mbCache: _pruneMbCache(S.mbCache),
      lbUser: S.lbUser,
      lbToken: S.lbToken,
      lbRecsTs: S.lbRecsTs,
      lbRecQueries: S.lbRecQueries,
      lfmSecret: S.lfmSecret,
      lfmSessionKey: S.lfmSessionKey,
      lfmUsername: S.lfmUsername,
      dislikeVec: S.dislikeVec,
      dislikeTotal: S.dislikeTotal,
      artistCooldown: S.artistCooldown,
      frontierTracks: S.frontierTracks.slice(-10),
      genreSeeds: S.genreSeeds,
      frontierGenres: S.frontierGenres.slice(-20),
      spotifyCache: Object.fromEntries(
        Object.entries(S.spotifyCache).filter(([, v]) => Date.now() - (v.ts || 0) < 30 * 86400_000).slice(-800)
      ),
      audioProfile: S.audioProfile,
    }));
  } catch (e) { console.warn('save failed', e); }
}

function loadState() {
  try {
    const d = JSON.parse(localStorage.getItem('swerve_v2') || '{}');
    S.myLiked = d.myLiked || [];
    S.mySkipped = new Set(d.mySkipped || []);
    S.playlists = d.playlists || [];
    S.taste = d.taste || S.taste;
    S.tidalCache = d.tidalCache || {};
    S.presetSeedCache = d.presetSeedCache || {};
    S.discogsWeights = d.discogsWeights || {};
    S.recentArtists = d.recentArtists || [];
    S.enrichCache = d.enrichCache || {};
    S.profileVector = d.profileVector || {};
    S.profileTotal = d.profileTotal || 0;
    S.streamQuality = d.streamQuality || 'HIGH';
    S.forcedCountry = d.forcedCountry || null;
    S.mbCache = d.mbCache || {};
    S.lbUser = d.lbUser || null;
    S.lbToken = d.lbToken || null;
    S.lbRecsTs = d.lbRecsTs || 0;
    S.lbRecQueries = d.lbRecQueries || [];
    S.lfmSecret = d.lfmSecret || null;
    S.lfmSessionKey = d.lfmSessionKey || null;
    S.lfmUsername = d.lfmUsername || null;
    S.dislikeVec = d.dislikeVec || {};
    S.dislikeTotal = d.dislikeTotal || 0;
    S.artistCooldown = d.artistCooldown || {};
    S.frontierTracks = d.frontierTracks || [];
    S.spotifyCache = d.spotifyCache || {};
    S.audioProfile = d.audioProfile || null;
    S.genreSeeds = d.genreSeeds || [];
    S.frontierGenres = d.frontierGenres || [];
    S.seenIds = new Set(d.seenIds || []);
    S.volume = d.volume != null ? d.volume : 0.8;
    S.shuffle = d.shuffle || false;
    S.repeat = d.repeat || 'none';
    S.audio.volume = S.volume;
  } catch (e) { console.warn('load failed', e); }
}

// ─── UTILS ────────────────────────────────────────────────────────
function tidalCover(uuid, size = 640) {
  if (!uuid) return null;
  return `${TIDAL_IMG}/${uuid.replace(/-/g, '/')}/${size}x${size}.jpg`;
}

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function randPick(arr, n = 1) {
  const copy = [...arr];
  const result = [];
  for (let i = 0; i < n && copy.length; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return n === 1 ? result[0] : result;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── PLAN A: Weighted seed sample ─────────────────────────────────
// Samples n seeds from full liked set. Recent tracks have higher weight
// (linear ramp 1x → 10x) so we explore the full taste graph, not just
// the last 5 likes.
// Weighted reservoir sample from liked tracks (recency-biased: oldest=1x, newest=10x).
// Hard cap of 2 tracks per artist prevents a single artist dominating the seed batch.
function _weightedSeedSample(n) {
  const pool = S.myLiked.length >= 3 ? S.myLiked : [...S.myLiked, ...CATALOG.slice(0, 50)];
  if (!pool.length) return [];
  const len = pool.length;
  const weights = pool.map((_, i) => 1 + (i / len) * 9); // 1x … 10x
  const sumW = weights.reduce((s, w) => s + w, 0);
  const result = [], used = new Set(), artistCount = {};
  let attempts = 0;
  while (result.length < n && attempts < n * 20) {
    attempts++;
    let r = Math.random() * sumW, idx = 0;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { idx = i; break; } }
    if (used.has(idx)) continue;
    const ak = (pool[idx].a || '').toLowerCase().trim();
    if ((artistCount[ak] || 0) >= 2) continue; // cap 2 tracks per artist
    used.add(idx);
    artistCount[ak] = (artistCount[ak] || 0) + 1;
    result.push(pool[idx]);
  }
  return result;
}

// ─── PLAN D: Hard genre filter ────────────────────────────────────
// Returns top N genre/style keys from the normalised profile vector.
// Returns top N genre/style keys from the profile, with a diversity cap of
// max 2 keys per "first-word segment" (e.g. "bossa" in "bossa nova", "samba")
// so a single regional genre family can't monopolise the top slots.
function _profileTopGenreKeys(n = 14) {
  const profile = UserProfile.get();
  const sorted = Object.entries(profile)
    .filter(([k]) => k.startsWith('sty:') || k.startsWith('gen:'))
    .sort((a, b) => b[1] - a[1]);
  const segCount = {};
  const result = [];
  for (const [k] of sorted) {
    if (result.length >= n) break;
    const seg = k.replace(/^(?:sty:|gen:)/, '').split(/[-\s]/)[0];
    segCount[seg] = (segCount[seg] || 0) + 1;
    if (segCount[seg] <= 2) result.push(k);
  }
  return result;
}

// A candidate track must share ≥1 genre/style key with the top profile keys.
// Guard is inactive when: profile is immature (<5 actions), no genre signal exists,
// or the track hasn't been enriched yet. Pass `presetMode=true` to bypass — Discogs
// presets apply their own genre logic and must not be filtered by user taste.
function _passesGenreFilter(track, { presetMode = false } = {}) {
  if (presetMode) return true;
  if (S.profileTotal < 5) return true;
  const topKeys = _profileTopGenreKeys(14);
  if (!topKeys.length) return true;
  const vec = FeatureVec.build(track);
  const hasGenreData = Object.keys(vec).some(k => k.startsWith('sty:') || k.startsWith('gen:'));
  if (!hasGenreData) return true; // not yet enriched → let through
  return topKeys.some(k => vec[k] > 0);
}
// ─── MD5 (needed for Last.fm API signature) ────────────────────────────────────────────
function _md5(input) {
  const ADD = (x, y) => { const l = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF); };
  const ROT = (x, n) => (x << n) | (x >>> (32 - n));
  const FF = (a, b, c, d, x, s, t) => ADD(ROT(ADD(ADD(a, (b & c) | (~b & d)), ADD(x, t)), s), b);
  const GG = (a, b, c, d, x, s, t) => ADD(ROT(ADD(ADD(a, (b & d) | (c & ~d)), ADD(x, t)), s), b);
  const HH = (a, b, c, d, x, s, t) => ADD(ROT(ADD(ADD(a, b ^ c ^ d), ADD(x, t)), s), b);
  const II = (a, b, c, d, x, s, t) => ADD(ROT(ADD(ADD(a, c ^ (b | ~d)), ADD(x, t)), s), b);
  const str = unescape(encodeURIComponent(input));
  const m = []; const K = (1 << 8) - 1;
  for (let i = 0; i < str.length * 8; i += 8) m[i >> 5] |= (str.charCodeAt(i / 8) & K) << (i % 32);
  m[str.length * 8 >> 5] |= 0x80 << ((str.length * 8) % 32);
  m[(((str.length * 8 + 64) >>> 9) << 4) + 14] = str.length * 8;
  let [a0, b0, c0, d0] = [1732584193, -271733879, -1732584194, 271733878];
  for (let i = 0; i < m.length; i += 16) {
    let [a, b, c, d] = [a0, b0, c0, d0];
    a = FF(a, b, c, d, m[i + 0], 7, -680876936); d = FF(d, a, b, c, m[i + 1], 12, -389564586); c = FF(c, d, a, b, m[i + 2], 17, 606105819); b = FF(b, c, d, a, m[i + 3], 22, -1044525330);
    a = FF(a, b, c, d, m[i + 4], 7, -176418897); d = FF(d, a, b, c, m[i + 5], 12, 1200080426); c = FF(c, d, a, b, m[i + 6], 17, -1473231341); b = FF(b, c, d, a, m[i + 7], 22, -45705983);
    a = FF(a, b, c, d, m[i + 8], 7, 1770035416); d = FF(d, a, b, c, m[i + 9], 12, -1958414417); c = FF(c, d, a, b, m[i + 10], 17, -42063); b = FF(b, c, d, a, m[i + 11], 22, -1990404162);
    a = FF(a, b, c, d, m[i + 12], 7, 1804603682); d = FF(d, a, b, c, m[i + 13], 12, -40341101); c = FF(c, d, a, b, m[i + 14], 17, -1502002290); b = FF(b, c, d, a, m[i + 15], 22, 1236535329);
    a = GG(a, b, c, d, m[i + 1], 5, -165796510); d = GG(d, a, b, c, m[i + 6], 9, -1069501632); c = GG(c, d, a, b, m[i + 11], 14, 643717713); b = GG(b, c, d, a, m[i + 0], 20, -373897302);
    a = GG(a, b, c, d, m[i + 5], 5, -701558691); d = GG(d, a, b, c, m[i + 10], 9, 38016083); c = GG(c, d, a, b, m[i + 15], 14, -660478335); b = GG(b, c, d, a, m[i + 4], 20, -405537848);
    a = GG(a, b, c, d, m[i + 9], 5, 568446438); d = GG(d, a, b, c, m[i + 14], 9, -1019803690); c = GG(c, d, a, b, m[i + 3], 14, -187363961); b = GG(b, c, d, a, m[i + 8], 20, 1163531501);
    a = GG(a, b, c, d, m[i + 13], 5, -1444681467); d = GG(d, a, b, c, m[i + 2], 9, -51403784); c = GG(c, d, a, b, m[i + 7], 14, 1735328473); b = GG(b, c, d, a, m[i + 12], 20, -1926607734);
    a = HH(a, b, c, d, m[i + 5], 4, -378558); d = HH(d, a, b, c, m[i + 8], 11, -2022574463); c = HH(c, d, a, b, m[i + 11], 16, 1839030562); b = HH(b, c, d, a, m[i + 14], 23, -35309556);
    a = HH(a, b, c, d, m[i + 1], 4, -1530992060); d = HH(d, a, b, c, m[i + 4], 11, 1272893353); c = HH(c, d, a, b, m[i + 7], 16, -155497632); b = HH(b, c, d, a, m[i + 10], 23, -1094730640);
    a = HH(a, b, c, d, m[i + 13], 4, 681279174); d = HH(d, a, b, c, m[i + 0], 11, -358537222); c = HH(c, d, a, b, m[i + 3], 16, -722521979); b = HH(b, c, d, a, m[i + 6], 23, 76029189);
    a = HH(a, b, c, d, m[i + 9], 4, -640364487); d = HH(d, a, b, c, m[i + 12], 11, -421815835); c = HH(c, d, a, b, m[i + 15], 16, 530742520); b = HH(b, c, d, a, m[i + 2], 23, -995338651);
    a = II(a, b, c, d, m[i + 0], 6, -198630844); d = II(d, a, b, c, m[i + 7], 10, 1126891415); c = II(c, d, a, b, m[i + 14], 15, -1416354905); b = II(b, c, d, a, m[i + 5], 21, -57434055);
    a = II(a, b, c, d, m[i + 12], 6, 1700485571); d = II(d, a, b, c, m[i + 3], 10, -1894986606); c = II(c, d, a, b, m[i + 10], 15, -1051523); b = II(b, c, d, a, m[i + 1], 21, -2054922799);
    a = II(a, b, c, d, m[i + 8], 6, 1873313359); d = II(d, a, b, c, m[i + 15], 10, -30611744); c = II(c, d, a, b, m[i + 6], 15, -1560198380); b = II(b, c, d, a, m[i + 13], 21, 1309151649);
    a = II(a, b, c, d, m[i + 4], 6, -145523070); d = II(d, a, b, c, m[i + 11], 10, -1120210379); c = II(c, d, a, b, m[i + 2], 15, 718787259); b = II(b, c, d, a, m[i + 9], 21, -343485551);
    [a0, b0, c0, d0] = [ADD(a0, a), ADD(b0, b), ADD(c0, c), ADD(d0, d)];
  }
  const H = '0123456789abcdef'; let s = '';
  for (const n of [a0, b0, c0, d0]) for (let j = 0; j < 4; j++) s += H[(n >> (j * 8 + 4)) & 0xF] + H[(n >> (j * 8)) & 0xF];
  return s;
}

function _lfmSig(params, secret) {
  return _md5(Object.keys(params).sort().map(k => k + params[k]).join('') + secret);
}

// ─── MUSICBRAINZ ENGINE ─────────────────────────────────────────────
const MBEngine = {
  async lookup(artist, title, isrc) {
    const key = ((artist || '').toLowerCase().trim()) + '|' + ((title || '').toLowerCase().trim());
    if (S.mbCache[key]) return S.mbCache[key];
    await sleep(1150);
    try {
      let url;
      if (isrc && isrc.length === 12) {
        url = MB_BASE + '/recording?query=isrc:' + encodeURIComponent(isrc) + '&fmt=json&limit=3';
      } else {
        url = MB_BASE + '/recording?query=recording:%22' + encodeURIComponent(title) + '%22%20AND%20artist:%22' + encodeURIComponent(artist) + '%22&fmt=json&limit=3';
      }
      const r = await fetch(url, { headers: { 'User-Agent': MB_UA, 'Accept': 'application/json' } });
      if (!r.ok) return null;
      const d = await r.json();
      const rec = (d.recordings || [])[0];
      if (!rec) { S.mbCache[key] = { mbid: null, ts: Date.now() }; return null; }
      const releases = (rec.releases || []).slice().sort((a, b) =>
        (a.date || '9999') > (b.date || '9999') ? 1 : -1);
      const orig = releases[0];
      const firstDate = rec['first-release-date'] || orig?.date || null;
      const result = {
        mbid: rec.id, firstRelease: firstDate,
        country: orig?.country || null,
        label: orig?.['label-info']?.[0]?.label?.name || null,
        isOriginal: !!(firstDate && orig?.date && firstDate.slice(0, 4) === orig.date.slice(0, 4)),
        ts: Date.now(),
      };
      S.mbCache[key] = result;
      return result;
    } catch { return null; }
  },
  async enrichBg() {
    const todo = S.myLiked
      .filter(t => !S.mbCache[((t.a || '').toLowerCase().trim()) + '|' + ((t.t || '').toLowerCase().trim())])
      .slice(0, 3);
    for (const t of todo) await this.lookup(t.a || '', t.t || '', t.isrc || null);
    if (todo.length) {
      saveState();
      const el = $('mb-status');
      if (el) el.textContent = Object.keys(S.mbCache).length + ' release con metadati MusicBrainz';
    }
    const remaining = S.myLiked.filter(
      t => !S.mbCache[((t.a || '').toLowerCase().trim()) + '|' + ((t.t || '').toLowerCase().trim())]
    );
    if (remaining.length) setTimeout(() => MBEngine.enrichBg(), 18000);
  }
};


// Validate that a Tidal search result actually corresponds to the expected track.
// Prevents "title collision" where a popular song with a common title steals
// the slot that should belong to an obscure Discogs release.
// Accept if ≥ 40% of the expected title's content words appear in the found title.
function _tidalMatchOk(expArtist, expTitle, found) {
  if (!found?.id) return false;
  const norm = s => (s || '').toLowerCase().replace(/[^ws]/g, ' ').trim();
  const tok = s => norm(s).split(/s+/).filter(w => w.length > 2);
  const expT = tok(expTitle);
  const foundT = new Set(tok(found.title || ''));
  if (!expT.length) return true; // single-word title, can't reject
  const hits = expT.filter(w => foundT.has(w)).length;
  if (hits / expT.length >= 0.40) return true;
  // Secondary check: artist match as fallback (catches "Title (Remaster)" variants)
  const expA = tok(expArtist);
  const foundA = new Set(tok(found.artist?.name || found.artists?.map(a => a.name).join(' ') || ''));
  const aHits = expA.filter(w => foundA.has(w)).length;
  return expA.length > 0 && aHits / expA.length >= 0.5;
}


function fetchWithTimeout(url, ms = API_TIMEOUT) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal, mode: 'cors' })
    .finally(() => clearTimeout(id));
}

function normalizeArtist(name) {
  // Handle "Artist A, Artist B" format — take first
  return (name || '').split(',')[0].trim();
}

function trackId(t) {
  return t.tidalId ? `t:${t.tidalId}` : `s:${t.sid}`;
}

function hasSeen(t) {
  if (t.tidalId && S.seenIds.has(`t:${t.tidalId}`)) return true;
  if (t.sid && S.seenIds.has(`s:${t.sid}`)) return true;
  if (t.isrc && S.seenIds.has(`i:${t.isrc}`)) return true;
  return false;
}

function markSeen(t) {
  if (t.tidalId) S.seenIds.add(`t:${t.tidalId}`);
  if (t.sid) S.seenIds.add(`s:${t.sid}`);
  if (t.isrc) S.seenIds.add(`i:${t.isrc}`);
}

function isLiked(t) {
  if (t.tidalId && S.myLiked.some(l => l.tidalId === t.tidalId)) return true;
  if (t.sid && S.myLiked.some(l => l.sid === t.sid)) return true;
  return false;
}

// ─── API CLIENT ────────────────────────────────────────────────────
const API = {

  async search(title, isrc) {
    try {
      const q = encodeURIComponent(title.slice(0, 60));
      const resp = await fetchWithTimeout(`${API_BASE}/search/?s=${q}`);
      if (!resp.ok) return null;
      const json = await resp.json();
      const items = json?.data?.items || [];
      if (!items.length) return null;
      // Prefer ISRC match
      if (isrc) {
        const exact = items.find(i => i.isrc === isrc);
        if (exact) return exact;
      }
      return items[0];
    } catch (e) { return null; }
  },

  async getRecommendations(tidalId) {
    try {
      const resp = await fetchWithTimeout(`${API_BASE}/recommendations/?id=${tidalId}`);
      if (!resp.ok) return [];
      const json = await resp.json();
      return json?.data?.items || [];
    } catch (e) { return []; }
  },

  async getStreamUrl(tidalId, quality = 'HIGH') {
    try {
      const resp = await fetchWithTimeout(`${API_BASE}/track/?id=${tidalId}&quality=${quality}`, 12000);
      if (!resp.ok) return null;
      const json = await resp.json();
      const manifest = json?.data?.manifest;
      if (!manifest) return null;

      // Decode base64 manifest
      const decoded = atob(manifest);

      // Try BTS JSON format (most common for non-HiRes)
      try {
        const bts = JSON.parse(decoded);
        if (bts.urls && bts.urls.length) return bts.urls[0];
      } catch (_) { }

      // Try DASH/MPD XML format
      if (decoded.includes('<MPD') || decoded.includes('<?xml')) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(decoded, 'text/xml');
        const baseUrl = xml.querySelector('BaseURL')?.textContent?.trim();
        if (baseUrl) return baseUrl;
        // Try SegmentTemplate
        const tmpl = xml.querySelector('SegmentTemplate');
        const init = tmpl?.getAttribute('initialization');
        if (init) return init;
      }
      return null;
    } catch (e) { return null; }
  },

  async getLyrics(tidalId) {
    try {
      const resp = await fetchWithTimeout(`${API_BASE}/lyrics/?id=${tidalId}`);
      if (!resp.ok) return null;
      const json = await resp.json();
      return json?.data || null;
    } catch (e) { return null; }
  },

  async getInfo(tidalId) {
    try {
      const resp = await fetchWithTimeout(`${API_BASE}/info/?id=${tidalId}`);
      if (!resp.ok) return null;
      const json = await resp.json();
      return json?.data || null;
    } catch (e) { return null; }
  }
};

// ─── MAP TIDAL TRACK → INTERNAL FORMAT ───────────────────────────
function fromTidal(t) {
  const cover = tidalCover(t.album?.cover);
  return {
    tidalId: t.id,
    sid: null,
    t: t.title || '?',
    a: t.artist?.name || t.artists?.map(a => a.name).join(', ') || '?',
    al: t.album?.title || '',
    art: cover,
    pre: null,
    d: (t.duration || 0) * 1000,
    isrc: t.isrc || '',
    y: (t.album?.releaseDate || t.streamStartDate || '').slice(0, 4),
    pop: t.popularity || 0,
    bpm: t.bpm || null,
    vibrant: t.album?.vibrantColor || null,
    source: 'tidal'
  };
}

// ─── DISCOGS ENGINE ────────────────────────────────────────────────
// Fetches genre-accurate tracks directly from Discogs → confirmed on Tidal.
function discogsFetch(url, ms = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, {
    signal: ctrl.signal,
    mode: 'cors',
    headers: { 'Authorization': `Discogs token=${DISCOGS_TOKEN}` }
  }).finally(() => clearTimeout(id));
}

// NEW ALGORITHM: Discogs → EveryNoise → Monochrome
// 1. Discogs: Select genre/style/year/country → get random rare release
// 2. EveryNoise: From that release, get 10 similar rare releases (both on Discogs AND Monochrome)  
// 3. Monochrome: Get song recommendations similar to those disks/artists, filtering for rare tracks (pop <= 40)

const NewDiscoveryEngine = {
  _releaseCache: {},
  _trackCache: {},

  async getTracks(presetId, count = 25) {
    const configs = DISCOGS_CONFIGS[presetId];
    if (!configs?.length) return [];

    // Step 1: Pick a random config and get a random release from Discogs
    const seedRelease = await this._getSeedRelease(configs);
    if (!seedRelease) return [];

    // Step 2: Get 10 similar rare releases using EveryNoise approach
    const similarReleases = await this._getSimilarReleases(seedRelease, 10);
    if (similarReleases.length === 0) return [];

    // Step 3: For each similar release, get tracks from Monochrome and filter for rare tracks
    const tracks = [];
    for (const release of similarReleases) {
      if (tracks.length >= count) break;
      
      const releaseTracks = await this._getMonochromeTracks(release);
      tracks.push(...releaseTracks);
      
      if (tracks.length >= count) break;
    }

    return tracks.slice(0, count);
  },

  async _getSeedRelease(configs) {
    // Pick 3 random configs for diversity
    const shuffled = configs.sort(() => Math.random() - 0.5).slice(0, 3);
    
    for (const cfg of shuffled) {
      const page = Math.ceil(Math.random() * 10);
      const qs = new URLSearchParams({
        type: 'release',
        per_page: '25',
        page: String(page),
        sort: 'want',
        sort_order: 'desc'
      });
      if (cfg.genre) qs.set('genre', cfg.genre);
      if (cfg.style) qs.set('style', cfg.style);
      if (cfg.country) qs.set('country', cfg.country);
      if (cfg.year) qs.set('year', cfg.year);

      try {
        const r = await discogsFetch(`${DISCOGS_BASE}/database/search?${qs}`);
        if (!r.ok) continue;
        const results = (await r.json()).results || [];
        
        // Filter for rare but findable: 5 <= have < 500
        const candidates = results
          .filter(rel => {
            const h = rel.community?.have || 0;
            return h >= 5 && h < DISCOGS_HAVE_MAX;
          })
          .sort(() => Math.random() - 0.5);
        
        if (candidates.length > 0) {
          return candidates[0];
        }
      } catch { continue; }
    }
    return null;
  },

  async _getSimilarReleases(seedRelease, count) {
    const similar = [];
    
    // Get all Discogs configs for searching similar releases
    const allConfigs = [
      ...(DISCOGS_CONFIGS['ost-70'] || []),
      ...(DISCOGS_CONFIGS['soul-70'] || []),
      ...(DISCOGS_CONFIGS['jazz-70'] || [])
    ];
    
    // Pick random configs to get diverse similar releases
    const shuffled = allConfigs.sort(() => Math.random() - 0.5).slice(0, 20);
    
    for (const cfg of shuffled) {
      if (similar.length >= count) break;
      
      const page = Math.ceil(Math.random() * 8);
      const qs = new URLSearchParams({
        type: 'release',
        per_page: '25',
        page: String(page)
      });
      if (cfg.genre) qs.set('genre', cfg.genre);
      if (cfg.style) qs.set('style', cfg.style);
      if (cfg.country) qs.set('country', cfg.country);
      if (cfg.year) qs.set('year', cfg.year);

      try {
        await sleep(200);
        const r = await discogsFetch(`${DISCOGS_BASE}/database/search?${qs}`);
        if (!r.ok) continue;
        const results = (await r.json()).results || [];
        
        const candidates = results
          .filter(rel => {
            const h = rel.community?.have || 0;
            // Rare: 5-300 have, skip if too common
            return h >= 5 && h < 300;
          })
          .sort(() => Math.random() - 0.5)
          .slice(0, 3);
        
        for (const rel of candidates) {
          const key = `${rel.id}`;
          if (this._releaseCache[key]) continue;
          
          // Verify this release exists on Monochrome
          await sleep(150);
          const monoCheck = await API.search(rel.title, null);
          if (monoCheck && monoCheck.pop <= RARE_POP_MAX) {
            this._releaseCache[key] = rel;
            similar.push({
              ...rel,
              _monoId: monoCheck.id,
              _monoPop: monoCheck.pop
            });
          }
        }
      } catch { continue; }
    }
    
    return similar;
  },

  async _getMonochromeTracks(release) {
    const tracks = [];
    
    // Get recommendations from Monochrome using the release
    if (release._monoId) {
      try {
        await sleep(150);
        const recs = await API.getRecommendations(release._monoId);
        
        // Filter for rare tracks only (pop <= 40)
        const rareRecs = recs
          .filter(r => (r.pop || 100) <= RARE_POP_MAX)
          .slice(0, 5);
        
        for (const r of rareRecs) {
          tracks.push({
            tidalId: r.id,
            t: r.title,
            a: r.artist?.name || '',
            al: r.album?.title || release.title,
            y: (r.album?.releaseDate || '').slice(0, 4),
            art: tidalCover(r.album?.cover),
            pre: null,
            d: (r.duration || 0) * 1000,
            isrc: r.isrc || '',
            pop: r.pop || 0,
            sid: null,
            source: 'everynoise',
            _styles: [],
            _genres: [],
            _country: release.country || null,
            _labels: [],
          });
        }
      } catch { }
    }
    
    return tracks;
  },

  recordLike(presetId) {},
  recordSkip(presetId) {}
};

// Tracks go straight into the queue (no Tidal recommendation step),
// which guarantees the correct genre is preserved.
const DiscogsEngine = {
  _cache: {},  // 'artist|title' → { id, art, ... } | null
  _lastCfgUsed: {},  // 'presetId' → cfgIdx used in last getTracks call (for feedback)

  // Call when user likes a Discogs track — boosts that config's weight
  recordLike(presetId) {
    const cfgIdx = this._lastCfgUsed[presetId];
    if (cfgIdx == null) return;
    const w = S.discogsWeights[presetId] || (S.discogsWeights[presetId] = {});
    w[cfgIdx] = Math.min((w[cfgIdx] || 3) + 2, 30); // cap at 30
    saveState();
  },

  // Call when user skips a Discogs track — slightly reduces that config's weight
  recordSkip(presetId) {
    const cfgIdx = this._lastCfgUsed[presetId];
    if (cfgIdx == null) return;
    const w = S.discogsWeights[presetId] || (S.discogsWeights[presetId] = {});
    w[cfgIdx] = Math.max((w[cfgIdx] || 3) - 1, 1); // floor at 1 (never zero)
    saveState();
  },

  async getTracks(presetId, count = 25) {
    const configs = DISCOGS_CONFIGS[presetId];
    if (!configs?.length) return [];

    // ── 1. Group configs by `g`, apply per-config weights ──────────────
    const weights = S.discogsWeights[presetId] || {};
    const MIN_W = 3; // every config keeps at minimum this weight
    const byGroup = {}; // g → [{ idx, w }]
    configs.forEach((cfg, idx) => {
      (byGroup[cfg.g] = byGroup[cfg.g] || []).push({
        idx, w: Math.max(MIN_W, weights[idx] || MIN_W)
      });
    });

    // ── 2. Shuffle groups, pick 3 — one config per group (weighted random) ──
    // This guarantees geographic/stylistic variety: each refill comes from
    // 3 distinct "worlds" (e.g. Italian + Eastern European + Japanese).
    const groupKeys = Object.keys(byGroup).sort(() => Math.random() - 0.5);
    const cfgArr = groupKeys.slice(0, 3).map(gk => {
      const pool = byGroup[gk];
      const total = pool.reduce((s, x) => s + x.w, 0);
      let r = Math.random() * total;
      for (const { idx, w } of pool) { r -= w; if (r <= 0) return idx; }
      return pool[pool.length - 1].idx;
    });
    this._lastCfgUsed[presetId] = cfgArr[0]; // primary config for taste feedback

    // ── 3. Fetch each config on a random page ──────────────────────────
    const tracks = [];

    for (const cfgIdx of cfgArr) {
      if (tracks.length >= count) break;
      const cfg = configs[cfgIdx];
      // Bias toward earlier pages (higher want-count = more sought-after releases)
      // 65% → pages 1-8 (sweet spot of obscure-but-findable), 35% → pages 9-25 (deeper discovery)
      const _pageRaw = Math.random() < 0.65
        ? Math.ceil(Math.random() * 8)
        : Math.ceil(Math.random() * 17) + 8;
      const page = Math.max(1, _pageRaw);

      // 50% most-wanted sort (surface well-regarded but obscure), 50% default order
      const sortParams = Math.random() < 0.5 ? { sort: 'want', sort_order: 'desc' } : {};
      const qs = new URLSearchParams({
        type: 'release', per_page: '25', page: String(page), ...sortParams
      });
      if (cfg.genre) qs.set('genre', cfg.genre);
      if (cfg.style) qs.set('style', cfg.style);
      const country = S.forcedCountry || cfg.country;
      if (country) qs.set('country', country);
      if (cfg.year) qs.set('year', cfg.year);

      let releases = [];
      try {
        const r = await discogsFetch(`${DISCOGS_BASE}/database/search?${qs}`);
        if (!r.ok) continue;
        releases = (await r.json()).results || [];
      } catch { continue; }
      if (!releases.length) continue;

      // Rarest first: 5 ≤ have < DISCOGS_HAVE_MAX keeps us in the sweet spot
      // (findable on Tidal, not a blockbuster)
      const candidates = releases
        .filter(r => { const h = r.community?.have || 0; return h >= 5 && h < DISCOGS_HAVE_MAX; })
        .sort((a, b) => (a.community?.have || 99999) - (b.community?.have || 99999))
        .slice(0, 10);
      const picked = randPick(candidates, Math.min(5, candidates.length));
      const relArr = Array.isArray(picked) ? picked : (picked ? [picked] : []);

      const artistCount = {}; // per-batch artist cap

      for (const rel of relArr) {
        if (tracks.length >= count) break;
        await sleep(350);
        try {
          const dr = await discogsFetch(`${DISCOGS_BASE}/releases/${rel.id}`);
          if (!dr.ok) continue;
          const detail = await dr.json();
          const relAlbum = detail.title || rel.title || '';
          const relYear = String(detail.year || rel.year || '').slice(0, 4);
          const relArtist = detail.artists?.[0]?.name?.replace(/\s*\(\d+\)$/, '') || '';

          // Shuffle tracklist — don't always surface track 1
          const tracklist = (detail.tracklist || [])
            .filter(t => t.type_ !== 'heading' && t.title?.trim())
            .sort(() => Math.random() - 0.5)
            .slice(0, 3);

          for (const track of tracklist) {
            if (tracks.length >= count) break;
            const artist = track.artists?.[0]?.name?.replace(/\s*\(\d+\)$/, '') || relArtist;
            const key = `${artist}|${track.title}`;

            if (this._cache[key] === null) continue; // known miss on Tidal

            let cached = this._cache[key];
            if (!cached) {
              await sleep(130);
              const q = artist ? `${track.title} ${artist}` : track.title;
              const found = await API.search(q, null);
              if (found?.id && _tidalMatchOk(artist, track.title, found)) {
                cached = {
                  id: found.id,
                  art: tidalCover(found.album?.cover) || null,
                  d: (found.duration || 0) * 1000,
                  isrc: found.isrc || '',
                  al: found.album?.title || relAlbum,
                  y: (found.album?.releaseDate || relYear || '').slice(0, 4),
                };
                this._cache[key] = cached;
              } else {
                this._cache[key] = null;
                continue;
              }
            }
            if (!cached || tracks.some(t => t.tidalId === cached.id)) continue;

            const artistKey = artist.toLowerCase().trim();
            const ARTIST_COOLDOWN = 60;
            const cooldownPos = S.recentArtists.indexOf(artistKey);
            if (cooldownPos !== -1 && cooldownPos < ARTIST_COOLDOWN) continue;
            if ((artistCount[artistKey] || 0) >= 2) continue;
            artistCount[artistKey] = (artistCount[artistKey] || 0) + 1;

            tracks.push({
              tidalId: cached.id,
              t: track.title,
              a: artist,
              al: cached.al || relAlbum,
              y: cached.y || relYear,
              art: cached.art,
              pre: null,
              d: cached.d,
              isrc: cached.isrc,
              pop: 0,
              sid: null,
              source: 'discogs',
              // Discogs metadata — used by FeatureVec for scoring & profile updates
              _styles: detail.styles || [],
              _genres: detail.genres || [],
              _country: detail.country || cfg.country || null,
              _labels: (detail.labels || []).slice(0, 3).map(l => l.name || ''),
            });

            // Rolling artist cooldown — move to front so the 60-slot window is accurate
            if (cooldownPos !== -1) S.recentArtists.splice(cooldownPos, 1);
            S.recentArtists.unshift(artistKey);
            if (S.recentArtists.length > 150) S.recentArtists.length = 150;
          }
        } catch { continue; }
      }
    }
    return tracks;
  }
};

// ─── ENRICH ENGINE ────────────────────────────────────────────────
// Fetches Last.fm top tags per track; caches in S.enrichCache (persisted).
// Tags like "rare groove", "spiritual jazz", "library music" are the
// highest-signal features for this taste profile.
const EnrichEngine = {

  // Fetch Last.fm top tags for artist+title → [{n, w}]
  async _lfmTags(artist, title) {
    try {
      const SKIP = new Set(['seen live', 'favorites', 'favourite', 'love', '00s', '10s', '20s', 'mp3']);
      const qs = new URLSearchParams({
        method: 'track.getTopTags', artist, track: title,
        api_key: LASTFM_KEY, format: 'json', autocorrect: '1'
      });
      const r = await fetchWithTimeout(`${LASTFM_BASE}/2.0/?${qs}`, API_TIMEOUT);
      if (!r.ok) return [];
      const json = await r.json();
      return (json.toptags?.tag || [])
        .filter(t => t.name && !SKIP.has(t.name.toLowerCase()) && parseInt(t.count) > 0)
        .slice(0, 12)
        .map(t => ({ n: t.name.toLowerCase(), w: Math.min(parseInt(t.count) / 100, 1) || 0.1 }));
    } catch { return []; }
  },

  // Get (or fetch + cache) enrichment for a track
  async getFeatures(artist, title) {
    const key = `${(artist || '').toLowerCase().trim()}|${(title || '').toLowerCase().trim()}`;
    if (S.enrichCache[key]) return S.enrichCache[key];
    const tags = await this._lfmTags(artist, title);
    const entry = { tags, ts: Date.now() };
    S.enrichCache[key] = entry;
    return entry;
  },

  // Background enrichment: silently enrich unprocessed liked tracks in small batches
  async enrichLikedBg() {
    const BATCH = 6;
    const todo = [...S.myLiked, ...CATALOG.slice(0, 300)]
      .filter(t => {
        const k = `${(t.a || '').toLowerCase().trim()}|${(t.t || '').toLowerCase().trim()}`;
        return !S.enrichCache[k];
      })
      .slice(0, BATCH);
    for (const t of todo) {
      await sleep(450); // ~2 req/s — well within Last.fm 5 req/s limit
      await this.getFeatures(t.a || '', t.t || '');
    }
    if (todo.length) {
      saveState();
      UserProfile.seedFromLiked(); // update profile as new enrichments arrive
    }
    // Schedule next batch if more remain
    const remaining = [...S.myLiked, ...CATALOG.slice(0, 300)]
      .filter(t => !S.enrichCache[`${(t.a || '').toLowerCase().trim()}|${(t.t || '').toLowerCase().trim()}`]);
    if (remaining.length) setTimeout(() => EnrichEngine.enrichLikedBg(), 8000);
  }
};


// ─── SIMILAR ARTIST ENGINE ────────────────────────────────────────────────────
// Uses Last.fm artist.getSimilar to find artists close to the user's taste,
// then searches Discogs for their releases. Runs in the background (non-blocking)
// and pushes found tracks directly into S.queue to supplement preset candidates.
const SimilarArtistEngine = {
  _simCache: {},   // artistName → [similarNames]

  async _similar(artist) {
    if (this._simCache[artist]) return this._simCache[artist];
    try {
      const qs = new URLSearchParams({
        method: 'artist.getSimilar', artist,
        api_key: LASTFM_KEY, format: 'json', limit: '8', autocorrect: '1'
      });
      const r = await fetchWithTimeout(`${LASTFM_BASE}/2.0/?${qs}`, API_TIMEOUT);
      if (!r.ok) return [];
      const d = await r.json();
      const names = (d.similarartists?.artist || []).slice(0, 8).map(a => a.name);
      this._simCache[artist] = names;
      return names;
    } catch { return []; }
  },

  async buildClusterQueue(baseArtists, maxAdd = 15) {
    if (!baseArtists || baseArtists.length === 0) return [];

    const simSet = new Set(baseArtists);

    for (const artist of baseArtists) {
      await sleep(220);
      const similar = await this._similar(artist);
      similar.forEach(s => simSet.add(s));
    }

    let added = 0;
    const tracks = [];
    const pool = [...simSet].sort(() => Math.random() - 0.5);

    for (const artist of pool) {
      if (added >= maxAdd) break;
      await sleep(400);
      try {
        const qs = new URLSearchParams({
          type: 'release', artist,
          per_page: '10', page: String(Math.ceil(Math.random() * 4) + 1),
          sort: 'want', sort_order: 'desc'
        });
        if (S.forcedCountry) qs.set('country', S.forcedCountry);
        const r = await discogsFetch(`${DISCOGS_BASE}/database/search?${qs}`);
        if (!r.ok) continue;
        const releases = (await r.json()).results || [];
        const valid = releases
          .filter(rel => { const h = rel.community?.have || 0; return h >= 3 && h < DISCOGS_HAVE_MAX; })
          .slice(0, 2);

        for (const rel of valid) {
          if (added >= maxAdd) break;
          await sleep(400);
          try {
            const dr = await discogsFetch(`${DISCOGS_BASE}/releases/${rel.id}`);
            if (!dr.ok) continue;
            const detail = await dr.json();
            // Style guardrail: once the profile is mature, only accept releases
            // whose genres/styles overlap with the user's top profile dimensions.
            if (S.profileTotal >= 5) {
              const relStyles = [...(detail.styles || []), ...(detail.genres || [])]
                .map(s => s.toLowerCase().trim());
              const profStyles = Object.keys(UserProfile.get())
                .filter(k => k.startsWith('sty:') || k.startsWith('gen:'))
                .map(k => k.slice(4));
              if (profStyles.length > 0 && !relStyles.some(rs =>
                profStyles.some(ps => rs.includes(ps) || ps.includes(rs))))
                continue; // wrong genre — skip this release
            }
            const relAlbum = detail.title || '';
            const relYear = String(detail.year || '').slice(0, 4);
            const relArtist = detail.artists?.[0]?.name?.replace(/s*(d+)$/, '') || artist;

            const tracklist = (detail.tracklist || [])
              .filter(t => t.type_ !== 'heading' && t.title?.trim())
              .sort(() => Math.random() - 0.5)
              .slice(0, 2);

            for (const track of tracklist) {
              if (added >= maxAdd) break;
              const ta = track.artists?.[0]?.name?.replace(/s*(d+)$/, '') || relArtist;
              const key = `${ta}|${track.title}`;
              if (DiscogsEngine._cache[key] === null) continue;
              let cached = DiscogsEngine._cache[key];
              if (!cached) {
                await sleep(140);
                const found = await API.search(`${track.title} ${ta}`, null);
                if (found?.id && _tidalMatchOk(ta, track.title, found)) {
                  cached = {
                    id: found.id,
                    art: tidalCover(found.album?.cover) || null,
                    d: (found.duration || 0) * 1000,
                    isrc: found.isrc || '',
                    al: found.album?.title || relAlbum,
                    y: (found.album?.releaseDate || relYear || '').slice(0, 4),
                  };
                  DiscogsEngine._cache[key] = cached;
                } else { DiscogsEngine._cache[key] = null; continue; }
              }
              if (!cached) continue;

              const t = {
                tidalId: cached.id,
                t: track.title,
                a: ta,
                al: cached.al || relAlbum,
                y: cached.y || relYear,
                art: cached.art,
                pre: null,
                d: cached.d,
                isrc: cached.isrc,
                pop: 0,
                sid: null,
                source: 'cluster',
                _src: 'cluster',
                _styles: detail.styles || [],
                _genres: detail.genres || [],
                _country: detail.country || null,
                _labels: (detail.labels || []).slice(0, 3).map(l => l.name || ''),
              };

              if (!hasSeen(t) && !isLiked(t)) {
                tracks.push(t);
                added++;
              }
            }
          } catch { continue; }
        }
      } catch { continue; }
    }
    return tracks;
  }
};

// ─── LISTENBRAINZ ENGINE ─────────────────────────────────────────────
const LBEngine = {
  // Verify token and save user info
  async connect(username, token) {
    try {
      const r = await fetch(LB_BASE + '/validate-token', {
        headers: { 'Authorization': 'Token ' + token }
      });
      const d = await r.json();
      if (!d.valid) return { ok: false, msg: 'Token non valido' };
      S.lbUser = username; S.lbToken = token;
      saveState();
      return { ok: true, msg: 'Connesso come ' + username };
    } catch { return { ok: false, msg: 'Errore di rete' }; }
  },

  // Submit a single listen (scrobble) to ListenBrainz
  async submitListen(track, listenedAt) {
    if (!S.lbToken || !track) return;
    try {
      const mbKey = ((track.a || '').toLowerCase().trim()) + '|' + ((track.t || '').toLowerCase().trim());
      await fetch(LB_BASE + '/submit-listens', {
        method: 'POST',
        headers: { 'Authorization': 'Token ' + S.lbToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listen_type: 'single',
          payload: [{
            listened_at: Math.floor((listenedAt || Date.now()) / 1000),
            track_metadata: {
              artist_name: track.a || '', track_name: track.t || '', release_name: track.al || '',
              additional_info: {
                media_player: 'Swerve', music_service: 'tidal.com',
                recording_mbid: S.mbCache[mbKey]?.mbid || undefined
              }
            }
          }]
        })
      });
    } catch { }
  },

  // Send now-playing notification
  async nowPlaying(track) {
    if (!S.lbToken || !track) return;
    try {
      await fetch(LB_BASE + '/submit-listens', {
        method: 'POST',
        headers: { 'Authorization': 'Token ' + S.lbToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listen_type: 'playing_now',
          payload: [{ track_metadata: { artist_name: track.a || '', track_name: track.t || '', release_name: track.al || '' } }]
        })
      });
    } catch { }
  },

  // Fetch collaborative-filtering recommendations for the connected user.
  // Maps MBIDs to artist+title via LB metadata endpoint, stores as lbRecQueries.
  async loadRecs() {
    if (!S.lbUser) return;
    if (Date.now() - S.lbRecsTs < 2 * 3600000) return; // 2h cache
    try {
      const r = await fetch(LB_BASE + '/cf/recommendation/user/' + S.lbUser + '/recording?count=50');
      if (!r.ok) return;
      const d = await r.json();
      const mbids = (d.payload?.mbids_and_ratings || []).slice(0, 25).map(x => x.recording_mbid).filter(Boolean);
      if (!mbids.length) return;
      const metaR = await fetch(LB_BASE + '/metadata/recording/?recording_mbids=' + mbids.join(',') + '&inc=artist+release');
      if (!metaR.ok) return;
      const meta = await metaR.json();
      S.lbRecQueries = Object.entries(meta).map(([mbid, m]) => ({
        t: m.recording?.name || m.recording?.title || '',
        a: m.recording?.['artist-credit-phrase'] || m.recording?.['artist-credit']?.[0]?.artist?.name || '',
        mbid
      })).filter(q => q.t && q.a);
      S.lbRecsTs = Date.now();
      saveState();
      // Immediately start resolving a few to Tidal tracks
      LBEngine.resolveToTidal(8);
    } catch { }
  },

  // Convert lbRecQueries to Tidal tracks (background, non-blocking)
  async resolveToTidal(count) {
    const pending = S.lbRecQueries.filter(q =>
      !S.lbTracks.some(t => t._lbMbid === q.mbid) &&
      !hasSeen({ isrc: '', tidalId: '' }) // just to call hasSeen
    ).slice(0, count);
    for (const q of pending) {
      await sleep(200);
      try {
        const found = await API.search(q.t + ' ' + q.a, null);
        if (!found?.id) continue;
        if (!_tidalMatchOk(q.a, q.t, found)) continue;
        const t = fromTidal(found);
        if (isLiked(t) || hasSeen(t)) continue;
        t._lbMbid = q.mbid;
        S.lbTracks.push(t);
      } catch { }
    }
  }
};

// ─── LAST.FM SCROBBLING ENGINE ────────────────────────────────────────────
const LastFMEngine = {

  async connect(username, password) {
    if (!username || !password) return { ok: false, msg: 'Username e password obbligatori' };
    try {
      const params = { api_key: LASTFM_KEY, method: 'auth.getMobileSession', password: _md5(password), username };
      const sig = _lfmSig(params, LASTFM_SECRET);
      const body = new URLSearchParams({ ...params, api_sig: sig, format: 'json' });
      const r = await fetch(LASTFM_BASE + '/2.0/', { method: 'POST', body });
      const d = await r.json();
      if (d.error) return { ok: false, msg: 'Errore Last.fm: ' + d.message };
      S.lfmSessionKey = d.session?.key;
      S.lfmUsername = d.session?.name || username;
      saveState();
      return { ok: true, msg: 'Connesso come ' + S.lfmUsername };
    } catch (e) { return { ok: false, msg: 'Errore: ' + e.message }; }
  },

  async nowPlaying(track) {
    if (!S.lfmSessionKey || !track) return;
    try {
      const params = {
        api_key: LASTFM_KEY, artist: track.a || '', duration: String(Math.round((track.d || 0) / 1000)),
        method: 'track.updateNowPlaying', sk: S.lfmSessionKey, track: track.t || ''
      };
      if (track.al) params.album = track.al;
      const sig = _lfmSig(params, LASTFM_SECRET);
      const body = new URLSearchParams({ ...params, api_sig: sig, format: 'json' });
      await fetch(LASTFM_BASE + '/2.0/', { method: 'POST', body });
    } catch { }
  },

  async scrobble(track, listenedAt) {
    if (!S.lfmSessionKey || !track) return;
    try {
      const params = {
        api_key: LASTFM_KEY, artist: track.a || '', method: 'track.scrobble',
        sk: S.lfmSessionKey, timestamp: String(Math.floor((listenedAt || Date.now()) / 1000)),
        track: track.t || ''
      };
      if (track.al) params.album = track.al;
      const sig = _lfmSig(params, LASTFM_SECRET);
      const body = new URLSearchParams({ ...params, api_sig: sig, format: 'json' });
      await fetch(LASTFM_BASE + '/2.0/', { method: 'POST', body });
    } catch { }
  }
};
// ─── SPOTIFY ENGINE ───────────────────────────────────────────────
const SpotifyEngine = {
  async _getToken() {
    if (S.spotifyToken && Date.now() < S.spotifyTokenExp - 60_000) return S.spotifyToken;
    try {
      const creds = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_SECRET}`);
      const r = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
      });
      const d = await r.json();
      if (!d.access_token) return null;
      S.spotifyToken = d.access_token;
      S.spotifyTokenExp = Date.now() + d.expires_in * 1000;
      return S.spotifyToken;
    } catch { return null; }
  },

  async _searchId(track) {
    const token = await this._getToken();
    if (!token) return null;
    try {
      if (track.isrc) {
        const r = await fetch(`${SPOTIFY_BASE}/search?q=isrc:${encodeURIComponent(track.isrc)}&type=track&limit=1`, { headers: { 'Authorization': 'Bearer ' + token } });
        const d = await r.json();
        const id = d.tracks?.items?.[0]?.id;
        if (id) return id;
      }
      if (track.t && track.a) {
        const q = encodeURIComponent(`track:${track.t} artist:${track.a}`);
        const r = await fetch(`${SPOTIFY_BASE}/search?q=${q}&type=track&limit=1`, { headers: { 'Authorization': 'Bearer ' + token } });
        const d = await r.json();
        return d.tracks?.items?.[0]?.id || null;
      }
    } catch { }
    return null;
  },

  async getFeatures(track) {
    const ck = track.isrc || `${(track.a || '').toLowerCase().trim()}|${(track.t || '').toLowerCase().trim()}`;
    if (S.spotifyCache[ck]) return S.spotifyCache[ck];
    try {
      const sid = await this._searchId(track);
      if (!sid) return null;
      const token = await this._getToken();
      const r = await fetch(`${SPOTIFY_BASE}/audio-features/${sid}`, { headers: { 'Authorization': 'Bearer ' + token } });
      const f = await r.json();
      if (!f || f.energy == null) return null;
      const result = {
        energy: f.energy, valence: f.valence, tempo: f.tempo,
        key: f.key, mode: f.mode, danceability: f.danceability,
        acousticness: f.acousticness, instrumentalness: f.instrumentalness,
        spotifyId: sid, ts: Date.now()
      };
      S.spotifyCache[ck] = result;
      return result;
    } catch { return null; }
  },

  async buildProfile() {
    // Fall back to catalog tracks if user hasn't scaled up their likes
    const source = S.myLiked.length >= 3 ? S.myLiked.slice(-25) : randPick(CATALOG, Math.min(25, CATALOG.length)) || [];
    const sourceArr = Array.isArray(source) ? source : [source];
    if (sourceArr.length === 0) return;
    const feats = [];
    for (const t of sourceArr) {
      await sleep(120);
      const f = await this.getFeatures(t);
      if (f) feats.push(f);
    }
    if (feats.length < 3) return;
    const avg = k => feats.reduce((s, f) => s + f[k], 0) / feats.length;
    const std = (k, m) => Math.sqrt(feats.reduce((s, f) => s + (f[k] - m) ** 2, 0) / feats.length);
    const eM = avg('energy'), vM = avg('valence'), tM = avg('tempo');
    S.audioProfile = {
      energy: { mean: eM, std: Math.max(std('energy', eM), 0.12) },
      valence: { mean: vM, std: Math.max(std('valence', vM), 0.15) },
      tempo: { mean: tM, std: Math.max(std('tempo', tM), 20) },
      count: feats.length
    };
    saveState();
  },

  passesFilter(track) {
    if (!S.audioProfile || S.audioProfile.count < 3) return true;
    const ck = track.isrc || `${(track.a || '').toLowerCase().trim()}|${(track.t || '').toLowerCase().trim()}`;
    const f = S.spotifyCache[ck];
    if (!f) return true;
    const { energy, valence, tempo } = S.audioProfile;
    return Math.abs(f.energy - energy.mean) <= 2.2 * energy.std
      && Math.abs(f.valence - valence.mean) <= 2.2 * valence.std
      && Math.abs(f.tempo - tempo.mean) <= 2.2 * tempo.std;
  },

  // Fetch and cache all valid EveryNoise/Spotify genre seed names (once per session)
  async loadGenreSeeds() {
    if (S.genreSeeds.length > 0) return S.genreSeeds;
    const token = await this._getToken();
    if (!token) return [];
    try {
      const r = await fetch(`${SPOTIFY_BASE}/recommendations/available-genre-seeds`, { headers: { 'Authorization': 'Bearer ' + token } });
      const d = await r.json();
      S.genreSeeds = d.genres || [];
      saveState();
      return S.genreSeeds;
    } catch { return []; }
  },

  // Map profile's top sty:/gen: keys to valid Spotify genre seeds.
  // Also mixes in frontierGenres (discovered through previous recs).
  _profileToGenreSeeds(n = 3) {
    const available = new Set(S.genreSeeds);
    if (!available.size) return [];
    const topKeys = _profileTopGenreKeys(20);
    const matched = [];
    for (const k of topKeys) {
      const raw = k.replace(/^(sty:|gen:|tag:)/, '').toLowerCase().trim();
      if (available.has(raw)) matched.push(raw);
      // Try with hyphens replacing spaces
      const hyph = raw.replace(/\s+/g, '-');
      if (hyph !== raw && available.has(hyph)) matched.push(hyph);
      if (matched.length >= n) break;
    }
    // Mix in frontier genres (max 2), deduped
    for (const g of S.frontierGenres.slice(-4)) {
      if (matched.length >= n + 2) break;
      if (!matched.includes(g)) matched.push(g);
    }
    return [...new Set(matched)].slice(0, n + 2);
  },

  // After getting Spotify recs, extract genres from their artists to extend frontierGenres.
  // This creates genre-level constellation chaining (genre graph traversal).
  async _extendGenreFrontier(spTracks, token) {
    try {
      const artistIds = [...new Set(spTracks.flatMap(t => t.artists?.map(a => a.id) || []))].slice(0, 10);
      if (!artistIds.length) return;
      const r = await fetch(`${SPOTIFY_BASE}/artists?ids=${artistIds.join(',')}`, { headers: { 'Authorization': 'Bearer ' + token } });
      const d = await r.json();
      const newGenres = (d.artists || []).flatMap(a => a.genres || []);
      const available = new Set(S.genreSeeds);
      for (const g of newGenres) {
        if (available.has(g) && !S.frontierGenres.includes(g)) {
          S.frontierGenres.push(g);
        }
      }
      if (S.frontierGenres.length > 30) S.frontierGenres = S.frontierGenres.slice(-30);
    } catch { }
  },

  async getRecsForProfile() {
    const token = await this._getToken();
    if (!token) return [];
    try {
      // Ensure genre seeds are loaded
      await this.loadGenreSeeds();

      // Resolve top liked artists to Spotify IDs (up to 2)
      let topArtists = Object.entries(S.taste.artists || {})
        .sort((a, b) => b[1].liked - a[1].liked).slice(0, 2).map(([a]) => a);
      if (topArtists.length === 0 && CATALOG.length > 0) {
        const fallbackArtists = randPick(CATALOG, 5);
        for (const t of (Array.isArray(fallbackArtists) ? fallbackArtists : [fallbackArtists])) {
          if (t.a && !topArtists.includes(t.a)) topArtists.push(t.a);
        }
        topArtists = topArtists.slice(0, 2);
      }

      const artistIds = [];
      for (const a of topArtists) {
        await sleep(100);
        try {
          const r = await fetch(`${SPOTIFY_BASE}/search?q=${encodeURIComponent('artist:' + a)}&type=artist&limit=1`, { headers: { 'Authorization': 'Bearer ' + token } });
          const d = await r.json();
          const id = d.artists?.items?.[0]?.id;
          if (id) artistIds.push(id);
        } catch { }
      }

      // Build seed mix: artists + EveryNoise genre seeds (total ≤ 5)
      const genreSeedList = this._profileToGenreSeeds(3);
      const totalSeeds = artistIds.length + genreSeedList.length;
      if (!totalSeeds) return [];

      const params = new URLSearchParams({
        limit: '15',
        max_popularity: String(RARE_POP_MAX), // avoid mainstream hits
      });
      if (S.audioProfile && S.audioProfile.count >= 3) {
        const { energy, valence, tempo } = S.audioProfile;
        params.set('target_energy', energy.mean.toFixed(3));
        params.set('target_valence', valence.mean.toFixed(3));
        params.set('target_tempo', Math.round(tempo.mean).toString());
        params.set('min_energy', Math.max(0, energy.mean - 2 * energy.std).toFixed(3));
        params.set('max_energy', Math.min(1, energy.mean + 2 * energy.std).toFixed(3));
        params.set('min_valence', Math.max(0, valence.mean - 2 * valence.std).toFixed(3));
        params.set('max_valence', Math.min(1, valence.mean + 2 * valence.std).toFixed(3));
      }
      if (artistIds.length) params.set('seed_artists', artistIds.slice(0, 2).join(','));
      if (genreSeedList.length) params.set('seed_genres', genreSeedList.slice(0, 5 - artistIds.length).join(','));

      const r = await fetch(`${SPOTIFY_BASE}/recommendations?${params}`, { headers: { 'Authorization': 'Bearer ' + token } });
      const d = await r.json();
      const spTracks = d.tracks || [];

      // Extend genre frontier from this batch's artists (async, non-blocking)
      this._extendGenreFrontier(spTracks, token);

      const result = [];
      for (const sp of spTracks.slice(0, 12)) {
        await sleep(150);
        try {
          const artistName = sp.artists?.[0]?.name || '';
          const found = await API.search(`${sp.name} ${artistName}`, null);
          if (!_tidalMatchOk(artistName, sp.name, found)) continue;
          const t = fromTidal(found);
          if (hasSeen(t) || Taste.shouldFilter(t) || isLiked(t)) continue;
          if (t.sid && CATALOG.some(c => c.sid === t.sid)) continue;
          if (t.isrc && CATALOG.some(c => c.isrc === t.isrc)) continue;
          if (t.pop > RARE_POP_MAX) continue;
          const ck = t.isrc || `${(t.a || '').toLowerCase().trim()}|${(t.t || '').toLowerCase().trim()}`;
          if (!S.spotifyCache[ck] && S.audioProfile && S.audioProfile.count >= 3) {
            const { energy, valence, tempo } = S.audioProfile;
            S.spotifyCache[ck] = { energy: energy.mean, valence: valence.mean, tempo: tempo.mean, ts: Date.now() };
          }
          t._src = 'spotify_rec';
          result.push(t);
        } catch { }
      }
      return result;
    } catch { return []; }
  }
};

// ─── FEATURE VECTORS ──────────────────────────────────────────────
// Builds a sparse vector from a track's Discogs metadata + Last.fm tags.
// Keys: sty: (Discogs style), gen: (genre), tag: (Last.fm), dec: (decade),
//        ctr: (country), lbl: (label).
const FeatureVec = {
  build(track) {
    const vec = {};
    const add = (k, w) => { vec[k] = (vec[k] || 0) + w; };

    // Discogs metadata attached to track by DiscogsEngine
    (track._styles || []).forEach(s => add(`sty:${s.toLowerCase()}`, 2.0));
    (track._genres || []).forEach(g => add(`gen:${g.toLowerCase()}`, 1.5));
    (track._labels || []).forEach(l => add(`lbl:${l.toLowerCase()}`, 0.8));
    if (track._country) add(`ctr:${track._country.toLowerCase()}`, 0.6);

    // Last.fm tags from enrichCache
    const ck = `${(track.a || '').toLowerCase().trim()}|${(track.t || '').toLowerCase().trim()}`;
    (S.enrichCache[ck]?.tags || []).forEach(t => add(`tag:${t.n}`, t.w * 1.5));

    // Decade — prefer MusicBrainz firstRelease for precision
    const mbKeyFV = ((track.a || '').toLowerCase().trim()) + '|' + ((track.t || '').toLowerCase().trim());
    const mbFV = S.mbCache[mbKeyFV];
    const yr = parseInt(mbFV?.firstRelease?.slice(0, 4) || track.y);
    if (yr > 1900) add('dec:' + (Math.floor(yr / 10) * 10), 1.0);

    // MusicBrainz enrichment: more precise country + label
    if (mbFV?.country) add('ctr:' + mbFV.country.toLowerCase(), 0.5);
    if (mbFV?.label) add('lbl:' + mbFV.label.toLowerCase().slice(0, 20), 0.35);

    return vec;
  },

  // Cosine similarity between two sparse vectors → [0, 1]
  sim(v1, v2) {
    let dot = 0, m1 = 0, m2 = 0;
    for (const k in v1) { m1 += v1[k] ** 2; if (v2[k]) dot += v1[k] * v2[k]; }
    for (const k in v2) m2 += v2[k] ** 2;
    const d = Math.sqrt(m1) * Math.sqrt(m2);
    return d > 0 ? dot / d : 0;
  }
};

// ─── USER PROFILE (online learning) ───────────────────────────────
// Maintains a sparse feature vector updated in real-time on every swipe/listen.
const UserProfile = {
  _W: {
    like: 1.0, swipe_like: 1.2, playlist: 2.0,
    listen_long: 0.5, skip_fast: -0.5, dislike: -0.8
  },

  update(track, action) {
    const w = this._W[action];
    if (!w) return;
    const vec = FeatureVec.build(track);
    for (const k in vec) S.profileVector[k] = (S.profileVector[k] || 0) + w * vec[k];
    S.profileTotal = (S.profileTotal || 0) + Math.abs(w);
  },

  // Normalized profile (for scoring).
  // Sqrt-damping applied at read time: reduces dominance of over-represented genres
  // (e.g. 10 Brazilian likes ≠ 10× weight) without touching the stored accumulator.
  get() {
    if (!S.profileTotal) return {};
    const raw = {};
    for (const k in S.profileVector) if (S.profileVector[k] !== 0) raw[k] = S.profileVector[k] / S.profileTotal;
    const damped = {};
    for (const k in raw) damped[k] = Math.sign(raw[k]) * Math.sqrt(Math.abs(raw[k]));
    const sum = Object.values(damped).reduce((s, x) => s + Math.abs(x), 0);
    if (!sum) return raw;
    const v = {};
    for (const k in damped) v[k] = damped[k] / sum;
    return v;
  },

  // Seed profile from already-enriched liked tracks (runs at startup + after each enrichBg batch)
  seedFromLiked() {
    let n = 0;
    for (const t of S.myLiked) {
      const k = `${(t.a || '').toLowerCase().trim()}|${(t.t || '').toLowerCase().trim()}`;
      if (!S.enrichCache[k]) continue;
      this.update(t, 'like');
      n++;
    }
    if (n) saveState();
    return n;
  }
};

// ─── SCORER ───────────────────────────────────────────────────────
// Multi-factor scoring: affinity (40%) + quality (25%) + novelty (20%) + diversity (15%).
const Scorer = {
  RARE_TAGS: new Set([
    'rare groove', 'library music', 'spiritual jazz', 'jazz-funk', 'soul-jazz',
    'bossa nova', 'afrobeat', 'afro soul', 'ethio-jazz', 'free jazz', 'avant-garde',
    'modal jazz', 'post-bop', 'film music', 'soundtrack', 'library', 'easy listening',
    'psych', 'psychedelic soul', 'deep funk', 'funk', 'giallo', 'spaghetti western',
    'krautrock', 'groove', 'rare soul', 'northern soul', 'acid jazz'
  ]),

  score(track, opts = {}) {
    const profile = UserProfile.get();
    const vec = FeatureVec.build(track);
    const hasProf = Object.keys(profile).length > 3;

    // 1. Affinity — how well the track matches your taste vector
    const affinity = hasProf ? FeatureVec.sim(profile, vec) : 0.5;

    // 2. Quality — rare-grade signals from Last.fm tags
    const ck = `${(track.a || '').toLowerCase().trim()}|${(track.t || '').toLowerCase().trim()}`;
    const rareCount = (S.enrichCache[ck]?.tags || []).filter(t => this.RARE_TAGS.has(t.n)).length;
    const mbScorer = S.mbCache[ck];
    const origBonus = mbScorer?.isOriginal === true ? 0.1 : 0;
    const quality = Math.min(0.3 + rareCount * 0.12 + origBonus, 1.0);

    // 3. Novelty — penalise recently surfaced artists
    const ak = (track.a || '').toLowerCase().trim();
    const ri = S.recentArtists.indexOf(ak);
    const novelty = ri === -1 ? 1.0 : Math.max(0.1, 1 - (ri / 60) * 0.9);

    // 4. Diversity — distance from the tracks already in the current queue slice
    let diversity = 1.0;
    if (opts.recentVecs?.length) {
      const maxSim = Math.max(...opts.recentVecs.map(rv => FeatureVec.sim(vec, rv)));
      diversity = Math.max(0.1, 1 - maxSim * 0.8);
    }

    // 5. Dislike penalty — penalise similarity to skipped tracks (Plan E).
    // Only activate after ≥3 accumulated skips to avoid over-fitting session-start noise.
    let dislikePenalty = 0;
    if (S.dislikeTotal >= 3 && Object.keys(S.dislikeVec).length > 0) {
      const dvec = {};
      for (const k in S.dislikeVec) dvec[k] = S.dislikeVec[k] / S.dislikeTotal;
      dislikePenalty = FeatureVec.sim(dvec, vec) * 0.35;
    }

    // 6b. Audio affinity bonus — reward tracks matching user's audio profile
    let audioBonus = 0;
    if (S.audioProfile?.count >= 3) {
      const spFeats = S.spotifyCache[ck];
      if (spFeats) {
        const { energy, valence, tempo } = S.audioProfile;
        const eAff = Math.max(0, 1 - Math.abs(spFeats.energy - energy.mean) / (2 * energy.std));
        const vAff = Math.max(0, 1 - Math.abs(spFeats.valence - valence.mean) / (2 * valence.std));
        const tAff = Math.max(0, 1 - Math.abs(spFeats.tempo - tempo.mean) / (2 * tempo.std));
        audioBonus = ((eAff + vAff + tAff) / 3) * 0.12;
      }
    }

    // 6. Discovery bonus — reward genuinely new artists (Plan F)
    // Cache liked artist set per scoring batch (invalidated when myLiked grows)
    if (!Scorer._likedArtistCache || Scorer._likedArtistCacheLen !== S.myLiked.length) {
      Scorer._likedArtistCache = new Set(S.myLiked.map(t => (t.a || '').toLowerCase().trim()));
      Scorer._likedArtistCacheLen = S.myLiked.length;
    }
    const isNewArtist = !Scorer._likedArtistCache.has(ak) && ri === -1;
    const discoveryBonus = isNewArtist && affinity > 0.25 ? 0.15 : 0;

    // Weights adapt: when the profile is mature (>10 actions), trust affinity more
    const _mature = S.profileTotal > 10;
    const [_aw, _qw, _nw, _dw] = _mature ? [0.60, 0.20, 0.12, 0.08] : [0.40, 0.25, 0.20, 0.15];
    const raw = affinity * _aw + quality * _qw + novelty * _nw + diversity * _dw
      + discoveryBonus + audioBonus - dislikePenalty;
    const total = Math.max(0, Math.min(1, raw));
    return { total, affinity, quality, novelty, diversity, vec };
  }
};

// Maximal Marginal Relevance — diversify a scored candidate list.
// λ = 0.7: weight 70% relevance, 30% distance from already-picked.
function mmrRerank(scored, n, lambda = 0.7) {
  if (scored.length <= n) return scored;
  const selected = [], remaining = [...scored];
  while (selected.length < n && remaining.length) {
    let bestIdx = 0, bestVal = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const relevance = remaining[i].sc.total;
      const maxSim = selected.length
        ? Math.max(...selected.map(s => FeatureVec.sim(remaining[i].sc.vec, s.sc.vec)))
        : 0;
      const mmrVal = lambda * relevance - (1 - lambda) * maxSim;
      if (mmrVal > bestVal) { bestVal = mmrVal; bestIdx = i; }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  return selected;
}

// ─── TASTE ENGINE ─────────────────────────────────────────────────
const Taste = {
  recordLike(track) {
    const a = normalizeArtist(track.a);
    S.taste.artists[a] = S.taste.artists[a] || { liked: 0, skipped: 0 };
    S.taste.artists[a].liked++;

    const decade = Math.floor(parseInt(track.y || 2000) / 10) * 10;
    S.taste.decades[decade] = S.taste.decades[decade] || { liked: 0, skipped: 0 };
    S.taste.decades[decade].liked++;

    if (track.tidalId) {
      const existing = S.taste.seeds.find(s => s.id === track.tidalId);
      if (existing) {
        existing.weight = Math.min(existing.weight + 5, 30);
      } else {
        S.taste.seeds.push({ id: track.tidalId, weight: 10, title: track.t });
      }
      // Keep seeds list manageable
      if (S.taste.seeds.length > 100) {
        S.taste.seeds.sort((a, b) => b.weight - a.weight);
        S.taste.seeds = S.taste.seeds.slice(0, 60);
      }
    }
    S.taste.total++;
    saveState();
  },

  recordSkip(track) {
    const a = normalizeArtist(track.a);
    S.taste.artists[a] = S.taste.artists[a] || { liked: 0, skipped: 0 };
    S.taste.artists[a].skipped++;

    const decade = Math.floor(parseInt(track.y || 2000) / 10) * 10;
    S.taste.decades[decade] = S.taste.decades[decade] || { liked: 0, skipped: 0 };
    S.taste.decades[decade].skipped++;

    // Proxy-skip penalty: fetch similar artists and penalize them too (background)
    setTimeout(async () => {
      try {
        const similar = await SimilarArtistEngine._similar(a);
        for (const sim of similar.slice(0, 5)) {
          const sa = normalizeArtist(sim);
          S.taste.artists[sa] = S.taste.artists[sa] || { liked: 0, skipped: 0 };
          S.taste.artists[sa].skipped += 0.5; // proxy penalty
        }
        saveState();
      } catch { }
    }, 100);

    saveState();
  },

  shouldFilter(track) {
    const a = normalizeArtist(track.a);
    const pref = S.taste.artists[a];

    // Aggressive Penalty: Block if skipped even ONCE with zero likes
    if (pref && pref.skipped >= 1 && (pref.liked || 0) === 0) return true;

    // Block if skips outnumber likes
    if (pref && pref.skipped > (pref.liked || 0)) return true;

    return false;
  },

  score(track) {
    let s = 0;
    const a = normalizeArtist(track.a);
    const pref = S.taste.artists[a];
    if (pref) { s += pref.liked * 6 - pref.skipped * 2; }
    const decade = Math.floor(parseInt(track.y || 2000) / 10) * 10;
    const dp = S.taste.decades[decade];
    if (dp) { s += dp.liked * 2 - dp.skipped; }
    s -= (track.pop || 0) * 0.15;   // rare mode: penalise popularity
    return s;
  },

  // Pick best seed tidalIds (weighted random)
  pickSeeds(count = 3) {
    if (S.taste.seeds.length === 0) return [];
    const seeds = [...S.taste.seeds].sort((a, b) => b.weight - a.weight);
    const result = [];
    const used = new Set();
    // Top 60% by weight, pick randomly
    const pool = seeds.slice(0, Math.max(count * 3, 12));
    const totalW = pool.reduce((s, seed) => s + seed.weight, 0);
    for (let attempt = 0; attempt < count * 5 && result.length < count; attempt++) {
      let r = Math.random() * totalW;
      for (const seed of pool) {
        r -= seed.weight;
        if (r <= 0 && !used.has(seed.id)) {
          result.push(seed.id);
          used.add(seed.id);
          break;
        }
      }
    }
    // Reduce weight of used seeds (so variety increases)
    result.forEach(id => {
      const s = S.taste.seeds.find(x => x.id === id);
      if (s) s.weight = Math.max(1, s.weight - 2);
    });
    return result;
  }
};

// ─── GEMINI ENGINE ────────────────────────────────────────────────
const GeminiEngine = {
  async getClusterArtists(seedTrack) {
    if (!seedTrack || !seedTrack.t || !seedTrack.a) return [];

    const prompt = `Based on the track '${seedTrack.t}' by '${seedTrack.a}', suggest exactly 5 different, rare, and highly affine artists that have a very similar vibe (e.g., obscure soul, rare groove, spiritual jazz, or whatever genre this belongs to).
Do not suggest mainstream artists.
Format the output EXACTLY as a JSON array of strings containing ONLY the artist names.
Example:
[
  "Artist Name 1",
  "Artist Name 2"
]
Output ONLY valid JSON, without any markdown formatting or introductory text.`;

    try {
      const resp = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!resp.ok) return [];
      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

      const parsed = JSON.parse(text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim());
      if (!Array.isArray(parsed)) return [];

      return parsed.slice(0, 5);
    } catch (e) {
      console.error("GeminiEngine Error:", e);
      return [];
    }
  }
};

// ─── RECOMMENDATION QUEUE MANAGER ────────────────────────────────
const Queue = {
  async refill(forceSeedId = null) {
    if (S.isFetching) return;
    S.isFetching = true;
    try {
      const isPreset = S.activePreset !== 'general';
      
      // Use NEW algorithm for preset modes (Discogs → EveryNoise → Monochrome)
      if (isPreset) {
        updateSeedInfo(`Ricerca con nuovo algoritmo: ${S.activePreset}...`);
        const presetTracks = await NewDiscoveryEngine.getTracks(S.activePreset, QUEUE_TARGET);
        
        // Filter out seen/liked tracks
        let merged = presetTracks.filter(t => !hasSeen(t) && !isLiked(t));
        
        if (merged.length === 0) {
          showDiscoverEmpty();
          return;
        }
        
        // Add to queue
        S.queue.push(...merged);
        updateQueueCounter();
        showDiscoverCards();
        S.isFetching = false;
        return;
      }

      // Original algorithm for general mode
      updateSeedInfo(forceSeedId && S.sessionSeedTrack
        ? `Basato su: ${S.sessionSeedTrack.t}`
        : 'Nuove scoperte simili ai tuoi gusti');

      const queueNeeds = QUEUE_TARGET - S.queue.length;
      if (queueNeeds <= 0) return;

      const pool = S.myLiked.length > 0 ? S.myLiked : CATALOG;
      const seedTrack = randPick(pool, 1);
      const forceSeedName = (forceSeedId && S.sessionSeedTrack) ? S.sessionSeedTrack : seedTrack;
      let forceSeedTrack = Array.isArray(forceSeedName) ? forceSeedName[0] : forceSeedName;

      updateSeedInfo(`Analizzando cluster a partire da: ${forceSeedTrack.t} - ${forceSeedTrack.a}...`);

      const baseArtists = await GeminiEngine.getClusterArtists(forceSeedTrack);

      let merged = [];
      if (baseArtists && baseArtists.length > 0) {
        updateSeedInfo(`Espansione grappolo Last.fm in corso...`);
        const clusterTracks = await SimilarArtistEngine.buildClusterQueue(baseArtists, queueNeeds);

        // Strict Catalog Filter: completely exclude any track that exists in the spreadsheet
        merged = clusterTracks.filter(ct => {
          const match = CATALOG.some(c => c.t.toLowerCase().trim() === ct.t.toLowerCase().trim() && c.a.toLowerCase().trim() === ct.a.toLowerCase().trim());
          return !match;
        });
      }

      // Catalog fallback only if cluster fails completely
      if (merged.length === 0) {
        let candidates = CATALOG.filter(t => !hasSeen(t) && !isLiked(t));
        if (candidates.length > 0) {
          const fallback = randPick(candidates, Math.min(15, queueNeeds));
          const arr = Array.isArray(fallback) ? fallback : [fallback];
          for (const t of arr) {
            if (!t.tidalId) {
              await sleep(150);
              const found = await API.search(t.t, t.isrc);
              if (found && _tidalMatchOk(t.a, t.t, found)) {
                t.tidalId = found.id;
                t.art = t.art || tidalCover(found.album?.cover);
                t.d = t.d || (found.duration || 0) * 1000;
                t.al = t.al || found.album?.title;
              }
            }
          }
          merged = arr.map(t => ({ ...t, _src: 'catalog' })).filter(t => t && t.tidalId && !hasSeen(t) && !isLiked(t));
        }
      }

      if (merged.length === 0) {
        showDiscoverEmpty();
        return;
      }

      // Feature extraction (MusicBrainz / Gemini styles)
      const recentVecsG = S.queue.slice(0, 5).map(t => FeatureVec.build(t));
      const scored = merged.map(t => ({
        t,
        sc: Scorer.score(t, { recentVecs: recentVecsG })
      }));

      // Sort by score
      scored.sort((a, b) => (b.sc.total - a.sc.total) + (Math.random() - 0.5) * 0.05);

      // Take top 30 candidates to re-rank for diversity
      const topCandidates = scored.slice(0, 30);
      const reranked = mmrRerank(topCandidates, Math.min(15, queueNeeds));
      const finalTracks = reranked.map(r => r.t);

      // Record artist cooldown so we don't spam the same artist
      for (const t of finalTracks) {
        const ak2 = (t.a || '').toLowerCase().trim();
        if (ak2) S.artistCooldown[ak2] = Date.now();
      }

      // Add to queue
      S.queue.push(...finalTracks);
      updateQueueCounter();
      showDiscoverCards();
    } finally {
      S.isFetching = false;
    }
  },

  async _catalogSeeds(count) {
    const pool = CATALOG;
    return randPick(pool.length > 0 ? pool : CATALOG, Math.min(count * 2, 10)).filter(t => t.sid).map(t => `s:${t.sid}`);
  },

  async _likedSeeds(count) {
    const pool = S.myLiked.length >= 5 ? S.myLiked : [...S.myLiked, ...CATALOG];
    const picks = randPick(pool, Math.min(count * 3, 18));
    const arr = Array.isArray(picks) ? picks : [picks];
    return arr.map(t => trackId(t));
  },

  async _getTidalId(t) {
    if (t.sid) return `s:${t.sid}`;
    return null;
  }
};

// ─── AUDIO PLAYER ─────────────────────────────────────────────────
const Player = {
  init() {
    const a = S.audio;
    a.volume = S.volume;
    a.addEventListener('timeupdate', () => this._onTime());
    a.addEventListener('ended', () => this._onEnded());
    a.addEventListener('play', () => this._onStateChange(true));
    a.addEventListener('pause', () => this._onStateChange(false));
    a.addEventListener('error', () => this._onError());
    a.addEventListener('canplay', () => { if (S.isPlaying) a.play().catch(() => { }); });
    initMediaSessionHandlers();
  },

  async play(track) {
    S.listenStart = Date.now();
    S.playerTrack = track;
    S.isPreview = false;
    updatePlayerBar(track);
    updateFullPlayer(track);
    showPlayerBar();

    let url = null;

    // Try Tidal stream at preferred quality, fall back down the chain
    if (track.tidalId) {
      const q = S.streamQuality || 'HIGH';
      url = await API.getStreamUrl(track.tidalId, q);
      // Fallback chain: LOSSLESS → HIGH → LOW
      if (!url && q === 'LOSSLESS') url = await API.getStreamUrl(track.tidalId, 'HIGH');
      if (!url) url = await API.getStreamUrl(track.tidalId, 'LOW');
    }

    // Fallback to Spotify preview
    if (!url && track.pre) {
      url = track.pre;
      S.isPreview = true;
    }

    if (!url) {
      toast('Nessun audio disponibile per questo brano', 'skip');
      return;
    }

    // If the URL requires a CORS fetch, just try setting src
    S.audio.src = url;
    S.isPlaying = true;
    try {
      await S.audio.play();
    } catch (e) {
      // If CORS on stream URL, fall back to preview
      if (track.pre && url !== track.pre) {
        S.audio.src = track.pre;
        S.isPreview = true;
        try { await S.audio.play(); } catch (_) { }
      }
    }

    updatePlayerIsPreview();
    updatePlayPauseIcons();
    updateLikeBtn();
    updateMediaSession(track);
    // Notify scrobbling services of now-playing
    LBEngine.nowPlaying(track);
    LastFMEngine.nowPlaying(track);

    // Load lyrics if tidal and full player open
    if (S.fullPlayerOpen && track.tidalId) {
      loadLyrics(track.tidalId);
    }
  },

  togglePlay() {
    if (!S.playerTrack) return;
    if (S.audio.paused) {
      S.audio.play().catch(() => { });
      S.isPlaying = true;
    } else {
      S.audio.pause();
      S.isPlaying = false;
    }
    updatePlayPauseIcons();
  },

  next() {
    if (S.repeat === 'one') {
      S.audio.currentTime = 0;
      S.audio.play().catch(() => { });
      return;
    }
    const nextIdx = this._nextIdx();
    if (nextIdx !== null) {
      S.playerIdx = nextIdx;
      this.play(S.playerQueue[S.playerIdx]);
    }
  },

  prev() {
    if (S.audio.currentTime > 3) {
      S.audio.currentTime = 0;
      return;
    }
    const prevIdx = this._prevIdx();
    if (prevIdx !== null) {
      S.playerIdx = prevIdx;
      this.play(S.playerQueue[S.playerIdx]);
    }
  },

  seek(ratio) {
    if (!S.audio.duration) return;
    S.audio.currentTime = ratio * S.audio.duration;
  },

  setVolume(v) {
    S.volume = v;
    S.audio.volume = v;
    saveState();
  },

  setQueue(tracks, startIdx = 0) {
    S.playerQueue = tracks;
    S.playerIdx = startIdx;
    this.play(tracks[startIdx]);
    updateQueuePanel();
  },

  _nextIdx() {
    if (S.playerQueue.length === 0) return null;
    if (S.shuffle) return Math.floor(Math.random() * S.playerQueue.length);
    const n = S.playerIdx + 1;
    if (n >= S.playerQueue.length) {
      return S.repeat === 'all' ? 0 : null;
    }
    return n;
  },

  _prevIdx() {
    if (S.playerQueue.length === 0) return null;
    const n = S.playerIdx - 1;
    if (n < 0) return S.repeat === 'all' ? S.playerQueue.length - 1 : 0;
    return n;
  },

  _onTime() {
    const cur = S.audio.currentTime;
    const dur = S.audio.duration || 0;
    const ratio = dur ? cur / dur : 0;
    updateProgressUI(ratio, cur, dur);
    updateCardProgress(ratio);
  },

  _onEnded() {
    // Full listen = strong implicit like
    _checkListenSignal(S.playerTrack, true);
    if (S.repeat === 'one') {
      S.audio.currentTime = 0;
      S.audio.play().catch(() => { });
    } else {
      this.next();
    }
  },

  _onStateChange(playing) {
    S.isPlaying = playing;
    updatePlayPauseIcons();
    const ind = $('playing-indicator');
    if (ind) ind.classList.toggle('visible', playing);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    }
  },

  _onError() {
    const t = S.playerTrack;
    if (t && t.pre && S.audio.src !== t.pre) {
      S.audio.src = t.pre;
      S.isPreview = true;
      S.audio.play().catch(() => { });
      updatePlayerIsPreview();
    }
  }
};

// ─── CARD SWIPER ──────────────────────────────────────────────────
class CardSwiper {
  constructor(el, onLike, onSkip) {
    this.el = el;
    this.onLike = onLike;
    this.onSkip = onSkip;
    this.startX = 0;
    this.startY = 0;
    this.dx = 0;
    this.dragging = false;
    this.gone = false;
    this.threshold = 80;

    this._bindEvents();
  }

  _bindEvents() {
    this.el.addEventListener('mousedown', e => this._start(e.clientX, e.clientY));
    this.el.addEventListener('touchstart', e => this._start(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    document.addEventListener('mousemove', e => this._move(e.clientX, e.clientY));
    document.addEventListener('touchmove', e => this._move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    document.addEventListener('mouseup', e => this._end(e.clientX));
    document.addEventListener('touchend', e => this._end(e.changedTouches[0].clientX));
  }

  _start(x, y) {
    if (this.gone) return;
    this.startX = x;
    this.startY = y;
    this.dragging = true;
    this.el.classList.add('dragging');
  }

  _move(x, y) {
    if (!this.dragging || this.gone) return;
    this.dx = x - this.startX;
    const dy = (y - this.startY) * 0.25;
    const rot = this.dx * 0.07;
    this.el.style.transform = `translate(${this.dx}px, ${dy}px) rotate(${rot}deg)`;

    // Update indicators
    const ratio = Math.min(Math.abs(this.dx) / 100, 1);
    const likeEl = this.el.querySelector('.card-indicator.like');
    const skipEl = this.el.querySelector('.card-indicator.skip');
    if (this.dx > 15) {
      if (likeEl) likeEl.style.opacity = ratio;
      if (skipEl) skipEl.style.opacity = 0;
    } else if (this.dx < -15) {
      if (skipEl) skipEl.style.opacity = ratio;
      if (likeEl) likeEl.style.opacity = 0;
    } else {
      if (likeEl) likeEl.style.opacity = 0;
      if (skipEl) skipEl.style.opacity = 0;
    }
  }

  _end(x) {
    if (!this.dragging || this.gone) return;
    this.dragging = false;
    this.el.classList.remove('dragging');
    this.el.style.transition = '';

    const finalDx = x - this.startX;
    if (finalDx > this.threshold) {
      this._throw('right');
    } else if (finalDx < -this.threshold) {
      this._throw('left');
    } else {
      // Snap back
      this.el.style.transform = '';
      const likeEl = this.el.querySelector('.card-indicator.like');
      const skipEl = this.el.querySelector('.card-indicator.skip');
      if (likeEl) likeEl.style.opacity = 0;
      if (skipEl) skipEl.style.opacity = 0;
    }
  }

  _throw(direction) {
    if (this.gone) return;
    this.gone = true;
    const x = direction === 'right' ? '140vw' : '-140vw';
    const rot = direction === 'right' ? '30deg' : '-30deg';
    this.el.style.transition = 'transform 0.45s cubic-bezier(0.55, 0.055, 0.675, 0.19), opacity 0.45s ease';
    this.el.style.transform = `translate(${x}, -10px) rotate(${rot})`;
    this.el.style.opacity = '0';
    setTimeout(() => {
      if (direction === 'right') this.onLike();
      else this.onSkip();
    }, 350);
  }

  programmaticSwipe(direction) {
    this._throw(direction);
  }
}

// ─── UI HELPERS ───────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function $$(sel) { return document.querySelectorAll(sel); }

function toast(msg, type = 'default') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function showView(name) {
  S.view = name;
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.nav-btn').forEach(b => b.classList.remove('active'));
  const view = $(`view-${name}`);
  if (view) view.classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-view="${name}"]`);
  if (btn) btn.classList.add('active');

  if (name === 'library') renderLibrary();
  if (name === 'playlists') renderPlaylists();
}

// ─── DISCOVER UI ──────────────────────────────────────────────────
function showDiscoverLoading() {
  $('discover-loading').style.display = 'flex';
  $('card-stack').style.display = 'none';
  $('card-actions').style.display = 'none';
  $('discover-empty').style.display = 'none';
}

function showDiscoverCards() {
  $('discover-loading').style.display = 'none';
  $('discover-empty').style.display = 'none';
  if (S.queue.length === 0) {
    showDiscoverEmpty();
    return;
  }
  $('card-stack').style.display = '';
  $('card-actions').style.display = 'flex';
  renderCardStack();
}

function showDiscoverEmpty() {
  // Never show the empty screen — forget older seen tracks and auto-refill
  if (!S.isFetching) {
    // Drop the oldest 80% of seenIds so tracks can resurface
    const arr = [...S.seenIds];
    S.seenIds = new Set(arr.slice(Math.floor(arr.length * 0.8)));
    showDiscoverLoading();
    Queue.refill();
    return;
  }
  // Still fetching: just show loading
  showDiscoverLoading();
}

function updateSeedInfo(text) {
  S.seedInfo = text;
  $('seed-info').textContent = text;
}

function updateQueueCounter() {
  const el = $('queue-counter');
  if (el) el.textContent = S.queue.length > 0 ? `${S.queue.length} brani in coda` : '';
}

function renderCardStack() {
  const stack = $('card-stack');
  stack.innerHTML = '';
  const visible = S.queue.slice(0, 3);
  // Render back to front (3rd card first)
  [...visible].reverse().forEach((track, revIdx) => {
    const idx = (visible.length - 1) - revIdx;
    const card = createCard(track, idx);
    stack.appendChild(card);
  });
  // Update current card ref
  const prev = S.currentCardTrack;
  S.currentCardTrack = visible[0] || null;
  updateQueueCounter();

  // Reset two-stage like state when card changes
  if (S.currentCardTrack !== prev) {
    S.currentCardLiked = false;
    updateCardLikeBtnState();
  }

  // Auto-play the top card when it appears
  if (S.currentCardTrack && S.currentCardTrack !== prev) {
    Player.setQueue([S.currentCardTrack, ...S.queue.slice(1)], 0);
  }

  // Proactive background fill: keep buffer topped up without waiting for it to run low
  if (!S.isFetching && S.queue.length < QUEUE_TARGET) Queue.refill();
}

function createCard(track, stackPos) {
  const div = document.createElement('div');
  div.className = `card card-${stackPos + 1}`;
  div.dataset.tidalId = track.tidalId || '';
  div.dataset.sid = track.sid || '';

  const art = track.art || '';
  const year = track.y ? `${track.y}` : '';
  const bpm = track.bpm ? `${Math.round(track.bpm)} BPM` : '';
  const preview = track.pre ? '30s' : '';

  div.innerHTML = `
    ${art
      ? `<img class="card-art" src="${art}" alt="" onerror="this.style.display='none'">`
      : `<div class="card-art-placeholder">🎵</div>`
    }
    <div class="card-gradient"></div>
    <div class="card-indicator like">LIKE</div>
    <div class="card-indicator skip">SKIP</div>
    ${stackPos === 0 ? `
    <button class="card-play-overlay" id="card-play-btn" title="Ascolta preview">
      <svg viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
    </button>` : ''}
    <div class="card-info">
      <div class="card-tags">
        ${year ? `<span class="card-tag">${year}</span>` : ''}
        ${bpm ? `<span class="card-tag">${bpm}</span>` : ''}
        ${preview ? `<span class="card-tag">Preview ${preview}</span>` : ''}
      </div>
      <div class="card-title">${escHtml(track.t)}</div>
      <div class="card-artist">${escHtml(track.a)}${track.al ? ` · ${escHtml(track.al)}` : ''}</div>
      <div class="card-progress-bar" id="card-progress-bar">
        <div class="card-progress-fill" id="card-progress-fill"></div>
      </div>
    </div>
  `;

  if (stackPos === 0) {
    const swiper = new CardSwiper(div,
      () => handleSwipeLike(track),
      () => handleSkip(track)
    );
    div._swiper = swiper; // store for programmatic swipes

    // Card play button (preview)
    const playBtn = div.querySelector('#card-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playCardPreview(track, playBtn);
      });
    }
  }

  return div;
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function updateCardProgress(ratio) {
  const bar = $('card-progress-bar');
  const fill = $('card-progress-fill');
  if (bar && fill) {
    bar.classList.toggle('visible', ratio > 0 && ratio < 1);
    fill.style.width = `${Math.round(ratio * 100)}%`;
  }
}

function playCardPreview(track, btn) {
  if (!track.pre && !track.tidalId) {
    toast('Nessun audio disponibile', 'skip');
    return;
  }
  // Queue just this track and play
  Player.setQueue([track], 0);
  // Toggle the button state
  const isNowPlaying = !S.audio.paused && S.playerTrack?.t === track.t;
  btn.classList.toggle('playing', !isNowPlaying);
  const bar = $('card-progress-bar');
  if (bar) bar.classList.add('visible');
}

// ─── LIKE / SKIP HANDLERS ─────────────────────────────────────────

// ── Implicit listen signal ─────────────────────────────────────────
// Called before every card advance (like / skip / swipe).
// fullListen = track ended naturally (strongest signal).
function _checkListenSignal(track, fullListen = false) {
  if (!track || !S.listenStart) return;
  const secs = (Date.now() - S.listenStart) / 1000;
  S.listenStart = 0;
  if (fullListen || secs >= LISTEN_LONG_SEC) {
    UserProfile.update(track, 'listen_long');
    // Scrobble: listened long enough (>= 30s or full track)
    if (secs >= 30 || fullListen) {
      LBEngine.submitListen(track, S.listenStart || (Date.now() - secs * 1000));
      LastFMEngine.scrobble(track, S.listenStart || (Date.now() - secs * 1000));
    }
    saveState();
  } else if (secs > 1 && secs < LISTEN_SKIP_SEC) {
    UserProfile.update(track, 'skip_fast');
    // Plan E: accumulate dislike vector from skipped tracks
    const dv = FeatureVec.build(track);
    for (const k in dv) S.dislikeVec[k] = (S.dislikeVec[k] || 0) + dv[k];
    S.dislikeTotal = (S.dislikeTotal || 0) + 1;
    // Remove from frontier so skipped tracks don't seed constellation chains
    S.frontierTracks = S.frontierTracks.filter(
      f => f.tidalId !== track.tidalId && f.isrc !== track.isrc
    );
    saveState();
  }
}

// Two-stage like: first press = like + stay, second press = advance.
// Swipe-right uses _advanceLike() which does both in one step.
function handleLike(track) {
  if (!S.currentCardLiked) {
    // ── FIRST PRESS: add to library, stay on card ──────────────────
    if (!isLiked(track)) {
      S.myLiked.push({ ...track, likedAt: Date.now() });
      Taste.recordLike(track);
      UserProfile.update(track, 'like');
      // Enrich immediately in background so profile has tag features on next update
      EnrichEngine.getFeatures(track.a || '', track.t || '').then(feats => {
        if (feats?.tags?.length) { UserProfile.seedFromLiked(); saveState(); }
      }).catch(() => { });
      SpotifyEngine.buildProfile();
      if (track.source === 'discogs' || track.source === 'everynoise') NewDiscoveryEngine.recordLike(S.activePreset);
      saveState();
      updateSidebarStats();
    }
    S.currentCardLiked = true;
    updateCardLikeBtnState();
    toast('❤️  Salvato — premi ancora per avanzare', 'like');
    if (S.queue.length < QUEUE_TARGET) Queue.refill();
  } else {
    // ── SECOND PRESS: advance to next card ────────────────────────
    _advanceLike(track);
  }
}

// Swipe-right: like + advance immediately (one gesture = decisive action)
function handleSwipeLike(track) {
  _checkListenSignal(track);
  if (!isLiked(track)) {
    S.myLiked.push({ ...track, likedAt: Date.now() });
    Taste.recordLike(track);
    UserProfile.update(track, 'swipe_like');
    EnrichEngine.getFeatures(track.a || '', track.t || '').then(feats => {
      if (feats?.tags?.length) { UserProfile.seedFromLiked(); saveState(); }
    }).catch(() => { });
    SpotifyEngine.buildProfile();
    if (track.source === 'discogs' || track.source === 'everynoise') NewDiscoveryEngine.recordLike(S.activePreset);
    saveState();
    updateSidebarStats();
    toast('❤️  Aggiunto alla libreria', 'like');
  }
  _advanceLike(track);
}

function _advanceLike(track) {
  _checkListenSignal(track);
  S.lastSkipped = null; updateUndoBtn();
  S.currentCardLiked = false;
  markSeen(track);
  S.queue.shift();
  advanceQueue();
  const isPreset = PRESETS[S.activePreset]?.seeds;
  if (!isPreset && track.tidalId && S.queue.length < QUEUE_TARGET) Queue.refill(track.tidalId);
  else if (S.queue.length < QUEUE_REFILL_AT) Queue.refill();
}

function updateCardLikeBtnState() {
  const btn = $('btn-like');
  if (!btn) return;
  btn.classList.toggle('liked', S.currentCardLiked);
  const svg = btn.querySelector('svg');
  if (svg) svg.setAttribute('fill', S.currentCardLiked ? 'currentColor' : 'none');
}

function handleSkip(track) {
  _checkListenSignal(track);
  S.lastSkipped = track;
  Taste.recordSkip(track);
  UserProfile.update(track, 'dislike');
  if (track.source === 'discogs' || track.source === 'everynoise') NewDiscoveryEngine.recordSkip(S.activePreset);
  saveState();
  markSeen(track);
  S.queue.shift();

  toast(`✕  Saltato`, 'skip');
  updateUndoBtn();
  advanceQueue();

  if (S.queue.length < QUEUE_REFILL_AT) Queue.refill();
}

function handleUndo() {
  const track = S.lastSkipped;
  if (!track) return;
  S.lastSkipped = null;

  // Reverse taste skip counters
  const a = (track.a || '').toLowerCase().replace(/\s*\(\d+\)$/, '').trim();
  if (S.taste.artists[a]) S.taste.artists[a].skipped = Math.max(0, (S.taste.artists[a].skipped || 1) - 1);
  const decade = Math.floor(parseInt(track.y || 2000) / 10) * 10;
  if (S.taste.decades[decade]) S.taste.decades[decade].skipped = Math.max(0, (S.taste.decades[decade].skipped || 1) - 1);

  // Remove from seenIds so the card can reappear
  if (track.tidalId) S.seenIds.delete(`t:${track.tidalId}`);
  if (track.sid) S.seenIds.delete(`s:${track.sid}`);
  if (track.isrc) S.seenIds.delete(`i:${track.isrc}`);

  // Put back at the front of the queue
  S.queue.unshift(track);

  updateUndoBtn();
  showDiscoverCards();
  toast('↩ Recuperato', 'info');
}

function updateUndoBtn() {
  const btn = $('btn-undo');
  if (!btn) return;
  btn.disabled = !S.lastSkipped;
}

function handleListenNow(track) {
  if (!isLiked(track)) {
    S.myLiked.push({ ...track, likedAt: Date.now() });
    saveState();
  }
  Taste.recordLike(track);
  markSeen(track);
  S.queue.shift();

  updateSidebarStats();

  // Build queue with liked songs for continuous playback
  const queue = [track, ...S.myLiked.slice(-30).reverse()];
  Player.setQueue(queue, 0);

  advanceQueue();
  if (S.queue.length < QUEUE_REFILL_AT) Queue.refill();
}

function advanceQueue() {
  if (S.queue.length === 0) {
    showDiscoverEmpty();
  } else {
    renderCardStack();
    showDiscoverCards();
  }
}

// ─── MEDIA SESSION (lock screen widget) ───────────────────────────
function updateMediaSession(track) {
  if (!('mediaSession' in navigator) || !track) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.t || '',
    artist: track.a || '',
    album: track.al || '',
    artwork: track.art ? [
      { src: track.art, sizes: '640x640', type: 'image/jpeg' }
    ] : []
  });
}

function initMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.setActionHandler('play', () => { S.audio.play().catch(() => { }); });
  navigator.mediaSession.setActionHandler('pause', () => { S.audio.pause(); });
  navigator.mediaSession.setActionHandler('nexttrack', () => Player.next());
  navigator.mediaSession.setActionHandler('previoustrack', () => Player.prev());
  navigator.mediaSession.setActionHandler('seekto', e => {
    if (e.seekTime != null) S.audio.currentTime = e.seekTime;
  });
}

// ─── PLAYER UI ────────────────────────────────────────────────────
function showPlayerBar() {
  $('player-bar').classList.remove('hidden');
}

function updatePlayerBar(track) {
  if (!track) return;
  const art = $('player-art');
  art.src = track.art || '';
  art.onerror = () => art.style.display = 'none';
  $('player-title').textContent = track.t;
  $('player-artist').textContent = track.a;
  updateLikeBtn();
}

function updatePlayerIsPreview() {
  const titleEl = $('player-title');
  // Remove old badge
  titleEl.querySelectorAll('.player-preview-badge').forEach(b => b.remove());
  if (S.isPreview) {
    const badge = document.createElement('span');
    badge.className = 'player-preview-badge';
    badge.textContent = '30s';
    titleEl.appendChild(badge);
  }
}

function updateLikeBtn() {
  const t = S.playerTrack;
  const liked = t && isLiked(t);
  const mini = $('player-like-btn');
  const full = $('full-like-btn');
  if (mini) {
    mini.classList.toggle('liked', liked);
    const svg = mini.querySelector('svg');
    if (svg) svg.setAttribute('fill', liked ? 'currentColor' : 'none');
  }
  if (full) {
    full.classList.toggle('liked', liked);
    const svg = full.querySelector('svg');
    if (svg) svg.setAttribute('fill', liked ? 'currentColor' : 'none');
  }
}

function updateFullPlayer(track) {
  if (!track) return;
  $('full-art').src = track.art || '';
  $('full-art').onerror = () => $('full-art').style.display = 'none';
  $('full-title').textContent = track.t;
  $('full-artist').textContent = track.a;
  $('full-album').textContent = track.al || '';
  $('full-source').textContent = S.isPreview ? 'Anteprima 30 secondi' : 'Riproduzione in corso';
  updateLikeBtn();
}

function updatePlayPauseIcons() {
  const playing = S.isPlaying && !S.audio.paused;
  // Mini
  $('icon-play').style.display = playing ? 'none' : '';
  $('icon-pause').style.display = playing ? '' : 'none';
  // Full
  $('full-icon-play').style.display = playing ? 'none' : '';
  $('full-icon-pause').style.display = playing ? '' : 'none';
}

function updateProgressUI(ratio, cur, dur) {
  const pct = `${ratio * 100}%`;
  // Mini player
  const pf = $('progress-fill');
  if (pf) pf.style.width = pct;
  const pt = document.querySelector('#progress-track .progress-thumb');
  if (pt) pt.style.left = `calc(${pct} - 6px)`;
  if ($('time-current')) $('time-current').textContent = fmtTime(cur);
  if ($('time-total')) $('time-total').textContent = fmtTime(dur);
  // Full player
  const ff = $('full-seek-fill');
  const ft = $('full-seek-thumb');
  if (ff) ff.style.width = pct;
  if (ft) ft.style.left = `calc(${pct} - 7px)`;
  if ($('full-time-current')) $('full-time-current').textContent = fmtTime(cur);
  if ($('full-time-total')) $('full-time-total').textContent = fmtTime(dur);
}

function updateShuffleRepeatBtns() {
  $$('#btn-shuffle, #full-shuffle').forEach(b => b.classList.toggle('active', S.shuffle));
  $$('#btn-repeat, #full-repeat').forEach(b => {
    b.classList.toggle('active', S.repeat !== 'none');
    const title = S.repeat === 'one' ? '🔂 Ripeti 1' : S.repeat === 'all' ? '🔁 Ripeti tutto' : '🔁 Ripeti';
    b.title = title;
  });
}

function updateSidebarStats() {
  const count = $('sidebar-like-count');
  if (count) count.textContent = S.myLiked.length + CATALOG.length;
}


// ─── SETTINGS HELPERS ────────────────────────────────────────────
function setSettingsStatus(service, ok, msg) {
  const el = $(service + '-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'settings-status ' + (ok ? 'ok' : 'err');
}
function updateSettingsBadges() {
  const lb = $('lb-badge');
  const lfm = $('lfm-badge');
  if (lb) { lb.textContent = S.lbToken ? ('✓ ' + (S.lbUser || 'connesso')) : 'Non connesso'; lb.className = 'settings-badge' + (S.lbToken ? ' connected' : ''); }
  if (lfm) { lfm.textContent = S.lfmSessionKey ? ('✓ ' + (S.lfmUsername || 'connesso')) : 'Non connesso'; lfm.className = 'settings-badge' + (S.lfmSessionKey ? ' connected' : ''); }
}

// ─── COUNTRY PICKER ──────────────────────────────────────────────────────────
function openCountryPicker() {
  renderCountryList('');
  $('country-search').value = '';
  $('country-backdrop').classList.add('open');
  $('country-sheet').classList.add('open');
  setTimeout(() => $('country-search').focus(), 320);
}

function closeCountryPicker() {
  $('country-backdrop').classList.remove('open');
  $('country-sheet').classList.remove('open');
}

function setCountry(val) {
  S.forcedCountry = val || null;
  saveState();
  const label = val ? (COUNTRIES.find(c => c.val === val)?.flag + ' ' + COUNTRIES.find(c => c.val === val)?.name) : 'Tutti';
  $('country-label-btn').textContent = label;
  $('btn-country').classList.toggle('filtered', !!val);
  closeCountryPicker();
  // Clear queue so next refill uses new country
  S.queue = [];
  renderCardStack();
  toast(val ? ('Paese: ' + label) : 'Tutti i paesi');
}

function renderCountryList(query) {
  const list = $('country-list');
  if (!list) return;
  const q = query.trim().toLowerCase();
  const items = q ? COUNTRIES.filter(c => c.name.toLowerCase().includes(q)) : COUNTRIES;

  let html = '';
  if (!q) {
    const allActive = !S.forcedCountry;
    html += `<div class="country-item all-countries${allActive ? ' active' : ''}" data-val="">🌍 Tutti i paesi</div>`;
  }
  items.forEach(c => {
    const active = S.forcedCountry === c.val;
    html += `<div class="country-item${active ? ' active' : ''}" data-val="${c.val}">${c.flag} ${c.name}</div>`;
  });
  list.innerHTML = html;
}

// ─── FULL PLAYER ──────────────────────────────────────────────────
function updateQualityPicker() {
  $('quality-picker')?.querySelectorAll('.quality-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.q === S.streamQuality);
  });
}

function openFullPlayer() {
  updateQualityPicker();
  S.fullPlayerOpen = true;
  $('player-full').classList.add('open');
  if (S.playerTrack?.tidalId && S.lyricsOpen) {
    loadLyrics(S.playerTrack.tidalId);
  }
  updateQueuePanel();
}

function closeFullPlayer() {
  S.fullPlayerOpen = false;
  $('player-full').classList.remove('open');
}

async function loadLyrics(tidalId) {
  const panel = $('lyrics-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  panel.innerHTML = '<div class="lyrics-loading">Caricamento testi…</div>';
  const data = await API.getLyrics(tidalId);
  if (!data) {
    panel.innerHTML = '<div class="lyrics-loading" style="color:#444">Testi non disponibili</div>';
    return;
  }

  if (data.subtitles) {
    // Synchronized subtitles (SRT format)
    renderSyncedLyrics(panel, data.subtitles);
  } else if (data.lyrics) {
    // Plain lyrics
    panel.innerHTML = data.lyrics.split('\n')
      .map(l => `<div class="lyrics-line">${escHtml(l) || '<br>'}</div>`)
      .join('');
  } else {
    panel.innerHTML = '<div class="lyrics-loading" style="color:#444">Testi non disponibili</div>';
  }
}

function renderSyncedLyrics(panel, subtitles) {
  // Parse SRT-like format: [mm:ss.xxx] lyric
  const lines = subtitles.trim().split('\n');
  const parsed = [];
  for (const line of lines) {
    const m = line.match(/^\[(\d+):(\d+\.\d+)\]\s*(.*)/);
    if (m) {
      const t = parseInt(m[1]) * 60 + parseFloat(m[2]);
      parsed.push({ t, text: m[3] });
    }
  }
  panel.innerHTML = parsed.map((l, i) =>
    `<div class="lyrics-line" data-t="${l.t}" data-idx="${i}">${escHtml(l.text) || '·'}</div>`
  ).join('');

  // Sync to audio
  const syncId = setInterval(() => {
    if (!S.audio || !panel.isConnected) { clearInterval(syncId); return; }
    const cur = S.audio.currentTime;
    let activeIdx = -1;
    for (let i = parsed.length - 1; i >= 0; i--) {
      if (cur >= parsed[i].t) { activeIdx = i; break; }
    }
    panel.querySelectorAll('.lyrics-line').forEach((el, i) => {
      el.classList.toggle('active', i === activeIdx);
    });
    if (activeIdx >= 0) {
      const active = panel.querySelector('.lyrics-line.active');
      if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, 250);

  // Clear sync on track change
  S.audio.addEventListener('ended', () => clearInterval(syncId), { once: true });
}

function updateQueuePanel() {
  const panel = $('queue-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  panel.innerHTML = '';
  if (S.playerQueue.length === 0) {
    panel.innerHTML = '<div style="color:var(--text3);font-size:14px;padding:20px 0">Coda vuota</div>';
    return;
  }
  S.playerQueue.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'queue-item' + (i === S.playerIdx ? ' active' : '');
    div.innerHTML = `
      ${t.art ? `<img src="${t.art}" alt="">` : '<div style="width:40px;height:40px;background:var(--surface3);border-radius:6px;flex-shrink:0"></div>'}
      <div class="queue-item-info">
        <div class="queue-item-title ${i === S.playerIdx ? 'playing' : ''}">${escHtml(t.t)}</div>
        <div class="queue-item-artist">${escHtml(t.a)}</div>
      </div>
    `;
    div.addEventListener('click', () => {
      S.playerIdx = i;
      Player.play(S.playerQueue[i]);
    });
    panel.appendChild(div);
  });
  // Scroll to current
  const active = panel.querySelector('.queue-item.active');
  if (active) active.scrollIntoView({ block: 'center' });
}

// ─── LIBRARY UI ───────────────────────────────────────────────────
function renderLibrary(filter = S.libraryFilter, search = '') {
  const grid = $('library-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Build combined list: catalog (all 791) + discovered liked
  const catalogTracks = CATALOG.map(t => ({ ...t, _source: 'catalog' }));
  const discoveredTracks = S.myLiked
    .filter(t => !t.sid || !CATALOG.some(c => c.sid === t.sid))
    .map(t => ({ ...t, _source: 'discovered' }));

  let all = filter === 'catalog' ? catalogTracks
    : filter === 'discovered' ? discoveredTracks
      : [...catalogTracks, ...discoveredTracks];

  // Search
  if (search.trim()) {
    const q = search.toLowerCase();
    all = all.filter(t =>
      (t.t || '').toLowerCase().includes(q) ||
      (t.a || '').toLowerCase().includes(q) ||
      (t.al || '').toLowerCase().includes(q)
    );
  }

  const count = all.length;
  $('library-count').textContent = `${count.toLocaleString('it-IT')} brani`;

  if (count === 0) {
    grid.innerHTML = '<div style="color:var(--text3);padding:40px;text-align:center;grid-column:1/-1">Nessun brano trovato</div>';
    return;
  }

  all.slice(0, 500).forEach(track => {
    const row = document.createElement('div');
    row.className = 'lib-row';
    row.innerHTML = `
      ${track.art
        ? `<img class="lib-row-art" src="${track.art}" alt="" loading="lazy" onerror="this.style.display='none'">`
        : '<div class="lib-row-art-placeholder">🎵</div>'}
      <div class="lib-row-info">
        <div class="lib-row-title">${escHtml(track.t)}</div>
        <div class="lib-row-meta">${escHtml(track.a)}${track.y ? ' · ' + track.y : ''}</div>
      </div>
      ${track._src === 'discovered' ? '<span class="lib-row-badge">NUOVO</span>' : ''}
      <div class="lib-row-actions">
        <button class="lib-row-btn play" data-action="play">▶ Ascolta</button>
        <button class="lib-row-btn sim"  data-action="session">◈ Simili</button>
      </div>
      <button class="lib-row-btn addpl" data-action="addpl" title="Aggiungi a playlist">＋</button>`;
    row.querySelector('[data-action="play"]').addEventListener('click', e => {
      e.stopPropagation();
      Player.setQueue([track, ...all.filter(t => t !== track)], 0);
      toast(`▶ ${track.t}`, 'info');
    });
    row.querySelector('[data-action="session"]').addEventListener('click', e => {
      e.stopPropagation(); startSessionFrom(track);
    });
    row.querySelector('[data-action="addpl"]').addEventListener('click', e => {
      e.stopPropagation(); showAddToPlaylistModal(track);
    });
    row.addEventListener('click', () => Player.setQueue([track, ...all.filter(t => t !== track)], 0));
    grid.appendChild(row);
  });

  if (all.length > 500) {
    const more = document.createElement('div');
    more.style.cssText = 'text-align:center;color:var(--text3);padding:20px;font-size:13px';
    more.textContent = `Mostrando 500 di ${all.length}. Usa la ricerca per filtrare.`;
    grid.appendChild(more);
  }
}

async function startSessionFrom(track) {
  S.sessionSeedTrack = track;
  showView('discover');
  showDiscoverLoading();
  updateSeedInfo(`Caricamento basato su: ${track.t}…`);
  S.queue = [];

  // Get Tidal ID for this track
  let tidalId = track.tidalId || null;
  if (!tidalId && track.sid && S.tidalCache[track.sid]) {
    tidalId = S.tidalCache[track.sid];
  }
  if (!tidalId) {
    const found = await API.search(track.t, track.isrc);
    if (found) {
      tidalId = found.id;
      if (track.sid) {
        S.tidalCache[track.sid] = tidalId;
        saveState();
      }
    }
  }

  if (!tidalId) {
    toast('Brano non trovato su Tidal, uso gusti generali', 'skip');
    await Queue.refill();
    return;
  }

  // Add this track as high-weight seed
  const existing = S.taste.seeds.find(s => s.id === tidalId);
  if (existing) existing.weight = 20;
  else S.taste.seeds.unshift({ id: tidalId, weight: 20, title: track.t });

  await Queue.refill(tidalId);
}

// ─── PLAYLISTS UI ─────────────────────────────────────────────────
function renderPlaylists() {
  const main = $('playlists-main');
  const detail = $('playlist-detail');
  if (!main) return;
  detail.classList.add('hidden');
  main.style.display = '';

  $('playlists-count').textContent = `${S.playlists.length} playlist`;

  if (S.playlists.length === 0) {
    main.innerHTML = `
      <div class="empty-playlists">
        <div class="empty-icon">🎶</div>
        <h3>Nessuna playlist ancora</h3>
        <p style="font-size:13px;max-width:220px;line-height:1.5">Crea la tua prima playlist dalla libreria o dal player.</p>
      </div>`;
    return;
  }

  main.innerHTML = '';
  S.playlists.forEach(pl => {
    const tracks = getPlaylistTracks(pl);
    const div = document.createElement('div');
    div.className = 'playlist-item';

    const artHtml = (() => {
      const arts = tracks.slice(0, 4).map(t => t.art).filter(Boolean);
      if (arts.length === 0) return '<div class="playlist-art-empty">🎵</div>';
      if (arts.length < 2) return `<img class="playlist-art-single" src="${arts[0]}" alt="">`;
      return `<div class="playlist-art-grid">${arts.map(a => `<img src="${a}" alt="">`).join('')}</div>`;
    })();

    div.innerHTML = `
      ${artHtml}
      <div class="playlist-info">
        <div class="playlist-name">${escHtml(pl.name)}</div>
        <div class="playlist-meta">${tracks.length} brani</div>
      </div>
      <div class="playlist-actions">
        <button class="pl-btn" data-action="play" title="Riproduci">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        </button>
        <button class="pl-btn" data-action="delete" title="Elimina">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    `;

    div.querySelector('[data-action="play"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (tracks.length > 0) {
        Player.setQueue(tracks, 0);
        toast(`▶ ${pl.name}`, 'info');
      }
    });

    div.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Eliminare la playlist "${pl.name}"?`)) {
        S.playlists = S.playlists.filter(p => p.id !== pl.id);
        saveState();
        renderPlaylists();
      }
    });

    div.addEventListener('click', () => openPlaylistDetail(pl));
    main.appendChild(div);
  });
}

function openPlaylistDetail(pl) {
  S.openPlaylistId = pl.id;
  const detail = $('playlist-detail');
  const main = $('playlists-main');
  detail.classList.remove('hidden');
  main.style.display = 'none';

  $('detail-playlist-name').textContent = pl.name;
  const tracks = getPlaylistTracks(pl);
  $('detail-playlist-meta').textContent = `${tracks.length} brani`;

  const list = $('playlist-tracks-list');
  list.innerHTML = '';

  if (tracks.length === 0) {
    list.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center">Nessun brano in questa playlist</div>';
  } else {
    tracks.forEach((t, i) => {
      const item = document.createElement('div');
      item.className = 'track-item';
      item.innerHTML = `
        <div class="track-item-num">${i + 1}</div>
        ${t.art ? `<img src="${t.art}" alt="">` : '<div style="width:42px;height:42px;background:var(--surface3);border-radius:6px;flex-shrink:0"></div>'}
        <div class="track-item-info">
          <div class="track-item-title">${escHtml(t.t)}</div>
          <div class="track-item-artist">${escHtml(t.a)}</div>
        </div>
        <div class="track-item-duration">${fmtTime((t.d || 0) / 1000)}</div>
        <div class="track-item-actions">
          <button class="ti-btn" title="Rimuovi dalla playlist">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      `;
      item.addEventListener('click', (e) => {
        if (e.target.closest('.ti-btn')) {
          pl.trackIds = pl.trackIds.filter(id => id !== getTrackId(t));
          saveState();
          openPlaylistDetail(pl);
          return;
        }
        Player.setQueue(tracks, i);
      });
      list.appendChild(item);
    });
  }

  $('btn-play-playlist').onclick = () => {
    if (tracks.length > 0) Player.setQueue(tracks, 0);
  };
}

function getPlaylistTracks(pl) {
  const allTracks = [...CATALOG, ...S.myLiked];
  return pl.trackIds.map(id => {
    return allTracks.find(t => getTrackId(t) === id);
  }).filter(Boolean);
}

function getTrackId(t) {
  return t.sid || t.tidalId?.toString() || t.isrc || t.t;
}

function createPlaylist(name) {
  const pl = {
    id: `pl_${Date.now()}`,
    name,
    trackIds: [],
    createdAt: Date.now()
  };
  S.playlists.push(pl);
  saveState();
  return pl;
}

function addTrackToPlaylist(plId, track) {
  const pl = S.playlists.find(p => p.id === plId);
  if (!pl) return;
  const id = getTrackId(track);
  if (!pl.trackIds.includes(id)) {
    pl.trackIds.push(id);
    saveState();
    toast(`Aggiunto a ${pl.name}`, 'info');
  }
}

// ─── MODALS ───────────────────────────────────────────────────────
function showModal(html, onClose) {
  const modal = $('modal');
  modal.innerHTML = html;
  $('modal-overlay').classList.remove('hidden');
  $('modal-overlay').onclick = (e) => {
    if (e.target === $('modal-overlay')) closeModal(onClose);
  };
}

function closeModal(cb) {
  $('modal-overlay').classList.add('hidden');
  if (cb) cb();
}

function showNewPlaylistModal(onCreated) {
  showModal(`
    <div class="modal-title">Nuova playlist</div>
    <div class="modal-section">
      <label>NOME</label>
      <input class="modal-input" id="modal-pl-name" placeholder="La mia playlist" autofocus>
    </div>
    <div class="modal-actions">
      <button class="modal-btn secondary" id="modal-cancel">Annulla</button>
      <button class="modal-btn primary" id="modal-create">Crea</button>
    </div>
  `);
  setTimeout(() => $('modal-pl-name')?.focus(), 50);
  $('modal-cancel').onclick = () => closeModal();
  $('modal-create').onclick = () => {
    const name = $('modal-pl-name')?.value.trim();
    if (!name) return;
    const pl = createPlaylist(name);
    closeModal(() => { if (onCreated) onCreated(pl); });
    renderPlaylists();
  };
  $('modal-pl-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('modal-create').click();
    if (e.key === 'Escape') closeModal();
  });
}

function showAddToPlaylistModal(track) {
  const plItems = S.playlists.length > 0
    ? S.playlists.map(pl => `
        <div class="playlist-select-item" data-plid="${pl.id}">
          <div class="pl-sel-art">🎵</div>
          <div class="pl-sel-name">${escHtml(pl.name)}</div>
        </div>`).join('')
    : '<div style="color:var(--text3);font-size:13px;padding:8px 0">Nessuna playlist. Creane una prima.</div>';

  showModal(`
    <div class="modal-title">Aggiungi a playlist</div>
    <div style="margin-bottom:12px;font-size:13px;color:var(--text2)">${escHtml(track.t)} · ${escHtml(track.a)}</div>
    <div id="modal-pl-list" style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto">${plItems}</div>
    <div class="modal-actions" style="margin-top:16px">
      <button class="modal-btn secondary" id="modal-new-pl">+ Nuova playlist</button>
      <button class="modal-btn secondary" id="modal-cancel">Chiudi</button>
    </div>
  `);
  $('modal-cancel').onclick = () => closeModal();
  $('modal-new-pl').onclick = () => {
    closeModal(() => showNewPlaylistModal((pl) => {
      addTrackToPlaylist(pl.id, track);
    }));
  };
  $$('.playlist-select-item').forEach(el => {
    el.onclick = () => {
      const plId = el.dataset.plid;
      addTrackToPlaylist(plId, track);
      closeModal();
    };
  });
}

// ─── PROGRESS BAR SEEK ────────────────────────────────────────────
function initProgressSeek() {
  const miniTrack = $('progress-track');
  const fullTrack = $('full-seek-track');

  function handleSeek(el, e) {
    const rect = el.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    Player.seek(ratio);
  }

  [miniTrack, fullTrack].forEach(el => {
    if (!el) return;
    let seeking = false;
    el.addEventListener('mousedown', (e) => { seeking = true; handleSeek(el, e); });
    el.addEventListener('touchstart', (e) => { seeking = true; handleSeek(el, e); }, { passive: true });
    document.addEventListener('mousemove', (e) => { if (seeking) handleSeek(el, e); });
    document.addEventListener('touchmove', (e) => { if (seeking) handleSeek(el, e); }, { passive: true });
    document.addEventListener('mouseup', () => { seeking = false; });
    document.addEventListener('touchend', () => { seeking = false; });
  });
}

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (S.view === 'discover' && S.currentCardTrack) {
          playCardPreview(S.currentCardTrack, { classList: { toggle: () => { }, contains: () => false } });
        } else {
          Player.togglePlay();
        }
        break;
      case 'ArrowRight':
        if (S.view === 'discover' && S.queue.length > 0) {
          triggerLike();
        } else {
          e.preventDefault(); Player.next();
        }
        break;
      case 'ArrowLeft':
        if (S.view === 'discover' && S.queue.length > 0) {
          triggerSkip();
        } else {
          e.preventDefault(); Player.prev();
        }
        break;
    }
  });
}

function triggerLike() {
  if (!S.currentCardTrack) return;
  if (S.currentCardLiked) {
    const topCard = $('card-stack')?.querySelector('.card-1');
    if (topCard?._swiper) topCard._swiper.programmaticSwipe('right');
    else _advanceLike(S.currentCardTrack);
  } else {
    handleLike(S.currentCardTrack);
  }
}

function triggerSkip() {
  const topCard = $('card-stack')?.querySelector('.card-1');
  if (topCard && topCard._swiper) {
    topCard._swiper.programmaticSwipe('left');
  } else if (S.currentCardTrack) {
    handleSkip(S.currentCardTrack);
    renderCardStack();
  }
}

// ─── EVENT HANDLERS ───────────────────────────────────────────────
function initEvents() {
  // Sidebar navigation
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  // Preset session buttons
  $$('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.preset;
      if (S.activePreset === id) return;
      S.activePreset = id;
      $$('.preset-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === id));
      S.queue = [];
      S.lastSkipped = null; updateUndoBtn();
      showDiscoverLoading();
      Queue.refill();
    });
  });

  // Discover actions
  $('btn-like').addEventListener('click', () => {
    if (!S.currentCardTrack) return;
    // Always use two-stage handleLike — swipe animation only on physical swipe
    if (S.currentCardLiked) {
      // Second press: animate swipe then advance
      const card = $('card-stack')?.querySelector('.card-1');
      const swiper = card?._swiper;
      if (swiper) swiper.programmaticSwipe('right');
      else _advanceLike(S.currentCardTrack);
    } else {
      handleLike(S.currentCardTrack);
    }
  });
  $('btn-skip').addEventListener('click', () => {
    if (!S.currentCardTrack) return;
    const card = $('card-stack')?.querySelector('.card-1');
    if (card) {
      const swiper = card._swiper;
      if (swiper) swiper.programmaticSwipe('left');
      else handleSkip(S.currentCardTrack);
    }
  });
  $('btn-undo').addEventListener('click', handleUndo);
  $('btn-listen').addEventListener('click', () => {
    if (S.currentCardTrack) handleListenNow(S.currentCardTrack);
  });
  $('btn-reload-queue').addEventListener('click', async () => {
    showDiscoverLoading();
    await Queue.refill();
  });

  // Player bar controls
  $('btn-play-pause').addEventListener('click', () => Player.togglePlay());
  $('btn-prev').addEventListener('click', () => Player.prev());
  $('btn-next').addEventListener('click', () => Player.next());
  $('volume-slider').addEventListener('input', e => {
    Player.setVolume(parseFloat(e.target.value));
    $('full-volume').value = e.target.value;
  });
  $('btn-shuffle').addEventListener('click', () => {
    S.shuffle = !S.shuffle;
    saveState();
    updateShuffleRepeatBtns();
  });
  $('btn-repeat').addEventListener('click', () => {
    S.repeat = S.repeat === 'none' ? 'all' : S.repeat === 'all' ? 'one' : 'none';
    saveState();
    updateShuffleRepeatBtns();
  });
  $('btn-expand-player').addEventListener('click', () => openFullPlayer());
  $('player-like-btn').addEventListener('click', () => toggleLikeCurrentTrack());

  // Full player controls
  $('btn-collapse-player').addEventListener('click', () => closeFullPlayer());

  // Quality picker
  $('quality-picker').addEventListener('click', e => {
    const btn = e.target.closest('.quality-btn');
    if (!btn) return;
    S.streamQuality = btn.dataset.q;
    saveState();
    updateQualityPicker();
    // If a track is already playing, re-stream at new quality immediately
    if (S.playerTrack) Player.play(S.playerTrack);
  });

  // Settings view — ListenBrainz connect
  $('btn-lb-connect').addEventListener('click', async () => {
    const btn = $('btn-lb-connect');
    const username = $('lb-username').value.trim();
    const token = $('lb-token').value.trim();
    if (!username || !token) { setSettingsStatus('lb', false, 'Inserisci username e token'); return; }
    btn.disabled = true; btn.textContent = 'Connessione…';
    const res = await LBEngine.connect(username, token);
    btn.disabled = false; btn.textContent = 'Connetti';
    setSettingsStatus('lb', res.ok, res.msg);
    if (res.ok) { updateSettingsBadges(); LBEngine.loadRecs(); }
  });

  // Settings view — Last.fm connect
  $('btn-lfm-connect').addEventListener('click', async () => {
    const btn = $('btn-lfm-connect');
    const username = $('lfm-username').value.trim();
    const password = $('lfm-password').value.trim();
    btn.disabled = true; btn.textContent = 'Connessione…';
    const res = await LastFMEngine.connect(username, password);
    btn.disabled = false; btn.textContent = 'Connetti';
    $('lfm-password').value = ''; // never keep password in DOM
    setSettingsStatus('lfm', res.ok, res.msg);
    if (res.ok) updateSettingsBadges();
  });

  // Country picker
  $('btn-country').addEventListener('click', openCountryPicker);
  $('country-backdrop').addEventListener('click', closeCountryPicker);
  $('country-search').addEventListener('input', e => renderCountryList(e.target.value));
  $('country-list').addEventListener('click', e => {
    const item = e.target.closest('.country-item');
    if (!item) return;
    setCountry(item.dataset.val);
  });

  $('full-play-pause').addEventListener('click', () => Player.togglePlay());
  $('full-prev').addEventListener('click', () => Player.prev());
  $('full-next').addEventListener('click', () => Player.next());
  $('full-shuffle').addEventListener('click', () => {
    S.shuffle = !S.shuffle; saveState(); updateShuffleRepeatBtns();
  });
  $('full-repeat').addEventListener('click', () => {
    S.repeat = S.repeat === 'none' ? 'all' : S.repeat === 'all' ? 'one' : 'none';
    saveState(); updateShuffleRepeatBtns();
  });
  $('full-volume').addEventListener('input', e => {
    Player.setVolume(parseFloat(e.target.value));
    $('volume-slider').value = e.target.value;
  });
  $('full-like-btn').addEventListener('click', () => toggleLikeCurrentTrack());
  $('full-lyrics-btn').addEventListener('click', () => {
    S.lyricsOpen = !S.lyricsOpen;
    S.queueOpen = false;
    $('lyrics-panel').classList.toggle('hidden', !S.lyricsOpen);
    $('queue-panel').classList.add('hidden');
    $('full-lyrics-btn').classList.toggle('active', S.lyricsOpen);
    $('full-queue-btn').classList.remove('active');
    if (S.lyricsOpen && S.playerTrack?.tidalId) loadLyrics(S.playerTrack.tidalId);
  });
  $('full-queue-btn').addEventListener('click', () => {
    S.queueOpen = !S.queueOpen;
    S.lyricsOpen = false;
    $('queue-panel').classList.toggle('hidden', !S.queueOpen);
    $('lyrics-panel').classList.add('hidden');
    $('full-queue-btn').classList.toggle('active', S.queueOpen);
    $('full-lyrics-btn').classList.remove('active');
    if (S.queueOpen) updateQueuePanel();
  });

  // Full player click area to open
  $('player-title').addEventListener('click', () => openFullPlayer());
  $('player-art').addEventListener('click', () => openFullPlayer());

  // Library — export JSON
  $('btn-export-json').addEventListener('click', () => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tracks: S.myLiked.map(t => ({
        tidalId: t.tidalId || null,
        isrc: t.isrc || null,
        title: t.t,
        artist: t.a,
        album: t.al || null,
        year: t.y || null,
        art: t.art || null,
        duration: t.d || null,
        source: t._src || t.source || 'liked',
        likedAt: t.likedAt || null,
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swerve-library-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`📦 Esportati ${data.tracks.length} brani`, 'like');
  });

  // Library — import JSON
  $('btn-import-json').addEventListener('click', () => $('import-json-input').click());
  $('import-json-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const incoming = Array.isArray(data) ? data : (data.tracks || []);
      if (!incoming.length) { toast('File vuoto o formato non valido', 'skip'); return; }

      // Build dedup key-set from existing library
      const keys = new Set([
        ...S.myLiked.map(t => t.tidalId).filter(Boolean),
        ...S.myLiked.map(t => t.isrc).filter(Boolean),
        ...S.myLiked.map(t => `${t.t}|${t.a}`),
      ]);
      let added = 0;
      for (const t of incoming) {
        const tid = t.tidalId || t.id || null;
        const titleKey = `${t.title || t.t || ''}|${t.artist || t.a || ''}`;
        if (tid && keys.has(tid)) continue;
        if (t.isrc && keys.has(t.isrc)) continue;
        if (keys.has(titleKey)) continue;
        S.myLiked.push({
          tidalId: tid,
          isrc: t.isrc || null,
          t: t.title || t.t || '',
          a: t.artist || t.a || '',
          al: t.album || t.al || '',
          y: t.year || t.y || '',
          art: t.art || null,
          d: t.duration || t.d || 0,
          _src: 'discovered',
          source: t.source || 'imported',
          likedAt: t.likedAt || Date.now(),
        });
        if (tid) keys.add(tid);
        if (t.isrc) keys.add(t.isrc);
        keys.add(titleKey);
        added++;
      }
      saveState();
      updateSidebarStats();
      renderLibrary(S.libraryFilter);
      toast(`✅ Importati ${added} brani (${incoming.length - added} già presenti)`, 'like');
    } catch {
      toast('Errore nel file JSON — controlla il formato', 'skip');
    }
  });

  $('library-search').addEventListener('input', (e) => {
    renderLibrary(S.libraryFilter, e.target.value);
  });
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.libraryFilter = btn.dataset.filter;
      renderLibrary(S.libraryFilter, $('library-search').value);
    });
  });

  // Playlists
  $('btn-new-playlist').addEventListener('click', () => showNewPlaylistModal());
  $('btn-back-playlists').addEventListener('click', () => renderPlaylists());
}

function toggleLikeCurrentTrack() {
  const t = S.playerTrack;
  if (!t) return;
  if (isLiked(t)) {
    S.myLiked = S.myLiked.filter(l => !(l.sid && l.sid === t.sid) && !(l.tidalId && l.tidalId === t.tidalId));
    toast('Rimosso dalla libreria', 'skip');
  } else {
    S.myLiked.push({ ...t, likedAt: Date.now() });
    Taste.recordLike(t);
    toast('❤️ Aggiunto alla libreria', 'like');
  }
  saveState();
  updateLikeBtn();
  updateSidebarStats();
}

// ─── INIT ─────────────────────────────────────────────────────────
async function init() {
  loadState();
  Player.init();
  initEvents();
  initProgressSeek();
  initKeyboard();

  // Set initial volume
  $('volume-slider').value = S.volume;
  $('full-volume').value = S.volume;
  updateShuffleRepeatBtns();
  updateSidebarStats();
  // Restore country label from persisted state
  if (S.forcedCountry) {
    const c = COUNTRIES.find(x => x.val === S.forcedCountry);
    if (c) {
      $('country-label-btn').textContent = c.flag + ' ' + c.name;
      $('btn-country').classList.add('filtered');
    }
  }

  // Seed the taste engine from liked CSV tracks (initial setup)
  if (S.taste.seeds.length === 0 && CATALOG.length > 0) {
    // Pick high-popularity tracks as initial seeds
    const popular = CATALOG.filter(t => t.pop >= 20).sort((a, b) => b.pop - a.pop);
    const picks = popular.slice(0, 30);
    // Find Tidal IDs in background for a few tracks
    seedInitialTaste(picks);

    // Initial pass: populate base artists globally in Taste Engine 
    // so recommendations immediately know user's preferred artists without explicit "likes"
    for (const t of CATALOG) {
      const a = (t.a || '').toLowerCase().trim();
      if (a) {
        S.taste.artists[a] = S.taste.artists[a] || { liked: 0, skipped: 0 };
        // Weight initial catalog tracks lightly to set a base
        S.taste.artists[a].liked++;
      }
    }
    saveState();
  }

  // Seed user profile from already-enriched liked tracks (fast, sync)
  UserProfile.seedFromLiked();
  if (S.profileTotal < 5 && CATALOG.length > 0) {
    CATALOG.slice(0, 100).forEach(t => {
      const k = `${(t.a || '').toLowerCase().trim()}|${(t.t || '').toLowerCase().trim()}`;
      if (S.enrichCache[k]) UserProfile.update(t, 'like');
    });
    saveState();
  }

  // Start filling the discover queue
  showDiscoverLoading();
  await Queue.refill();

  // Background enrichment: fetch Last.fm tags for liked tracks over time.
  // Runs lazily so it never blocks the UI. Profile improves with each batch.
  setTimeout(() => EnrichEngine.enrichLikedBg(), 5000);
  setTimeout(() => MBEngine.enrichBg(), 12000);
  setTimeout(() => SpotifyEngine.buildProfile(), 20000);
  if (S.lbUser) { setTimeout(() => LBEngine.loadRecs(), 8000); }
  updateSettingsBadges();
  // Restore settings form values for connected services
  if (S.lbUser) { const el = $('lb-username'); if (el) el.value = S.lbUser; }
  if (S.lfmUsername) { const el = $('lfm-username'); if (el) el.value = S.lfmUsername; }
}

async function seedInitialTaste(tracks) {
  // Find Tidal IDs for a subset of popular liked tracks to bootstrap recommendations
  const batch = randPick(tracks, Math.min(5, tracks.length));
  if (!Array.isArray(batch)) return;
  for (const t of batch) {
    await sleep(300);
    if (t.sid && S.tidalCache[t.sid]) {
      const id = S.tidalCache[t.sid];
      if (!S.taste.seeds.find(s => s.id === id)) {
        S.taste.seeds.push({ id, weight: 8, title: t.t });
      }
    } else {
      const found = await API.search(t.t, t.isrc);
      if (found) {
        if (t.sid) S.tidalCache[t.sid] = found.id;
        if (!S.taste.seeds.find(s => s.id === found.id)) {
          S.taste.seeds.push({ id: found.id, weight: 8, title: t.t });
        }
        saveState();
      }
    }
  }
}

// Start
init();
