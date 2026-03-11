from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import UserCreate, UserRead
from app.services.user_service import create_user

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user_endpoint(user_in: UserCreate, request: Request, db: Session = Depends(get_db)) -> UserRead:
    if not getattr(request.app.state, "database_ready", False):
        raise HTTPException(status_code=503, detail="Database is unavailable. Check DATABASE_URL and network access.")

    user = create_user(db, user_in)
    return UserRead.model_validate(user)