from datetime import datetime, timezone
from app import db


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    business_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    actor_name = db.Column(db.String(100), nullable=True)
    action = db.Column(db.String(50), nullable=False)
    entity_type = db.Column(db.String(50), nullable=True)
    entity_id = db.Column(db.Integer, nullable=True)
    details = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "actor_id": self.actor_id,
            "actor_name": self.actor_name,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "details": self.details,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<AuditLog {self.action} by {self.actor_name}>"
