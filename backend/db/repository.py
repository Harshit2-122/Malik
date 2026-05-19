from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from bdh import HebbianMemory, b64_to_sigma, sigma_to_b64
from db.supabase_client import check_response, get_http, rest_headers, rest_url


class PatientRepository:
    def __init__(self, sigma_dim: int, eta: float) -> None:
        self.sigma_dim = sigma_dim
        self.eta = eta
        self._http = get_http()

    def create_patient(
        self,
        display_name: str,
        age: int | None,
        locale: str,
    ) -> dict[str, Any]:
        res = self._http.post(
            rest_url("patients"),
            headers=rest_headers(),
            json={"display_name": display_name, "age": age, "locale": locale},
        )
        rows = check_response(res)
        patient = rows[0] if isinstance(rows, list) else rows
        pid = patient["id"]
        empty_sigma = sigma_to_b64(HebbianMemory(dim=self.sigma_dim, eta=self.eta).sigma)
        sigma_res = self._http.post(
            rest_url("sigma_store"),
            headers=rest_headers(),
            json={"patient_id": pid, "sigma_b64": empty_sigma, "dim": self.sigma_dim},
        )
        check_response(sigma_res)
        return patient

    def get_patient(self, patient_id: str) -> dict[str, Any]:
        res = self._http.get(
            rest_url("patients"),
            headers=rest_headers(),
            params={"id": f"eq.{patient_id}", "select": "*"},
        )
        rows = check_response(res) or []
        if not rows:
            raise HTTPException(404, "patient not found")
        return rows[0]

    def list_visits(self, patient_id: str) -> list[dict[str, Any]]:
        self.get_patient(patient_id)
        res = self._http.get(
            rest_url("visits"),
            headers=rest_headers(),
            params={
                "patient_id": f"eq.{patient_id}",
                "select": "*",
                "order": "created_at.asc",
            },
        )
        return check_response(res) or []

    def add_visit(
        self,
        patient_id: str,
        symptoms_hindi: str,
        doctor_name: str | None,
        bp_sys: int | None,
        bp_dia: int | None,
        medicines: str | None,
    ) -> dict[str, Any]:
        self.get_patient(patient_id)
        res = self._http.post(
            rest_url("visits"),
            headers=rest_headers(),
            json={
                "patient_id": patient_id,
                "symptoms_hindi": symptoms_hindi,
                "doctor_name": doctor_name,
                "bp_sys": bp_sys,
                "bp_dia": bp_dia,
                "medicines": medicines,
            },
        )
        rows = check_response(res)
        return rows[0] if isinstance(rows, list) else rows

    def get_sigma_b64(self, patient_id: str) -> str:
        res = self._http.get(
            rest_url("sigma_store"),
            headers=rest_headers(),
            params={"patient_id": f"eq.{patient_id}", "select": "sigma_b64,dim"},
        )
        rows = check_response(res) or []
        if not rows:
            raise HTTPException(404, "sigma not found for patient")
        return rows[0]["sigma_b64"]

    def load_memory(self, patient_id: str) -> HebbianMemory:
        b64 = self.get_sigma_b64(patient_id)
        mem = HebbianMemory(dim=self.sigma_dim, eta=self.eta)
        mem.load_sigma(b64_to_sigma(b64, self.sigma_dim))
        return mem

    def save_sigma(self, patient_id: str, mem: HebbianMemory) -> str:
        b64 = sigma_to_b64(mem.sigma)
        res = self._http.patch(
            rest_url("sigma_store"),
            headers=rest_headers({"Prefer": "return=minimal"}),
            params={"patient_id": f"eq.{patient_id}"},
            json={"sigma_b64": b64, "dim": self.sigma_dim},
        )
        check_response(res)
        return b64

    def get_memory_meta(self, patient_id: str) -> dict[str, Any]:
        self.get_patient(patient_id)
        res = self._http.get(
            rest_url("sigma_store"),
            headers=rest_headers(),
            params={
                "patient_id": f"eq.{patient_id}",
                "select": "sigma_b64,dim,updated_at",
            },
        )
        rows = check_response(res) or []
        if not rows:
            raise HTTPException(404, "sigma not found for patient")
        visits = self.list_visits(patient_id)
        row = rows[0]
        return {
            "sigma_b64": row["sigma_b64"],
            "dim": row["dim"],
            "updated_at": row.get("updated_at"),
            "visit_count": len(visits),
        }
