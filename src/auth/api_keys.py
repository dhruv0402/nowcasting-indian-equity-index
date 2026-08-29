import secrets
import hashlib
import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime
from src.utils.db import Base, get_engine, get_session

class UserAccount(Base):
    __tablename__ = "user_accounts"
    user_id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    tier = Column(String, default="starter")  # starter, pro, enterprise
    api_key_hash = Column(String, unique=True, nullable=False)
    api_key_prefix = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC).replace(tzinfo=None))
    daily_quota = Column(Integer, default=500)
    requests_today = Column(Integer, default=0)

def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode('utf-8')).hexdigest()

def create_user_api_key(email: str, tier: str = "pro") -> dict:
    Base.metadata.create_all(get_engine())
    session = get_session()
    raw_key = f"pulse_{secrets.token_urlsafe(32)}"
    key_hash = hash_api_key(raw_key)
    prefix = raw_key[:12]
    user_id = f"usr_{secrets.token_hex(8)}"
    
    quotas = {"starter": 500, "pro": 10000, "enterprise": 1000000}
    
    existing = session.query(UserAccount).filter_by(email=email).first()
    if existing:
        existing.api_key_hash = key_hash
        existing.api_key_prefix = prefix
        existing.tier = tier
        existing.daily_quota = quotas.get(tier, 500)
        session.commit()
        session.close()
        return {"email": email, "api_key": raw_key, "tier": tier, "prefix": prefix}
        
    user = UserAccount(
        user_id=user_id,
        email=email,
        tier=tier,
        api_key_hash=key_hash,
        api_key_prefix=prefix,
        daily_quota=quotas.get(tier, 500)
    )
    session.add(user)
    session.commit()
    session.close()
    return {"email": email, "api_key": raw_key, "tier": tier, "prefix": prefix}

def verify_api_key(raw_key: str) -> dict:
    if not raw_key:
        return {"valid": False, "error": "API Key is required"}
    key_hash = hash_api_key(raw_key)
    session = get_session()
    user = session.query(UserAccount).filter_by(api_key_hash=key_hash, is_active=True).first()
    if not user:
        session.close()
        return {"valid": False, "error": "Invalid or revoked API Key"}
    res = {
        "valid": True,
        "email": user.email,
        "tier": user.tier,
        "daily_quota": user.daily_quota,
        "requests_today": user.requests_today
    }
    session.close()
    return res

if __name__ == "__main__":
    key_info = create_user_api_key("demo@pulsequant.com", "enterprise")
    print("Generated API Key:", key_info)
