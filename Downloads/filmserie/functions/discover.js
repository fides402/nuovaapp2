const TMDB_BASE = 'https://api.themoviedb.org/3';
const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';
const TMDB_IMG  = 'https://image.tmdb.org/t/p/w500';
const TMDB_KEY  = process.env.TMDB_API_KEY;
const GROQ_KEY  = process.env.GROQ_API_KEY;

// Movie genre → closest TV genre mapping (TMDB uses different IDs for some)
const MOVIE_TO_TV_GENRE = {
  878: 10765, // Sci-Fi → Sci-Fi & Fantasy
  10752: 10768, // War → War & Politics
  10770: null,  // TV Movie → skip
};

// ─── TMDB helpers ────────────────────────────────────────────────────────────

async function tmdb(path, params = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', TMDB_KEY);
  url.searchParams.set('language', 'it-IT');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${path}: HTTP ${res.status}`);
  return res.json();
}

async function searchMovieId(title) {
  const data = await tmdb('/search/movie', { query: title, page: 1 });
  return data.results?.[0]?.id ?? null;
}

async function getMovieRecs(id) {
  const data = await tmdb(`/movie/${id}/recommendations`, { page: 1 });
  return data.results ?? [];
}

async function getMovieGenreIds(id) {
  const data = await tmdb(`/movie/${id}`);
  return (data.genres ?? []).map(g => g.id);
}

async function discoverTV(genreIds) {
  // Map movie genre IDs to TV genre IDs
  const tvGenres = genreIds
    .map(id => (id in MOVIE_TO_TV_GENRE ? MOVIE_TO_TV_GENRE[id] : id))
    .filter(Boolean)
    .slice(0, 2); // limit to 2 genres

  if (!tvGenres.length) return [];

  // Use '|' (OR logic) so shows need only one of the genres, not all
  const data = await tmdb('/discover/tv', {
    with_genres: tvGenres.join('|'),
    sort_by: 'vote_average.desc',
    'vote_average.gte': 7.2,
    'vote_count.gte': 300,
    'vote_count.lte': 20000,
    page: 1,
  });
  return data.results ?? [];
}

async function discoverTVRelaxed(genreIds) {
  const tvGenres = genreIds
    .map(id => (id in MOVIE_TO_TV_GENRE ? MOVIE_TO_TV_GENRE[id] : id))
    .filter(Boolean)
    .slice(0, 2);
  if (!tvGenres.length) return [];
  const data = await tmdb('/discover/tv', {
    with_genres: tvGenres.join('|'),
    sort_by: 'vote_average.desc',
    'vote_average.gte': 7.0,
    'vote_count.gte': 200,
    'vote_count.lte': 50000,
    page: 1,
  });
  return data.results ?? [];
}

async function getWatchProviders(tmdbId, mediaType) {
  try {
    const data = await tmdb(`/${mediaType}/${tmdbId}/watch/providers`);
    const it = data.results?.IT ?? {};
    return {
      flatrate: it.flatrate ?? [],
      rent:     it.rent     ?? [],
      buy:      it.buy      ?? [],
    };
  } catch {
    return { flatrate: [], rent: [], buy: [] };
  }
}

// ─── Filters ─────────────────────────────────────────────────────────────────

function isHiddenGem(item) {
  const avg   = item.vote_average ?? 0;
  const count = item.vote_count   ?? 0;
  return avg >= 7.2 && count >= 300 && count <= 20000;
}

function enrich(item, mediaType) {
  return {
    tmdb_id:           item.id,
    title:             item.title ?? item.name ?? '',
    year:              (item.release_date ?? item.first_air_date ?? '').slice(0, 4),
    vote_average:      item.vote_average,
    vote_count:        item.vote_count,
    genre_ids:         item.genre_ids ?? [],
    overview:          (item.overview ?? '').slice(0, 180),
    original_language: item.original_language ?? '',
    poster_path:       item.poster_path ?? null,
    media_type:        mediaType,
  };
}

function dedupe(items) {
  const seen = new Set();
  return items.filter(i => {
    if (seen.has(i.tmdb_id)) return false;
    seen.add(i.tmdb_id);
    return true;
  });
}

// ─── Groq ────────────────────────────────────────────────────────────────────

async function curateWithGroq(movieCandidates, tvCandidates, ctx) {
  // Build compact candidate lists with only the fields Groq needs
  const compactMovie = movieCandidates.map(c => ({
    id: c.tmdb_id, title: c.title, year: c.year,
    score: c.vote_average, votes: c.vote_count,
    lang: c.original_language, synopsis: c.overview,
  }));
  const compactTV = tvCandidates.map(c => ({
    id: c.tmdb_id, title: c.title, year: c.year,
    score: c.vote_average, votes: c.vote_count,
    lang: c.original_language, synopsis: c.overview,
  }));

  const validMovieIds = movieCandidates.map(c => c.tmdb_id).join(',');
  const validTVIds    = tvCandidates.map(c => c.tmdb_id).join(',');

  const prompt = `Sei un critico cinematografico italiano specializzato in gemme nascoste del cinema.

Film di riferimento dell'utente: ${ctx.reference_films.join(', ')}
Mood: ${ctx.mood || 'non specificato'}
Da evitare: ${ctx.avoid || 'nulla'}
Preferenza geografica: ${ctx.language || 'nessuna'}

CANDIDATI FILM (scegli solo da questi id: ${validMovieIds}):
${JSON.stringify(compactMovie)}

CANDIDATI SERIE TV (scegli solo da questi id: ${validTVIds}):
${JSON.stringify(compactTV)}

REGOLE RIGIDE:
- Usa SOLO tmdb_id presenti nelle liste sopra. Non inventare id.
- Scegli i 3 film e le 3 serie con maggiore affinità ai film di riferimento.
- Escludi tutto ciò che è da evitare. Varia paese/decennio tra le 3 scelte.
- Scrivi tutto IN ITALIANO.

Rispondi SOLO con questo JSON (niente testo fuori):
{"films":[{"tmdb_id":0,"perche_sconosciuto":"","perche_consigliato":"","sintesi_recensioni":""}],"series":[{"tmdb_id":0,"perche_sconosciuto":"","perche_consigliato":"","sintesi_recensioni":""}]}`;

  const res = await fetch(GROQ_BASE, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'Sei un critico cinematografico italiano esperto. Rispondi SOLO con JSON valido, mai con testo aggiuntivo, mai con markdown code blocks.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.55,
      max_tokens: 2200,
    }),
  });

  // Retry once on 429 (rate limit) after a short wait
  if (res.status === 429) {
    await new Promise(r => setTimeout(r, 32000));
    const retry = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Sei un critico cinematografico italiano esperto. Rispondi SOLO con JSON valido, mai con testo aggiuntivo, mai con markdown code blocks.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.55,
        max_tokens: 2200,
      }),
    });
    if (!retry.ok) {
      throw new Error('Il servizio AI è momentaneamente saturo. Riprova tra un minuto.');
    }
    const retryData = await retry.json();
    const retryRaw = (retryData.choices?.[0]?.message?.content ?? '').trim();
    const retryJson = retryRaw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    const retryMatch = retryJson.match(/\{[\s\S]*\}/);
    if (!retryMatch) throw new Error('Groq non ha restituito JSON valido');
    return JSON.parse(retryMatch[0]);
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Groq API: ${res.status} — ${txt.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw  = (data.choices?.[0]?.message?.content ?? '').trim();

  // Strip markdown code fences if present
  const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
  const match   = jsonStr.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Groq non ha restituito JSON valido');

  try {
    return JSON.parse(match[0]);
  } catch {
    // JSON was truncated (max_tokens cut it off) — attempt to fix by closing open structure
    const partial = match[0];
    // Count open/close braces to determine how many closings are needed
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (const ch of partial) {
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inStr) { escape = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === '{' || ch === '[') depth++;
      if (ch === '}' || ch === ']') depth--;
    }
    // Strip trailing incomplete entry and close the JSON
    const trimmed = partial.replace(/,\s*\{[^}]*$/, '').replace(/,\s*$/, '');
    const closing = ']}'.repeat(Math.max(0, depth));
    try {
      return JSON.parse(trimmed + closing);
    } catch {
      throw new Error('La risposta AI era incompleta. Riprova.');
    }
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON non valido nella richiesta' }) };
  }

  const { reference_films, mood = '', avoid = '', language = '' } = body;

  if (!Array.isArray(reference_films) || !reference_films.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Inserisci almeno un film di riferimento' }) };
  }

  try {
    // Step 1: Resolve reference film TMDB IDs in parallel
    const rawIds = await Promise.all(
      reference_films.slice(0, 3).map(t => searchMovieId(String(t).trim()))
    );
    const refIds = rawIds.filter(Boolean);

    if (!refIds.length) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Non ho trovato i film indicati su TMDB. Prova con titoli più precisi (es. "Parasite 2019").' }),
      };
    }

    // Step 2: Fetch recommendations + genre IDs for each reference film in parallel
    const [recsArrays, genreArrays] = await Promise.all([
      Promise.all(refIds.map(id => getMovieRecs(id))),
      Promise.all(refIds.map(id => getMovieGenreIds(id))),
    ]);

    // Step 3: Build movie candidate pool (exclude the reference films themselves)
    const refIdSet = new Set(refIds);
    // Also exclude by normalized title to catch ID mismatches (remakes vs originals)
    const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const refTitleSet = new Set(reference_films.map(t => normalize(t)));
    const allRecs = recsArrays.flat().filter(i => {
      if (refIdSet.has(i.id)) return false;
      const normTitle = normalize(i.title ?? '');
      if (refTitleSet.has(normTitle)) return false;
      return true;
    });
    let movieCandidates = dedupe(allRecs.filter(isHiddenGem).map(i => enrich(i, 'movie'))).slice(0, 15);

    // Fallback: relax vote_count upper bound if pool is too small
    if (movieCandidates.length < 6) {
      const relaxed = allRecs.filter(i => {
        const avg = i.vote_average ?? 0;
        const cnt = i.vote_count   ?? 0;
        return avg >= 7.0 && cnt >= 200 && cnt <= 50000;
      });
      movieCandidates = dedupe(relaxed.map(i => enrich(i, 'movie'))).slice(0, 15);
    }

    // Step 4: Build TV candidate pool via genre discovery
    const uniqueGenres = [...new Set(genreArrays.flat())].slice(0, 4);
    let tvRaw = await discoverTV(uniqueGenres);
    let tvCandidates = dedupe(tvRaw.filter(isHiddenGem).map(i => enrich(i, 'tv')));

    if (tvCandidates.length < 4) {
      tvRaw = await discoverTVRelaxed(uniqueGenres);
      tvCandidates = dedupe(tvRaw.map(i => enrich(i, 'tv'))).slice(0, 15);
    } else {
      tvCandidates = tvCandidates.slice(0, 15);
    }

    // Step 5: Groq curation + Italian descriptions
    const curated = await curateWithGroq(movieCandidates, tvCandidates, {
      reference_films,
      mood,
      avoid,
      language,
    });

    // Step 6: Hydrate selected cards with poster URL + watch providers
    const hydrateCard = async (card, candidates, mediaType) => {
      const match = candidates.find(c => c.tmdb_id === card.tmdb_id);
      if (!match) return null;
      const providers = await getWatchProviders(card.tmdb_id, mediaType);
      return {
        tmdb_id:           match.tmdb_id,
        title:             match.title,
        year:              match.year,
        original_language: match.original_language,
        vote_average:      match.vote_average,
        vote_count:        match.vote_count,
        genre_ids:         match.genre_ids,
        poster_url:        match.poster_path ? `${TMDB_IMG}${match.poster_path}` : null,
        perche_sconosciuto: card.perche_sconosciuto ?? '',
        perche_consigliato: card.perche_consigliato ?? '',
        sintesi_recensioni: card.sintesi_recensioni ?? '',
        watch_providers:   providers,
      };
    };

    const [films, series] = await Promise.all([
      Promise.all((curated.films  ?? []).slice(0, 3).map(c => hydrateCard(c, movieCandidates, 'movie'))),
      Promise.all((curated.series ?? []).slice(0, 3).map(c => hydrateCard(c, tvCandidates,    'tv'))),
    ]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        films:  films.filter(Boolean),
        series: series.filter(Boolean),
      }),
    };

  } catch (err) {
    console.error('[fidelix]', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `Errore interno: ${err.message}` }),
    };
  }
};
