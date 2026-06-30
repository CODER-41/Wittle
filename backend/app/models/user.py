from datetime import datetime, timezone
from app import db
import bcrypt


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    business_name = db.Column(db.String(150), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    role = db.Column(db.String(20), default="owner")
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    reset_token = db.Column(db.String(100), nullable=True)
    reset_token_expires = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    kra_pin = db.Column(db.String(20), nullable=True)
    invoice_template = db.Column(db.String(20), default="classic")


   
    def set_password(self, password):
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")
    
    def check_password(self, password):
        return bcrypt.checkpw(
            password.encode("utf-8"),
            self.password_hash.encode("utf-8")
        )
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "business_name": self.business_name,
            "is_active": self.is_active,
            "role": self.role,
            "owner_id": self.owner_id,
            "created_at": self.created_at.isoformat(),
            "kra_pin": self.kra_pin,
            "invoice_template": self.invoice_template,
        }

    def get_business_owner_id(self):
        """Returns the user_id whose data this account operates on —
        their own id if they're an owner, or their owner's id if staff."""
        return self.owner_id if self.role == "staff" else self.id
    
    def __repr__(self):
        return f"<User {self.name}>"
