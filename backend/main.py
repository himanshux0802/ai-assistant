import asyncio
import os
import base64
import json
from datetime import datetime
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

IMAGES_DIR = os.path.join(os.path.dirname(__file__), "images")
_semaphore = asyncio.Semaphore(1)


class GenerateRequest(BaseModel):
    prompt: str
    artStyle: str = ""
    shape: str = ""
    imageCount: int = 1


async def _select_dropdown(iframe, keyword_check: str, value: str):
    """Find a <select> containing keyword_check in its options, then pick value by label."""
    selects = await iframe.query_selector_all("select")
    for sel in selects:
        inner = await sel.inner_text()
        if keyword_check in inner:
            options = await sel.query_selector_all("option")
            for opt in options:
                opt_text = (await opt.inner_text()).strip()
                if opt_text.lower() == value.lower():
                    opt_val = await opt.get_attribute("value")
                    if opt_val is not None:
                        await sel.select_option(value=opt_val)
                    else:
                        await sel.select_option(label=opt_text)
                    return opt_text
    return None


async def _generate_single(pw, prompt: str, art_style: str, shape: str) -> bytes:
    """Launch a browser, generate one image, return raw bytes."""
    captured = {"data": None}

    async def handle_response(response):
        url = response.url
        if "downloadTemporaryImage" in url or ("image-generation" in url and response.headers.get("content-type", "").startswith("image/")):
            try:
                body = await response.body()
                if len(body) > 5000:
                    captured["data"] = body
            except:
                pass

    browser = await pw.chromium.launch(
        headless=False,
        args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        timeout=60000,
    )
    try:
        context = await browser.new_context()
        page = await context.new_page()
        await page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")
        page.on("response", handle_response)

        await page.goto("https://perchance.org/ai-text-to-image-generator", timeout=90000)
        await page.wait_for_load_state("domcontentloaded")
        await asyncio.sleep(8)

        iframe_el = await page.wait_for_selector("iframe#outputIframeEl", timeout=60000)
        iframe = await iframe_el.content_frame()
        await iframe.wait_for_selector("#generateButtonEl", timeout=60000)

        iframe.page.on("response", handle_response)

        # Fill prompt
        textareas = await iframe.query_selector_all("textarea.paragraph-input")
        await textareas[1].evaluate('(el, text) => { el.value = text; el.dispatchEvent(new Event("input", {bubbles:true})); }', prompt)

        # Select art style
        if art_style:
            try:
                picked = await _select_dropdown(iframe, "Painted Anime", art_style)
                print(f"  Art style: '{picked}'" if picked else f"  Art style '{art_style}' not found")
            except Exception as e:
                print(f"  Could not set art style: {e}")

        # Select shape
        if shape:
            try:
                picked = await _select_dropdown(iframe, "Square", shape)
                print(f"  Shape: '{picked}'" if picked else f"  Shape '{shape}' not found")
            except Exception as e:
                print(f"  Could not set shape: {e}")

        await iframe.click("#generateButtonEl")

        for _ in range(120):
            if captured["data"]:
                break
            await asyncio.sleep(1)
    finally:
        await browser.close()

    if not captured["data"]:
        raise RuntimeError("No image captured")
    return captured["data"]


def _save_image(data: bytes, prompt: str, index: int = 0) -> str:
    os.makedirs(IMAGES_DIR, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = "".join(c if c.isalnum() or c in " _-" else "" for c in prompt)[:50].strip().replace(" ", "_")
    suffix = f"_{index + 1}" if index > 0 else ""
    filepath = os.path.join(IMAGES_DIR, f"{timestamp}_{safe_name}{suffix}.png")
    with open(filepath, "wb") as f:
        f.write(data)
    return filepath


async def generate_images(prompt: str, art_style: str = "", shape: str = "", count: int = 1) -> dict:
    async with _semaphore:
        count = max(1, min(3, count))
        results = []

        async with async_playwright() as pw:
            for i in range(count):
                print(f"Generating image {i + 1}/{count}: '{prompt[:60]}'...")
                try:
                    data = await _generate_single(pw, prompt, art_style, shape)
                    filepath = _save_image(data, prompt, i if count > 1 else 0)
                    b64 = base64.b64encode(data).decode()
                    results.append({"filepath": filepath, "base64": b64})
                    print(f"  Saved: {filepath}")
                except Exception as e:
                    print(f"  Failed image {i + 1}: {e}")

        if not results:
            raise RuntimeError("No images captured")

        return {"images": results, "prompt": prompt, "count": len(results)}


@app.post("/generate")
async def api_generate(req: GenerateRequest):
    try:
        result = await generate_images(req.prompt, req.artStyle, req.shape, req.imageCount)
        return {"success": True, **result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/generate")
async def api_gallery():
    """Return all saved images for the gallery."""
    os.makedirs(IMAGES_DIR, exist_ok=True)
    images = []
    for f in sorted(os.listdir(IMAGES_DIR), reverse=True):
        if not f.endswith(".png"):
            continue
        filepath = os.path.join(IMAGES_DIR, f)
        try:
            with open(filepath, "rb") as fh:
                b64 = base64.b64encode(fh.read()).decode()
            # Parse filename: 20260430_013404_prompt_text.png
            parts = f.replace(".png", "").split("_", 2)
            timestamp = f"{parts[0][:4]}-{parts[0][4:6]}-{parts[0][6:8]} {parts[1][:2]}:{parts[1][2:4]}" if len(parts) >= 2 else ""
            prompt_text = parts[2].replace("_", " ") if len(parts) > 2 else f
            images.append({"filename": f, "prompt": prompt_text, "timestamp": timestamp, "base64": b64})
        except:
            continue
    return {"images": images}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
