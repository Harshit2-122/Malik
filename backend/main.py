from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from bdh.insight import build_insight
from bdh.memory import text_to_embedding
from db.repository import PatientRepository

load_dotenv()

SIGMA_DIM = int(os.getenv("SIGMA_DIM", "64"))
ETA = float(os.getenv("BDH_ETA", "0.01"))

app = FastAPI(title="Smriti API", version="0.2.0", description="BDH memory layer — σ matrix + Supabase")

_default_cors = (
    "http://localhost:3000,http://localhost:3001,"
    "http://127.0.0.1:3000,http://127.0.0.1:3001,"
    "https://smriti-six.vercel.app"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("CORS_ORIGINS", _default_cors).split(",") if o.strip()],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|smriti-six\.vercel\.app)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _repo() -> PatientRepository:
    return PatientRepository(sigma_dim=SIGMA_DIM, eta=ETA)


class VisitIn(BaseModel):
    symptoms_hindi: str = Field(..., description="Symptoms / notes in Hindi or mixed text")
    doctor_name: str | None = None
    bp_sys: int | None = None
    bp_dia: int | None = None
    medicines: str | None = None


class PatientCreate(BaseModel):
    display_name: str
    age: int | None = None
    locale: str = "hi"


class MemoryState(BaseModel):
    patient_id: str
    sigma_b64: str
    dim: int
    visit_count: int
    last_updated: str | None = None


@app.get("/health")
def health() -> dict[str, str]:
    try:
        _repo()
        db = "supabase_ok"
    except RuntimeError as e:
        db = f"supabase_config_missing: {e}"
    return {"status": "ok", "service": "smriti", "database": db}


def _db_call(fn):
    try:
        return fn()
    except RuntimeError as e:
        raise HTTPException(502, str(e)) from e


@app.post("/patients")
def create_patient(body: PatientCreate) -> dict[str, Any]:
    return _db_call(lambda: _repo().create_patient(body.display_name, body.age, body.locale))


@app.get("/patients/{patient_id}")
def get_patient(patient_id: str) -> dict[str, Any]:
    return _db_call(lambda: _repo().get_patient(patient_id))


@app.post("/patients/{patient_id}/visits")
def add_visit(patient_id: str, body: VisitIn) -> dict[str, Any]:
    def _run():
        repo = _repo()
        mem = repo.load_memory(patient_id)
        x = text_to_embedding(body.symptoms_hindi, SIGMA_DIM)
        mem.hebbian_step(x)
        repo.save_sigma(patient_id, mem)
        return repo.add_visit(
            patient_id,
            body.symptoms_hindi,
            body.doctor_name,
            body.bp_sys,
            body.bp_dia,
            body.medicines,
        )

    return _db_call(_run)


@app.get("/patients/{patient_id}/visits")
def list_visits(patient_id: str) -> list[dict[str, Any]]:
    return _db_call(lambda: _repo().list_visits(patient_id))


@app.get("/patients/{patient_id}/memory")
def get_memory(patient_id: str) -> MemoryState:
    meta = _db_call(lambda: _repo().get_memory_meta(patient_id))
    return MemoryState(
        patient_id=patient_id,
        sigma_b64=meta["sigma_b64"],
        dim=meta["dim"],
        visit_count=meta["visit_count"],
        last_updated=meta.get("updated_at"),
    )


@app.get("/patients/{patient_id}/insight")
def patient_insight(patient_id: str, locale: str = "hi") -> dict[str, Any]:
    def _run():
        repo = _repo()
        repo.get_patient(patient_id)
        visits = repo.list_visits(patient_id)
        mem = repo.load_memory(patient_id)
        return visits, mem

    visits, mem = _db_call(_run)
    loc = (locale or "hi").split("-")[0][:2]
    audit = build_insight(visits, mem.sigma, SIGMA_DIM, locale=loc)
    return {
        "patient_id": patient_id,
        "visit_count": len(visits),
        **audit,
    }
