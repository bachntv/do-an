from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from jose import jwt, JWTError
from datetime import datetime, timedelta
from pydantic import BaseModel

from models.base import SessionLocal
from models.user import User
from schemas.user import UserUpdate
from .auth_routes import get_current_user
from utils.password import verify_password, hash_password

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Schema for changing password
class PasswordChange(BaseModel):
    current_password: str
    new_password: str

# Get current user profile
@router.get("/me", response_model=UserUpdate)
def get_my_profile(current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "email": current_user.email,
        "birthdate": current_user.birthdate,
        "gender": current_user.gender
    }

# Update current user profile
@router.put("/me")
def update_my_profile(update: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.username = update.username or user.username
    user.email = update.email or user.email
    user.birthdate = update.birthdate or user.birthdate
    user.gender = update.gender or user.gender

    db.commit()
    db.refresh(user)
    return {"message": "Profile updated successfully"}

# Change password
@router.put("/me/password")
def change_password(payload: PasswordChange, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully"}