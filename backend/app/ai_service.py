"""
AI service buat 5 fitur AI di beacon:
  1. score_lead            -> Lead Scoring
  2. predict_win_probability -> Win Probability
  3. next_best_action       -> Next Best Action
  4. summarize_lead         -> Auto Summarization
  5. predict_churn_risks    -> Churn Prediction

Semua fungsi punya fallback heuristik kalau GROQ_API_KEY kosong atau
call ke API gagal/timeout, biar backend tetap jalan pas development atau
kalau quota API lagi habis. Production sebaiknya selalu set API key asli.
"""

import json
import random
from datetime import datetime, timezone
from typing import Optional

from app.config import settings

try:
    from groq import Grog
except ImportError:  # pragma: no cover
    Groq = None

_client = None


def _get_client():
    global _client
    if not settings.groq_api_key or Groq is None:
        return None
    if _client is None:
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def _ask_json(prompt: str, system: str) -> Optional[dict]:
    """Panggil Claude, minta output JSON murni, parse hasilnya.
    Return None kalau client gak ada / call gagal / parsing gagal
    caller wajib punya fallback."""
    client = _get_client()
    if client is None:
        return None
    try:
        resp = client.messages.create(
            model=settings.ai_model,
            max_tokens=400,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(block.text for block in resp.content if block.type == "text").strip()
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception:
        return None


# ---------- 1. Lead Scoring ----------
def score_lead(lead: dict, interactions: list) -> dict:
    """Return {"score": int 0-100, "reason": str}"""
    system = (
        "Kamu adalah sales AI assistant. Nilai kualitas sebuah lead B2B dari 0-100 "
        "berdasarkan status, sumber, dan histori interaksi. Balas HANYA JSON murni "
        'format {"score": <int>, "reason": "<1 kalimat singkat dalam Bahasa Indonesia>"}.'
    )
    prompt = json.dumps({
        "lead": {
            "status": lead.get("status"),
            "source": lead.get("source"),
            "company": lead.get("company"),
        },
        "jumlah_interaksi": len(interactions),
        "interaksi_terakhir": [i.get("note") for i in interactions[:5]],
    }, ensure_ascii=False)

    result = _ask_json(prompt, system)
    if result and isinstance(result.get("score"), (int, float)):
        return {"score": int(result["score"]), "reason": result.get("reason", "")}

    # ---- fallback heuristik ----
    base = {"new": 40, "contacted": 55, "qualified": 75, "unqualified": 15}.get(lead.get("status"), 40)
    source_bonus = {"Referral": 15, "Event": 10, "Website": 5, "Cold outreach": -10}.get(lead.get("source"), 0)
    interaction_bonus = min(len(interactions) * 4, 20)
    score = max(0, min(100, base + source_bonus + interaction_bonus + random.randint(-5, 5)))
    return {"score": score, "reason": "Estimasi otomatis dari status, sumber, dan jumlah interaksi (mode fallback)."}


# ---------- 2. Win Probability ----------
def predict_win_probability(deal: dict, lead: dict) -> dict:
    system = (
        "Kamu adalah sales AI assistant. Prediksi persentase kemungkinan sebuah deal "
        "B2B akan closed won, berdasarkan stage dan nilai deal. "
        'Balas HANYA JSON murni format {"probability": <int 0-100>}.'
    )
    prompt = json.dumps({
        "stage": deal.get("stage"),
        "value": float(deal.get("value", 0)),
        "lead_status": lead.get("status"),
        "lead_score": lead.get("ai_score"),
    }, ensure_ascii=False)

    result = _ask_json(prompt, system)
    if result and isinstance(result.get("probability"), (int, float)):
        return {"probability": int(result["probability"])}

    # ---- fallback heuristik berbasis stage ----
    base = {
        "baru": 15, "kualifikasi": 40, "proposal": 60,
        "negosiasi": 75, "closed_won": 100, "closed_lost": 0,
    }.get(deal.get("stage"), 20)
    return {"probability": max(0, min(100, base + random.randint(-5, 5)))}


# ---------- 3. Next Best Action ----------
def next_best_action(lead: dict, interactions: list) -> str:
    system = (
        "Kamu adalah sales AI assistant buat tim B2B Indonesia. Kasih SATU rekomendasi "
        "aksi follow-up paling spesifik & actionable buat lead ini (bukan saran generik). "
        "Balas dalam 1 kalimat Bahasa Indonesia santai-profesional, tanpa tanda kutip, tanpa JSON."
    )
    prompt = json.dumps({
        "lead": {"name": lead.get("name"), "company": lead.get("company"), "status": lead.get("status")},
        "interaksi_terakhir": [i.get("note") for i in interactions[:5]],
    }, ensure_ascii=False)

    client = _get_client()
    if client:
        try:
            resp = client.messages.create(
                model=settings.ai_model, max_tokens=150, system=system,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(b.text for b in resp.content if b.type == "text").strip()
            if text:
                return text
        except Exception:
            pass

    # ---- fallback ----
    if not interactions:
        return f"Mulai kontak pertama ke {lead.get('name', 'lead ini')} via WhatsApp atau telepon dalam 24 jam."
    return f"Follow-up ke {lead.get('name', 'lead ini')} dan tanyakan progres keputusan & tawarkan jadwal demo lanjutan."


# ---------- 4. Auto Summarization ----------
def summarize_lead(lead: dict, interactions: list) -> str:
    system = (
        "Kamu adalah sales AI assistant. Ringkas histori komunikasi dengan sebuah lead "
        "jadi 2-3 kalimat Bahasa Indonesia, fokus ke sinyal yang relevan buat closing "
        "(kebutuhan, objection, urgensi). Tanpa JSON, tanpa tanda kutip."
    )
    prompt = json.dumps({
        "lead": {"name": lead.get("name"), "company": lead.get("company")},
        "interaksi": [{"type": i.get("type"), "note": i.get("note")} for i in interactions[:10]],
    }, ensure_ascii=False)

    client = _get_client()
    if client:
        try:
            resp = client.messages.create(
                model=settings.ai_model, max_tokens=200, system=system,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(b.text for b in resp.content if b.type == "text").strip()
            if text:
                return text
        except Exception:
            pass

    # ---- fallback ----
    if not interactions:
        return "Belum ada histori interaksi dengan lead ini."
    return (
        f"Sudah ada {len(interactions)} interaksi dengan {lead.get('name', 'lead ini')}. "
        "Lihat tab timeline di bawah buat detail tiap interaksi."
    )


# ---------- 5. Churn Prediction ----------
def predict_churn_risks(customers: list) -> list:
    """customers: list of dict {lead_id, company, days_since_last_activity, deal_value}
    Return list of {lead_id, company, reason, recommendation}"""
    at_risk_raw = [c for c in customers if c.get("days_since_last_activity", 0) >= 14]
    if not at_risk_raw:
        return []

    system = (
        "Kamu adalah sales AI assistant. Buat catatan singkat risiko churn buat tiap "
        "customer (Bahasa Indonesia, 1 kalimat alasan + 1 kalimat rekomendasi). "
        'Balas HANYA JSON array: [{"lead_id": "...", "reason": "...", "recommendation": "..."}]'
    )
    prompt = json.dumps(at_risk_raw, ensure_ascii=False)

    client = _get_client()
    if client:
        try:
            resp = client.messages.create(
                model=settings.ai_model, max_tokens=600, system=system,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(b.text for b in resp.content if b.type == "text").strip()
            text = text.replace("```json", "").replace("```", "").strip()
            parsed = json.loads(text)
            out = []
            for item in parsed:
                match = next((c for c in at_risk_raw if c["lead_id"] == item.get("lead_id")), None)
                out.append({
                    "lead_id": item.get("lead_id"),
                    "company": match["company"] if match else "",
                    "reason": item.get("reason", ""),
                    "recommendation": item.get("recommendation", ""),
                })
            return out
        except Exception:
            pass

    # ---- fallback heuristik ----
    out = []
    for c in at_risk_raw:
        out.append({
            "lead_id": c["lead_id"],
            "company": c["company"],
            "reason": f"Gak ada aktivitas selama {c['days_since_last_activity']} hari.",
            "recommendation": "Proaktif reach out, tawarkan check-in call atau insentif renewal.",
        })
    return out
