from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/beacon_crm"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 480

    groq_api_key: str = ""
    ai_model: str = "llama3:latest"

    frontend_origin: str = "http://localhost:3000"

    # Verify token buat webhook WA (dipanggil provider kayak Meta Cloud API/Twilio pas ada chat masuk).
    # Ganti lewat .env pas udah connect ke provider WA beneran.
    whatsapp_webhook_token: str = "dev-wa-token-change-me"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
