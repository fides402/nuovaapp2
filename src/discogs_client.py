import os
import requests
from typing import List, Dict, Optional
from config import DISCOGS_TOKEN


class DiscogsClient:
    def __init__(self, token: str = None):
        self.token = token or DISCOGS_TOKEN
        self.base_url = "https://api.discogs.com"

    def _get_headers(self) -> Dict:
        return {
            "Authorization": f"Discogs token={self.token}",
            "User-Agent": "SwerveMusic/1.0"
        }

    def search(self, query: str, type: str = "release", per_page: int = 25) -> List[Dict]:
        url = f"{self.base_url}/database/search"
        headers = self._get_headers()
        params = {
            "q": query,
            "type": type,
            "per_page": per_page
        }

        response = requests.get(url, headers=headers, params=params)
        if response.status_code != 200:
            return []

        data = response.json()
        return data.get("results", [])

    def find_similar_releases(self, artist: str, genre: str = None, year: int = None, limit: int = 20) -> List[Dict]:
        query = artist
        if genre:
            query += f" genre:{genre}"
        if year:
            query += f" year:{year}"

        results = self.search(query, per_page=limit * 2)
        
        rare_releases = []
        for release in results:
            wantlist_count = release.get("wantlist_count", 0)
            list_count = release.get("list_count", 0)
            
            if wantlist_count < 50 and list_count < 100:
                rare_releases.append({
                    "title": release.get("title"),
                    "year": release.get("year"),
                    "genre": release.get("genre", []),
                    "style": release.get("style", []),
                    "country": release.get("country"),
                    "cover_image": release.get("cover_image"),
                    "resource_url": release.get("resource_url"),
                    "wantlist_count": wantlist_count,
                    "list_count": list_count,
                    "rarity_score": (wantlist_count + list_count)
                })

        return rare_releases[:limit]

    def get_release(self, release_id: int) -> Optional[Dict]:
        url = f"{self.base_url}/releases/{release_id}"
        headers = self._get_headers()

        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            return None

        return response.json()

    def find_rare_tracks_by_artist(self, artist: str, limit: int = 10) -> List[Dict]:
        results = self.search(f"artist:{artist}", per_page=50)
        
        tracks = []
        for release in results[:20]:
            wantlist_count = release.get("wantlist_count", 0)
            if wantlist_count < 30:
                tracks.append({
                    "artist": release.get("artist"),
                    "title": release.get("title"),
                    "year": release.get("year"),
                    "genre": release.get("genre", []),
                    "wantlist_count": wantlist_count,
                    "cover_image": release.get("cover_image")
                })

        return tracks[:limit]
