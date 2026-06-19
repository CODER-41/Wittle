import secrets
from datetime import datetime, timezone, timedelta
from app import db


class Invite(db.Model):
    __tablename__ = "invites"

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    email = db.Column(db.String(150), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False, default=lambda: secrets.token_urlsafe(32))
    status = db.Column(db.String(20), default="pending")  # pending, accepted, expired
    expires_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc) + timedelta(days=7))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def is_valid(self):
        if self.status != "pending":
            return False
        expires = self.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return expires > datetime.now(timezone.utc)

    def to_dict(self):
        return {
            "id": self.id,
            "owner_id": self.owner_id,
            "email": self.email,
            "status": self.status,
            "expires_at": self.expires_at.isoformat(),
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Invite {self.email}>"
