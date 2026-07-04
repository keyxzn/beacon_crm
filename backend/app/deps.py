from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import decode_access_token
from app import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesi gak valid, silakan login ulang.",
    )
    if not token:
        raise credentials_exception

    user_id = decode_access_token(token)
    if not user_id:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise credentials_exception

    return user


def require_roles(*roles: str):
    """Dependency factory itu dipakai buat batasi endpoint cuma bisa diakses role tertentu.
    Contoh: Depends(require_roles("admin", "manager"))"""

    def checker(current_user: models.User = Depends(get_current_user)) -> models.User:
        if current_user.role.value not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Kamu gak punya akses ke bagian ini.",
            )
        return current_user

    return checker