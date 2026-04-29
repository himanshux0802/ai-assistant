import asyncio
import os
import base64
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

IMAGES_DIR = os.path.join(os.path.dirname(__file__), "images")
_semaphore = asyncio.Semaphore(1)


class GenerateRequest(BaseModel):
    prompt: str


async def generate_image(prompt: str) -> dict:
    async with _semaphore:
        os.makedirs(IMAGES_DIR, exist_ok=True)
        captured_image = {"data": None}

        async def handle_response(response):
            url = response.url
            if "downloadTemporaryImage" in url or ("image-generation" in url and response.headers.get("content-type", "").startswith("image/")):
                try:
                    body = await response.body()
                    if len(body) > 5000:
                        captured_image["data"] = body
                        print(f"Captured image! ({len(body)} bytes) from {url[:80]}")
                except:
                    pass

        async with async_playwright() as pw:
            user_data = os.path.join(os.path.dirname(__file__), "browser_data")
            context = await pw.chromium.launch_persistent_context(
                user_data_dir=user_data,
                headless=False,
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
                ignore_default_args=["--enable-automation"],
            )
            page = context.pages[0] if context.pages else await context.new_page()
            await page.add_init_script("Object.defineProperty(navigator, 'webdriver', { get: () => undefined });")

            page.on("response", handle_response)

            print("Loading Perchance...")
            await page.goto("https://perchance.org/ai-text-to-image-generator", timeout=90000)
            await page.wait_for_load_state("domcontentloaded")
            await asyncio.sleep(8)

            iframe_el = await page.wait_for_selector("iframe#outputIframeEl", timeout=60000)
            iframe = await iframe_el.content_frame()
            await iframe.wait_for_selector("#generateButtonEl", timeout=60000)

            iframe_page = iframe.page
            iframe_page.on("response", handle_response)

            # Paste prompt directly and trigger input event
            textareas = await iframe.query_selector_all("textarea.paragraph-input")
            prompt_box = textareas[1]
            await prompt_box.evaluate('(el, text) => { el.value = text; el.dispatchEvent(new Event("input", {bubbles:true})); }', prompt)

            # Generate
            await iframe.click("#generateButtonEl")
            print(f"Generating: '{prompt}'...")

            # Wait for image capture (up to 2 min)
            for _ in range(120):
                if captured_image["data"]:
                    break
                await asyncio.sleep(1)

            await context.close()

        if not captured_image["data"]:
            raise RuntimeError("No image captured from network")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = "".join(c if c.isalnum() or c in " _-" else "" for c in prompt)[:50].strip().replace(" ", "_")
        filepath = os.path.join(IMAGES_DIR, f"{timestamp}_{safe_name}.png")

        with open(filepath, "wb") as f:
            f.write(captured_image["data"])

        b64 = base64.b64encode(captured_image["data"]).decode()
        print(f"Image saved to: {filepath}")
        return {"images": [{"filepath": filepath, "base64": b64}], "prompt": prompt, "count": 1}


@app.post("/generate")
async def api_generate(req: GenerateRequest):
    try:
        result = await generate_image(req.prompt)
        return {"success": True, **result}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
