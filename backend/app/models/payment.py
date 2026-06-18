from datetime import datetime, timezone
from app import db


class Payment(db.Model):
    __tablename__ = "payments"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoices.id"), nullable=False)
    reference = db.Column(db.String(100), unique=True, nullable=False)
    method = db.Column(db.String(20), default="mpesa")
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    status = db.Column(db.String(20), default="pending")  # pending, success, failed
    paystack_response = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "invoice_id": self.invoice_id,
            "reference": self.reference,
            "method": self.method,
            "amount": float(self.amount),
            "phone": self.phone,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<Payment {self.reference}>"
