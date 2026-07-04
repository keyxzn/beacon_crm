from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app import models  # noqa: F401 : register semua model ke Base.metadata
from app.config import settings
from app.routers import auth, leads, deals, activities, reports, team

app = FastAPI(title="beacon API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # MVP: bikin tabel langsung dari model kalau belum ada.
    # Kalau schema udah mulai stabil & dipakai banyak orang, ganti ke Alembic migrations.
    Base.metadata.create_all(bind=engine)


app.include_router(auth.router)
app.include_router(leads.router)
app.include_router(deals.router)
app.include_router(activities.router)
app.include_router(reports.router)
app.include_router(team.router)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "beacon-api"}
