# Swerve Music Recommender

A music recommendation engine that finds rare and obscure tracks similar to your favorites using Spotify, Discogs, and Gemini AI.

## Features

- **Spotify Integration**: Search tracks and get recommendations via Spotify API
- **Discogs Integration**: Find rare vinyl releases and obscure music via Discogs database  
- **Gemini AI**: Generate varied queries for diverse and rare recommendations
- **Rarity Filtering**: Prioritize tracks with low popularity scores

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure API keys in `src/config.py`:
- Spotify Client ID & Secret
- Discogs Token
- Gemini API Key

## Usage

```python
from src.main import SwerveRecommender

recommender = SwerveRecommender()
recommendations = recommender.get_recommendations_for_track("spotify:track:YOUR_TRACK_URI")
```

## API Keys Required

- **Spotify**: Get from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- **Discogs**: Get from [Discogs Settings](https://www.discogs.com/settings/developers)
- **Gemini**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)

## License

MIT
