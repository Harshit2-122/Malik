from __future__ import annotations

import os
from typing import Any

import httpx

_client: httpx.Client | None = None
_base_url: str = ""
_headers: dict[str, str] = {}


def _init() -> None:
    global _base_url, _headers
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env "
            "(service role bypasses RLS for the API server)."
        )
    _base_url = f"{url}/rest/v1"
    _headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def get_http() -> httpx.Client:
    global _client
    if _client is None:
        _init()
        _client = httpx.Client(timeout=30.0)
    return _client


def rest_url(table: str) -> str:
    if not _base_url:
        _init()
    return f"{_base_url}/{table}"


def rest_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    if not _headers:
        _init()
    h = dict(_headers)
    if extra:
        h.update(extra)
    return h


def check_response(res: httpx.Response) -> Any:
    if res.status_code >= 400:
        raise RuntimeError(f"Supabase {res.status_code}: {res.text}")
    if res.status_code == 204 or not res.content:
        return None
    return res.json()
