import os
import json
import requests
from typing import List, Dict
from config import GEMINI_API_KEY


class GeminiClient:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or GEMINI_API_KEY
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={self.api_key}"

    def generate_varied_queries(self, track_info: Dict, num_variations: int = 5) -> List[str]:
        prompt = f"""Genera {num_variations} query di ricerca musicali diverse per trovare brani SIMILI a questo brano ma RARI e POCO NOTI:
        
Brano: {track_info.get('name')}
Artista: {track_info.get('artist')}
Album: {track_info.get('album')}

Le query devono:
1. Essere in inglese
2. Includere generi simili (es. "rare bossanova", "obscure jazz fusion", "underground soul")
3. Includere il nome dell'artista
4. Includere termini come: rare, obscure, underground, forgotten, lost, vintage, rare groove, library music
5. Essere diverse tra loro (non ripetere lo stesso pattern)

Restituisci SOLO le query, una per riga, senza numeri."""

        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 1.0,
                "maxOutputTokens": 500
            }
        }

        response = requests.post(self.base_url, json=payload)
        if response.status_code != 200:
            return self._fallback_queries(track_info, num_variations)

        data = response.json()
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            queries = [q.strip() for q in text.split('\n') if q.strip()]
            return queries[:num_variations]
        except:
            return self._fallback_queries(track_info, num_variations)

    def _fallback_queries(self, track_info: Dict, num_variations: int) -> List[str]:
        artist = track_info.get('artist', '')
        queries = [
            f"rare {artist} obscure",
            f"{artist} underground vinyl",
            f"rare bossanova {artist}",
            f"lost jazz {artist}",
            f"vintage soul {artist}"
        ]
        return queries[:num_variations]

    def generate_similar_artist_query(self, track_info: Dict) -> str:
        prompt = f"""Basandoti su questo brano, genera una query per cercare artisti SIMILI ma POCO NOTI:

Brano: {track_info.get('name')}
Artista: {track_info.get('artist')}

Restituisci SOLO una query breve (max 5 parole) che cerchi artisti simili rari."""

        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 50
            }
        }

        response = requests.post(self.base_url, json=payload)
        if response.status_code != 200:
            return f"rare {track_info.get('artist')}"

        data = response.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except:
            return f"rare {track_info.get('artist')}"

    def analyze_track_vibe(self, track_info: Dict) -> Dict:
        prompt = f"""Analizza questo brano e restituisci un JSON con:
- generi_simili: array di 5 generi affini
- moods: array di 3 mood/atmospheriche
- decade_preferita: decade di riferimento (es. "1970s")

Brano: {track_info.get('name')} - {track_info.get('artist')}"""

        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 200
            }
        }

        response = requests.post(self.base_url, json=payload)
        if response.status_code != 200:
            return {"generi_simili": ["Jazz", "Soul", "Bossa Nova"], "moods": ["Melanconico", "Romantico"], "decade_preferita": "1970s"}

        data = response.json()
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except:
            return {"generi_simili": ["Jazz", "Soul", "Bossa Nova"], "moods": ["Melanconico", "Romantico"], "decade_preferita": "1970s"}
