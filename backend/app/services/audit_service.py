from flask import request
from app import db
from app.models.audit_log import AuditLog


def log_action(business_id, actor, action, entity_type=None, entity_id=None, details=None):
    """Records an audit trail entry. Never raises — logging failures should never break the actual request."""
    try:
        entry = AuditLog(
            business_id=business_id,
            actor_id=actor.id if actor else None,
            actor_name=actor.name if actor else "Unknown",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=request.remote_addr if request else None,
        )
        db.session.add(entry)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"AUDIT LOG FAILED (non-fatal): {e}")
