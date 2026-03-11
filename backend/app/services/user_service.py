from sqlalchemy.orm import Session

from app.models import User
from app.schemas import UserCreate


def create_user(db: Session, user_in: UserCreate) -> User:
    user = User(name=user_in.name, email=user_in.email)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user