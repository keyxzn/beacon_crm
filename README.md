# beacon CRM internal tim sales B2B

CRM internal dengan 5 fitur AI bawaan (Lead Scoring, Win Probability, Next Best
Action, Auto Summarization, Churn Prediction), dibangun dengan stack Next.js +
FastAPI + PostgreSQL sama kayak pattern HRCheck.

Desain (warna, tipografi, komponen) udah di-approve Mas Firman lewat mockup
`beacon-crm-mockup.html` sebelumnya. Semua halaman di sini ngikutin sistem
desain itu persis: dark navy (`#0A0E16`), signal cyan (`#00E5FF`), AI gradient
(violet → pink → cyan) khusus elemen hasil AI, font Sora + Inter.

## Struktur folder

```
beacon-crm/
├── backend/                 FastAPI + SQLAlchemy + PostgreSQL
│   ├── app/
│   │   ├── models.py        User, Lead, Deal, Activity, Interaction
│   │   ├── schemas.py       Pydantic request/response
│   │   ├── ai_service.py    5 fitur AI (Claude API + fallback heuristik)
│   │   ├── routers/         auth, leads, deals, activities, reports, team
│   │   ├── seed.py          data demo (jalanin: python -m app.seed)
│   │   └── main.py          entrypoint
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/                 Next.js 16 (App Router) + TypeScript
    ├── app/
    │   ├── login/
    │   └── (app)/            dashboard, leads, leads/[id], pipeline,
    │                         activities, reports, settings
    ├── components/           Sidebar, Topbar, AIPanel, ScoreBar, TaskRow, dst
    ├── lib/                  api.ts (fetch wrapper), auth.tsx (auth context)
    └── package.json
```

## 5 fitur AI di mana letaknya

| Fitur | Lokasi | File backend |
|---|---|---|
| Lead Scoring | Leads, Dashboard | `ai_service.score_lead` |
| Win Probability | Pipeline | `ai_service.predict_win_probability` |
| Next Best Action | Dashboard, Detail Kontak | `ai_service.next_best_action` |
| Auto Summarization | Detail Kontak | `ai_service.summarize_lead` |
| Churn Prediction | Reports | `ai_service.predict_churn_risks` |

Semua fungsi di `ai_service.py` punya **fallback heuristik** kalau
`GROQ_API_KEY` belum diisi di `.env`, app tetap jalan normal pakai
estimasi berbasis aturan, gak crash. Begitu API key asli diisi, otomatis
switch ke Claude API (model `claude-haiku-4-5-20251001`, sama kayak pattern
HRCheck).

## Status

Udah ditest end-to-end di environment dev:
- Backend: semua endpoint (auth, leads, deals, activities, reports, team)
  jalan, termasuk ke-5 fitur AI dalam mode fallback.
- Frontend: `npm run build` clean, 0 error TypeScript, semua 10 route
  ke-generate dengan benar.
- Login demo: `dimas@beacon.id` / `dimas123` (lihat `app/seed.py` buat
  user lain : Daniel/admin, Nadia/manager, Rizky & Fajar/sales).

## Yang belum / next iteration

- Drag-and-drop di Kanban Pipeline (sekarang pindah stage pakai dropdown)
- Notifikasi di Settings baru UI, belum persist ke backend
- Alembic migration (sekarang masih `create_all`, oke buat tahap awal,
  ganti begitu schema mulai stabil & datanya udah berharga)
- Role-based permission per endpoint (sekarang semua user yang login bisa
  akses semua data itu perlu ditambah pengecekan role admin/manager/sales)

## Referensi setup (buat kapan-kapan butuh)

Backend: `cd backend`, `pip install -r requirements.txt --break-system-packages`,
copy `.env.example` ke `.env`, isi `DATABASE_URL` & `GROQ_API_KEY`,
`python -m app.seed`, lalu `uvicorn app.main:app --reload`.

Frontend: `cd frontend`, `npm install`, copy `.env.local.example` ke
`.env.local`, `npm run dev`.
