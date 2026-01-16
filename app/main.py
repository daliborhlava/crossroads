from pathlib import Path

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import yaml
from urllib.parse import quote_plus

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
CONFIG_PATH = BASE_DIR / "config.yaml"

app = FastAPI(title="Crossroads")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def load_config() -> dict:
    try:
        with CONFIG_PATH.open("r", encoding="utf-8") as handle:
            return yaml.safe_load(handle) or {}
    except FileNotFoundError:
        return {}
    except yaml.YAMLError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid config: {exc}")


def normalize(value: str) -> str:
    return value.strip().lower()


def iter_items(config: dict):
    for section in config.get("sections", []):
        for item in section.get("items", []):
            yield item


def get_keywords(item: dict) -> list[str]:
    raw = item.get("keyword") or item.get("keywords")
    if isinstance(raw, str):
        return [entry for entry in raw.replace(",", " ").split() if entry]
    if isinstance(raw, list):
        return [str(entry) for entry in raw if str(entry).strip()]
    return []


def build_search_url(item: dict, query: str) -> str:
    search_url = item.get("searchUrl") or item.get("search_url")
    if search_url and query:
        return search_url.replace("%s", quote_plus(query))
    return item.get("url", "")


def find_by_keyword(items: list[dict], keyword: str) -> dict | None:
    target = normalize(keyword)
    matches = [item for item in items if target in [normalize(k) for k in get_keywords(item)]]
    if len(matches) == 1:
        return matches[0]
    return None


def match_items(items: list[dict], query: str) -> list[dict]:
    tokens = [token for token in normalize(query).split() if token]
    if not tokens:
        return []
    matches = []
    for item in items:
        haystack = " ".join(
            [
                str(item.get("title", "")),
                str(item.get("url", "")),
                str(item.get("description", "")),
                " ".join(get_keywords(item)),
            ]
        ).lower()
        if all(token in haystack for token in tokens):
            matches.append(item)
    return matches


@app.get("/")
def index(q: str | None = None) -> FileResponse | RedirectResponse:
    if q:
        query = q.strip()
        if query:
            config = load_config()
            items = list(iter_items(config))
            tokens = query.split()

            item = find_by_keyword(items, tokens[0])
            if item:
                remainder = " ".join(tokens[1:]).strip()
                target = build_search_url(item, remainder)
                if target:
                    return RedirectResponse(url=target, status_code=302)

            matches = match_items(items, query)
            if len(matches) == 1:
                target = matches[0].get("url", "")
                if target:
                    return RedirectResponse(url=target, status_code=302)

    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/config")
def get_config() -> JSONResponse:
    return JSONResponse(load_config())


@app.get("/api/config/raw")
def get_config_raw() -> PlainTextResponse:
    if not CONFIG_PATH.exists():
        return PlainTextResponse("", media_type="text/plain")
    return PlainTextResponse(CONFIG_PATH.read_text(encoding="utf-8"), media_type="text/plain")


@app.post("/api/config/raw")
def update_config(text: str = Body(..., media_type="text/plain")) -> JSONResponse:
    try:
        yaml.safe_load(text) or {}
    except yaml.YAMLError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {exc}")

    CONFIG_PATH.write_text(text, encoding="utf-8")
    return JSONResponse({"ok": True})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
