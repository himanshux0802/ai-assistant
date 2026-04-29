# Skyler AI — Backend (Image Server)

Python FastAPI server that generates images via Perchance.

## Setup

```bash
cd assistant-ui/backend
pip install -r requirements.txt
playwright install chromium
```

## Run

```bash
python main.py
```

Server starts on `http://localhost:8000`

## API

### POST /generate

Generate an image from a text prompt.

```json
{
  "prompt": "a cyberpunk cat wearing sunglasses",
  "negative_prompt": "blurry, low quality",
  "art_style": "Painted Anime Plus",
  "shape": "Portrait(512x768px)",
  "guidance_scale": "default(7)",
  "num_images": 1
}
```

Response:
```json
{
  "success": true,
  "images": [
    { "filepath": "images/20260430_cyberpunk_cat.png", "base64": "..." }
  ],
  "prompt": "a cyberpunk cat wearing sunglasses",
  "count": 1
}
```

### GET /health

Returns `{"status": "ok"}` if server is running.

## Art Styles

Some available styles: `Painted Anime Plus`, `Photo`, `Cinematic`, `Digital Art`, `Fantasy Art`, `Anime`, `3D Render`, `Pixel Art`, `Comic Book`, `Oil Painting`

## Shapes

- `Portrait(512x768px)`
- `Landscape(768x512px)`
- `Square(512x512px)`

## Notes

- First run opens a browser window (Chromium) — this is normal
- Browser data is cached in `backend/browser_data/` for faster subsequent runs
- Generated images are saved in `backend/images/`
- The server uses `perchance.org/image-generator-professional`
