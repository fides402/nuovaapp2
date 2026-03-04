import os
import sys
import json
from typing import List, Dict
from spotify_client import SpotifyClient
from discogs_client import DiscogsClient
from gemini_client import GeminiClient


class SwerveRecommender:
    def __init__(self):
        self.spotify = SpotifyClient()
        self.discogs = DiscogsClient()
        self.gemini = GeminiClient()

    def load_tracks_from_list(self, track_uris: List[str]) -> List[Dict]:
        tracks = []
        for uri in track_uris:
            track_info = self.spotify.get_track_info(uri)
            if track_info:
                tracks.append(track_info)
        return tracks

    def get_recommendations_for_track(self, track_uri: str, num_recommendations: int = 10) -> List[Dict]:
        track_info = self.spotify.get_track_info(track_uri)
        if not track_info:
            return []

        print(f"Analizzando: {track_info['name']} - {track_info['artist']}")

        vibe = self.gemini.analyze_track_vibe(track_info)
        varied_queries = self.gemini.generate_varied_queries(track_info, num_variations=5)

        all_recommendations = []
        seen_ids = set()

        for query in varied_queries:
            spotify_results = self.spotify.search_tracks(query, limit=15)
            for track in spotify_results:
                if track["id"] not in seen_ids and track.get("popularity", 0) < 50:
                    track["source_query"] = query
                    track["vibe"] = vibe
                    all_recommendations.append(track)
                    seen_ids.add(track["id"])

        discogs_results = self.discogs.find_similar_releases(
            track_info["artist"],
            year=int(track_info.get("release_date", "1970")[:4]) if track_info.get("release_date") else None,
            limit=10
        )

        rare_tracks = self.discogs.find_rare_tracks_by_artist(track_info["artist"], limit=10)

        recommendations = {
            "input_track": track_info,
            "vibe_analysis": vibe,
            "spotify_recommendations": all_recommendations[:num_recommendations],
            "discogs_rare_releases": discogs_results[:5],
            "discogs_rare_tracks": rare_tracks
        }

        return recommendations

    def get_recommendations_from_playlist(self, track_uris: List[str], recommendations_per_track: int = 5) -> Dict:
        tracks = self.load_tracks_from_list(track_uris)
        
        all_spotify = []
        all_discogs = []
        seen_spotify = set()

        for track in tracks:
            recs = self.get_recommendations_for_track(
                f"spotify:track:{track['id']}", 
                num_recommendations=recommendations_per_track
            )
            
            if recs:
                all_spotify.extend([t for t in recs.get("spotify_recommendations", []) 
                                   if t["id"] not in seen_spotify])
                seen_spotify.add(t["id"])
                all_discogs.extend(recs.get("discogs_rare_releases", []))

        all_spotify.sort(key=lambda x: x.get("popularity", 100))
        
        return {
            "input_tracks": tracks,
            "rare_spotify_tracks": all_spotify[:30],
            "discogs_rare_releases": all_discogs[:15],
            "total_tracks_found": len(all_spotify)
        }


def main():
    recommender = SwerveRecommender()
    
    default_tracks = [
        "spotify:track:6wOJ0H5NRT6P45LKqyjlah",
        "spotify:track:5gfuPRh2118jWEhuH1tdHw",
        "spotify:track:0VJX2Cxisf3BHciKl5BuRm",
    ]

    print("=" * 50)
    print("SWERVE - Rare Music Recommender")
    print("=" * 50)
    print()

    track_uri = input("Inserisci Spotify Track URI (o invio per demo): ").strip()
    
    if not track_uri:
        track_uri = default_tracks[0]
        print(f"Usando demo track: {track_uri}")

    recommendations = recommender.get_recommendations_for_track(track_uri)
    
    print("\n" + "=" * 50)
    print("RACCOMANDAZIONI RARE TROVATE")
    print("=" * 50)
    
    print(f"\nInput: {recommendations['input_track']['name']} - {recommendations['input_track']['artist']}")
    print(f"Vibe: {recommendations['vibe_analysis']}")
    
    print("\n--- Spotify Rare Tracks ---")
    for i, track in enumerate(recommendations["spotify_recommendations"][:10], 1):
        print(f"{i}. {track['name']} - {track['artist']} (pop: {track.get('popularity', 'N/A')})")
    
    print("\n--- Discogs Rare Releases ---")
    for i, release in enumerate(recommendations["discogs_rare_releases"][:5], 1):
        print(f"{i}. {release.get('title')} ({release.get('year')}) - wantlist: {release.get('wantlist_count')}")


if __name__ == "__main__":
    main()
