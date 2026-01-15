from pathlib import Path

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
import yaml

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


@app.get("/")
def index() -> FileResponse:
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
