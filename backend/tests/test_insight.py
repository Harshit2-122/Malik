"""Unit tests for σ synapse audit (no Supabase required)."""

import torch

from bdh.insight import build_insight
from bdh.memory import HebbianMemory, text_to_embedding


def test_insight_multi_visit_cardiac_pattern():
    mem = HebbianMemory(dim=64, eta=0.05)
    visits = [
        {"symptoms_hindi": "थकान और कमजोरी", "created_at": "2026-01-15T10:00:00+00:00"},
        {"symptoms_hindi": "सूजन पैर में", "created_at": "2026-02-20T10:00:00+00:00"},
    ]
    for v in visits:
        mem.hebbian_step(text_to_embedding(v["symptoms_hindi"], 64))

    out = build_insight(visits, mem.sigma, 64)
    assert out["summary_hi"]
    assert "थकान" in out["summary_hi"] or "सूजन" in out["summary_hi"]
    assert len(out["kyun"]) >= 1
    assert "कार्डियक" in out["summary_hi"] or len(out["activated_keywords"]) >= 1


def test_insight_empty_visits():
    mem = HebbianMemory(dim=64)
    out = build_insight([], mem.sigma, 64)
    assert "विज़िट" in out["summary_hi"]
