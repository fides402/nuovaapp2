const { fetchDiscogsTrack, fetchEveryNoiseRecommendations, fetchMonochromeRecommendations } = require('./api');

// Seleziona un disco casuale da Discogs
async function getRandomTrack(genre, style, year, country) {
  const track = await fetchDiscogsTrack(genre, style, year, country);
  return track;
}

// Recupera le tracce simili tramite EveryNoise
async function getSimilarTracks(trackId) {
  const similarTracks = await fetchEveryNoiseRecommendations(trackId);
  return similarTracks;
}

// Verifica la disponibilità su Monochrome
async function getMonochromeRecommendations(trackId) {
  const recommendations = await fetchMonochromeRecommendations(trackId);
  return recommendations.filter(rec => rec.popularity <= 40);
}

// Combina tutto per ottenere raccomandazioni finali
async function generateRecommendations(genre, style, year, country) {
  const track = await getRandomTrack(genre, style, year, country);
  const similarTracks = await getSimilarTracks(track.id);
  
  let finalRecommendations = [];
  for (let similarTrack of similarTracks) {
    const recommendations = await getMonochromeRecommendations(similarTrack.id);
    finalRecommendations.push(...recommendations);
  }
  
  return finalRecommendations;
}

module.exports = { getRandomTrack, getSimilarTracks, getMonochromeRecommendations, generateRecommendations };
