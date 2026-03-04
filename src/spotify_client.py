import os
import base64
import json
import requests
from typing import List, Dict, Optional
from config import SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET


class SpotifyClient:
    def __init__(self, client_id: str = None, client_secret: str = None):
        self.client_id = client_id or SPOTIFY_CLIENT_ID
        self.client_secret = client_secret or SPOTIFY_CLIENT_SECRET
        self.access_token = None
        self.token_expires_at = 0

    def _get_access_token(self) -> str:
        import time
        if self.access_token and time.time() < self.token_expires_at:
            return self.access_token

        auth_string = f"{self.client_id}:{self.client_secret}"
        auth_bytes = auth_string.encode('utf-8')
        auth_base64 = base64.b64encode(auth_bytes).decode('utf-8')

        url = "https://accounts.spotify.com/api/token"
        headers = {
            "Authorization": f"Basic {auth_base64}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        data = {"grant_type": "client_credentials"}

        response = requests.post(url, headers=headers, data=data)
        response.raise_for_status()

        token_data = response.json()
        self.access_token = token_data["access_token"]
        import time
        self.token_expires_at = time.time() + token_data["expires_in"] - 60
        return self.access_token

    def get_track_info(self, spotify_uri: str) -> Optional[Dict]:
        track_id = spotify_uri.replace("spotify:track:", "")
        url = f"https://api.spotify.com/v1/tracks/{track_id}"
        headers = {"Authorization": f"Bearer {self._get_access_token()}"}

        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            return None

        data = response.json()
        return {
            "name": data.get("name"),
            "artist": data["artists"][0]["name"] if data.get("artists") else None,
            "album": data["album"].get("name") if data.get("album") else None,
            "release_date": data["album"].get("release_date") if data.get("album") else None,
            "popularity": data.get("popularity"),
            "duration_ms": data.get("duration_ms"),
            "id": data.get("id")
        }

    def get_audio_features(self, track_id: str) -> Optional[Dict]:
        url = f"https://api.spotify.com/v1/audio-features/{track_id}"
        headers = {"Authorization": f"Bearer {self._get_access_token()}"}

        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            return None

        return response.json()

    def search_tracks(self, query: str, limit: int = 20) -> List[Dict]:
        url = "https://api.spotify.com/v1/search"
        headers = {"Authorization": f"Bearer {self._get_access_token()}"}
        params = {
            "q": query,
            "type": "track",
            "limit": limit
        }

        response = requests.get(url, headers=headers, params=params)
        if response.status_code != 200:
            return []

        data = response.json()
        tracks = []
        for item in data.get("tracks", {}).get("items", []):
            tracks.append({
                "id": item.get("id"),
                "name": item.get("name"),
                "artist": item["artists"][0]["name"] if item.get("artists") else None,
                "album": item["album"].get("name") if item.get("album") else None,
                "popularity": item.get("popularity"),
                "uri": item.get("uri"),
                "release_date": item["album"].get("release_date") if item.get("album") else None
            })
        return tracks

    def getRecommendations(self, seed_tracks: List[str], limit: int = 20, **kwargs) -> List[Dict]:
        url = "https://api.spotify.com/v1/recommendations"
        headers = {"Authorization": f"Bearer {self._get_access_token()}"}
        params = {
            "seed_tracks": seed_tracks[:5],
            "limit": limit
        }
        params.update(kwargs)

        response = requests.get(url, headers=headers, params=params)
        if response.status_code != 200:
            return []

        data = response.json()
        tracks = []
        for item in data.get("tracks", []):
            tracks.append({
                "id": item.get("id"),
                "name": item.get("name"),
                "artist": item["artists"][0]["name"] if item.get("artists") else None,
                "album": item["album"].get("name") if item.get("album") else None,
                "popularity": item.get("popularity"),
                "uri": item.get("uri"),
                "release_date": item["album"].get("release_date") if item.get("album") else None
            })
        return tracks
