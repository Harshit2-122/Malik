"""BDH Hebbian memory: fixed-size σ matrix updated per visit.

Δσ = η · xᵀ · tanh(x · σ)  (matched to brief; x is row 1×d)
"""

from __future__ import annotations

import base64
import io
from dataclasses import dataclass

import numpy as np
import torch


def _ensure_row(x: torch.Tensor, dim: int) -> torch.Tensor:
    if x.dim() == 1:
        x = x.unsqueeze(0)
    if x.shape[-1] != dim:
        raise ValueError(f"Embedding dim {x.shape[-1]} != σ dim {dim}")
    return x


@dataclass
class HebbianMemory:
    dim: int
    eta: float = 0.01
    device: str | torch.device = "cpu"

    def __post_init__(self) -> None:
        self._sigma = torch.zeros(self.dim, self.dim, device=self.device, dtype=torch.float32)

    @property
    def sigma(self) -> torch.Tensor:
        return self._sigma

    def load_sigma(self, tensor: torch.Tensor) -> None:
        if tensor.shape != (self.dim, self.dim):
            raise ValueError(f"Expected σ shape ({self.dim},{self.dim}), got {tuple(tensor.shape)}")
        self._sigma = tensor.to(device=self.device, dtype=torch.float32).clone()

    def hebbian_step(self, x: torch.Tensor) -> torch.Tensor:
        """One update from embedding x; returns updated σ."""
        x = _ensure_row(x, self.dim).to(self.device, dtype=torch.float32)
        # z = x @ σ  → (batch, dim)
        z = torch.matmul(x, self._sigma)
        t = torch.tanh(z)
        # Δσ = η * sum_b outer(x_b, t_b) / batch
        delta = self.eta * torch.einsum("bi,bj->ij", x, t) / x.shape[0]
        self._sigma = self._sigma + delta
        return self._sigma

    def state_dict(self) -> dict[str, torch.Tensor]:
        return {"sigma": self._sigma.detach().cpu()}

    def load_state_dict(self, d: dict[str, torch.Tensor]) -> None:
        self.load_sigma(d["sigma"])


def sigma_to_b64(sigma: torch.Tensor) -> str:
    buf = io.BytesIO()
    torch.save({"sigma": sigma.detach().cpu()}, buf)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def b64_to_sigma(b64: str, dim: int, device: str | torch.device = "cpu") -> torch.Tensor:
    raw = base64.b64decode(b64.encode("ascii"))
    buf = io.BytesIO(raw)
    d = torch.load(buf, map_location=device, weights_only=False)
    t = d["sigma"]
    if t.shape != (dim, dim):
        raise ValueError(f"Decoded σ shape {tuple(t.shape)} != ({dim},{dim})")
    return t.to(device=device, dtype=torch.float32)


def text_to_embedding(text: str, dim: int, device: str | torch.device = "cpu") -> torch.Tensor:
    """Deterministic bag-of-chars projection — Phase 1 stub until sentence-transformers."""
    if not text.strip():
        return torch.zeros(1, dim, device=device, dtype=torch.float32)
    vec = np.zeros(dim, dtype=np.float32)
    for i, ch in enumerate(text.strip().lower()):
        vec[(ord(ch) + i * 17) % dim] += 1.0
    v = torch.from_numpy(vec).to(device)
    v = v / (v.norm(p=2) + 1e-8)
    return v.unsqueeze(0)
