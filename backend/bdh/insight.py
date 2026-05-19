"""σ-based synapse audit — Hindi summary + top-k neuron explanations."""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime
from typing import Any

import torch

from bdh.memory import text_to_embedding

# Hindi / roman symptom hints for pattern copy
_CARDIAC = frozenset(
    {
        "थकान",
        "thakan",
        "thakaan",
        "kamzori",
        "कमजोरी",
        "सूजन",
        "sujan",
        "सीने",
        "seene",
        "दर्द",
        "dard",
        "सांस",
        "saans",
        "bp",
    }
)
_FEVER = frozenset({"बुखार", "bukhar", "fever", "खांसी", "khansi", "cough"})
_BP = frozenset({"bp", "blood", "pressure", "उच्च", "high"})


def extract_tokens(text: str) -> list[str]:
    """Words from Hindi (Devanagari) or Latin symptom text."""
    if not text or not text.strip():
        return []
    parts = re.findall(r"[\u0900-\u097F]+|[a-zA-Z]+", text.strip().lower())
    return [p for p in parts if len(p) >= 2]


_MONTHS_HI = [
    "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
    "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
]
_MONTHS_EN = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def _month_label(created_at: str | None, locale: str = "hi") -> str:
    if not created_at:
        return "Previous visit" if locale == "en" else "पिछली विज़िट"
    try:
        raw = created_at.replace("Z", "+00:00")
        dt = datetime.fromisoformat(raw)
        months = _MONTHS_EN if locale == "en" else _MONTHS_HI
        return months[dt.month - 1]
    except (ValueError, TypeError):
        return "Previous visit" if locale == "en" else "पिछली विज़िट"


def _dim_to_keywords(keywords: list[str], dim: int, top_per_word: int = 4) -> dict[int, list[str]]:
    mapping: dict[int, list[str]] = defaultdict(list)
    for kw in keywords:
        emb = text_to_embedding(kw, dim).squeeze()
        if emb.numel() == 0:
            continue
        k = min(top_per_word, int(emb.numel()))
        for idx in torch.topk(emb.abs(), k=k).indices.tolist():
            if kw not in mapping[idx]:
                mapping[idx].append(kw)
    return mapping


def _visit_activation(symptoms: str, sigma: torch.Tensor, dim: int) -> torch.Tensor:
    x = text_to_embedding(symptoms, dim)
    z = torch.matmul(x, sigma)
    return torch.tanh(z).squeeze(0)


def _pattern_hint(keywords: list[str], locale: str = "hi") -> str | None:
    lowered = {k.lower() for k in keywords}
    if len(lowered & _CARDIAC) >= 2:
        return (
            "Possible cardiac pattern — please see a doctor."
            if locale == "en"
            else "कार्डियक पैटर्न संभव — डॉक्टर से जाँच कराएँ।"
        )
    if lowered & _FEVER:
        return (
            "Infection / fever-like symptoms detected."
            if locale == "en"
            else "संक्रमण / बुखार जैसे लक्षण दिख रहे हैं।"
        )
    if lowered & _BP:
        return (
            "BP-related signals — regular monitoring advised."
            if locale == "en"
            else "BP से जुड़े संकेत — नियमित मॉनिटरिंग उपयोगी।"
        )
    return None


def build_insight(
    visits: list[dict[str, Any]],
    sigma: torch.Tensor,
    dim: int,
    locale: str = "hi",
    top_k: int = 5,
) -> dict[str, Any]:
    loc = locale if locale in ("en", "hi", "ta", "te", "mr", "bn") else "hi"
    use_en = loc == "en"

    if not visits:
        empty = (
            "No visits yet — add your first visit to see insights."
            if use_en
            else "अभी कोई विज़िट दर्ज नहीं है — पहली विज़िट जोड़ने के बाद इनसाइट दिखेगा।"
        )
        return {
            "summary_hi": empty,
            "kyun": [],
            "activated_keywords": [],
            "top_dimensions": [],
        }

    all_tokens: list[str] = []
    for v in visits:
        all_tokens.extend(extract_tokens(v.get("symptoms_hindi") or ""))
    unique_tokens = list(dict.fromkeys(all_tokens))

    activations = [_visit_activation(v.get("symptoms_hindi") or "", sigma, dim) for v in visits]
    combined = torch.stack(activations).mean(dim=0)
    k = min(top_k, dim)
    top_dims = torch.topk(combined.abs(), k=k).indices.tolist()

    dim_map = _dim_to_keywords(unique_tokens, dim)
    activated_keywords: list[str] = []
    for d in top_dims:
        for kw in dim_map.get(d, []):
            if kw not in activated_keywords:
                activated_keywords.append(kw)

    if not activated_keywords and unique_tokens:
        activated_keywords = unique_tokens[: min(4, len(unique_tokens))]

    # Per-visit highlights for cross-session copy
    visit_phrases: list[str] = []
    for v in visits:
        month = _month_label(v.get("created_at"), loc)
        toks = extract_tokens(v.get("symptoms_hindi") or "")[:4]
        if toks:
            visit_phrases.append(f"{month}: {', '.join(toks)}")

    default_kw = "symptoms" if use_en else "लक्षण"
    kw_join = ", ".join(activated_keywords[:6]) if activated_keywords else default_kw
    cross = ""
    if len(visits) >= 2 and len(visit_phrases) >= 2:
        cross = (
            f" {visit_phrases[0]} and {visit_phrases[-1]} — "
            f"these symptoms are linked together in σ memory."
            if use_en
            else (
                f" {visit_phrases[0]} और {visit_phrases[-1]} — "
                f"ये लक्षण एक साथ σ मेमोरी में जुड़े हुए हैं।"
            )
        )
    elif visit_phrases:
        cross = f" {visit_phrases[0]}."

    pattern = _pattern_hint(activated_keywords + unique_tokens, loc)
    if use_en:
        summary = f"{kw_join} — top active neurons in the σ matrix link to these symptoms.{cross}"
    else:
        summary = f"{kw_join} — σ मैट्रिक्स में सबसे सक्रिय न्यूरॉन्स इन्हीं से जुड़े हैं।{cross}"
    if pattern:
        summary += f" {pattern}"

    kyun = [
        {
            "neuron_pair": f"(dim {d}, σ·x)",
            "weight_delta": (
                f"activation {combined[d].item():.4f} — keywords: "
                f"{', '.join(dim_map.get(d, [])[:3]) or '—'}"
            ),
        }
        for d in top_dims
    ]

    return {
        "summary_hi": summary.strip(),
        "kyun": kyun,
        "activated_keywords": activated_keywords,
        "top_dimensions": top_dims,
        "sigma_frobenius": round(float(sigma.norm().item()), 4),
    }
