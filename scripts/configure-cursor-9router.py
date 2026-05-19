"""Configure Cursor to route Agent/Composer through 9router (OpenAI-compatible API)."""

from __future__ import annotations

import json
import shutil
import sqlite3
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

STATE_DB = Path.home() / "AppData/Roaming/Cursor/User/globalStorage/state.vscdb"
STORAGE_KEY = (
    "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl"
    ".persistentStorage.applicationUser"
)
OPENAI_KEY_KEY = "cursorAuth/openAIKey"

REPO_ROOT = Path(__file__).resolve().parents[1]
CLAUDE_CONFIG = REPO_ROOT / ".claude" / "config.json"

BASE_URL = "http://amuharr.com:20128/v1"
DEFAULT_MODEL = "kr/claude-sonnet-4.5"


def load_api_key() -> str:
    cfg = json.loads(CLAUDE_CONFIG.read_text(encoding="utf-8"))
    key = cfg.get("anthropic_api_key", "").strip()
    if not key:
        raise SystemExit(f"No anthropic_api_key in {CLAUDE_CONFIG}")
    return key

NINEROUTER_MODELS = [
    ("kr/claude-sonnet-4.5", "Claude Sonnet 4.5", True),
    ("kr/claude-opus-4.7", "Claude Opus 4.7", False),
    ("kr/claude-haiku-4.5", "Claude Haiku 4.5", False),
    ("kr/deepseek-3.2", "DeepSeek 3.2", False),
    ("kr/qwen3-coder-next", "Qwen3 Coder Next", False),
    ("kr/glm-5", "GLM-5", False),
    ("kr/MiniMax-M2.5", "MiniMax M2.5", False),
]

FEATURES = [
    "composer",
    "cmdK",
    "backgroundComposer",
    "planExecution",
    "spec",
    "deepSearch",
    "quickAgent",
]


def make_api_model(name: str, display: str, default_on: bool) -> dict:
    slug = name.replace("/", "-")
    return {
        "name": name,
        "defaultOn": default_on,
        "parameterDefinitions": [],
        "variants": [
            {
                "parameterValues": [],
                "displayName": display,
                "isMaxMode": False,
                "isDefaultMaxConfig": True,
                "isDefaultNonMaxConfig": True,
                "displayNameOutsidePicker": display,
                "variantStringRepresentation": f"{slug}[]",
                "legacySlug": slug,
            }
        ],
        "legacySlugs": [slug],
        "idAliases": [slug],
        "supportsAgent": True,
        "degradationStatus": 0,
        "supportsThinking": False,
        "supportsImages": True,
        "supportsMaxMode": False,
        "clientDisplayName": display,
        "serverModelName": name,
        "supportsNonMaxMode": True,
        "isRecommendedForBackgroundComposer": default_on,
        "supportsPlanMode": True,
        "inputboxShortModelName": display,
        "supportsSandboxing": True,
        "namedModelSectionIndex": 0,
        "vendorName": "9router",
        "vendor": {"id": 99, "displayName": "9router"},
    }


def disable_cursor_auto(data: dict) -> None:
    """Turn off built-in Auto (routes to cursor.sh agent API, not 9router)."""
    for model in data.get("availableDefaultModels2", []):
        if model.get("name") == "default":
            model["defaultOn"] = False


def patch_feature_configs(configs: dict) -> None:
    for feature in FEATURES:
        entry = configs.setdefault(
            feature,
            {"defaultModel": DEFAULT_MODEL, "fallbackModels": [], "bestOfNDefaultModels": []},
        )
        entry["defaultModel"] = DEFAULT_MODEL
        entry["fallbackModels"] = [m[0] for m in NINEROUTER_MODELS if m[0] != DEFAULT_MODEL][:3]
        if feature == "backgroundComposer":
            entry["bestOfNDefaultModels"] = [DEFAULT_MODEL, entry["fallbackModels"][0]]

    subagents = configs.setdefault(
        "subagentModels",
        {"explore": {"defaultModel": DEFAULT_MODEL, "fallbackModels": [], "bestOfNDefaultModels": []}},
    )
    for cfg in subagents.values():
        cfg["defaultModel"] = DEFAULT_MODEL
        cfg["fallbackModels"] = [NINEROUTER_MODELS[1][0]]


def main() -> None:
    api_key = load_api_key()
    if not STATE_DB.exists():
        raise SystemExit(f"Cursor state DB not found: {STATE_DB}")

    backup = STATE_DB.with_suffix(
        f".vscdb.bak-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    )
    shutil.copy2(STATE_DB, backup)
    print(f"Backup: {backup}")

    con = sqlite3.connect(STATE_DB)
    cur = con.cursor()
    row = cur.execute("SELECT value FROM ItemTable WHERE key = ?", (STORAGE_KEY,)).fetchone()
    if not row:
        raise SystemExit("applicationUser persistent storage not found")

    data = json.loads(row[0])
    data["openAIBaseUrl"] = BASE_URL
    data["useOpenAIKey"] = True
    data["availableAPIKeyModels"] = [
        make_api_model(name, display, default_on) for name, display, default_on in NINEROUTER_MODELS
    ]
    disable_cursor_auto(data)
    patch_feature_configs(data.setdefault("featureModelConfigs", {}))
    data["modelPickerDisplayConfiguration"] = {
        "routedModelViewConfig": {
            "hideRoutedModelView": True,
            "routedModelViewToNamedViewToggle": {
                "titleMarkdown": DEFAULT_MODEL,
                "subtitle": "9router — custom API",
                "setToLastNamedModel": True,
            },
            "hideSearchBar": False,
            "routedModelViewToNamedViewButton": None,
        },
        "namedModelsViewConfig": {
            "namedViewToRoutedModelViewToggle": {"markdown": DEFAULT_MODEL},
            "namedViewToRoutedModelViewButton": None,
            "namedViewToRoutedModelViewNoButton": None,
        },
    }

    cur.execute(
        "UPDATE ItemTable SET value = ? WHERE key = ?",
        (json.dumps(data, separators=(",", ":")), STORAGE_KEY),
    )
    cur.execute(
        "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)",
        (OPENAI_KEY_KEY, api_key),
    )
    con.commit()
    con.close()

    print("Updated:")
    print(f"  openAIBaseUrl = {BASE_URL}")
    print(f"  useOpenAIKey = true")
    print(f"  availableAPIKeyModels = {len(NINEROUTER_MODELS)} models")
    print(f"  defaultModel = {DEFAULT_MODEL} (composer + features)")
    print("  hideRoutedModelView = true (Auto picker hidden)")
    print("Reload Cursor: Ctrl+Shift+P -> Developer: Reload Window")


if __name__ == "__main__":
    main()
