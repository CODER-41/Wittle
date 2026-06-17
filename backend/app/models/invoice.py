from datetime import datetime, timezone
from decimal import Decimal
from app import db


class Invoice(db.Model):
    __tablename__ = "invoices"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False)
    invoice_number = db.Column(db.String(20), unique=True, nullable=False)
    status = db.Column(db.String(20), default="draft")  # draft, sent, paid, overdue
    due_date = db.Column(db.Date, nullable=True)
    subtotal = db.Column(db.Numeric(12, 2), default=0)
    tax = db.Column(db.Numeric(12, 2), default=0)
    total = db.Column(db.Numeric(12, 2), default=0)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    items = db.relationship("InvoiceItem", backref="invoice", lazy=True, cascade="all, delete-orphan")

    def calculate_totals(self):
        self.subtotal = sum((item.amount for item in self.items), Decimal("0.00"))
        self.tax = round(self.subtotal * Decimal("0.16"), 2)
        self.total = self.subtotal + self.tax

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "client_id": self.client_id,
            "invoice_number": self.invoice_number,
            "status": self.status,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "subtotal": float(self.subtotal),
            "tax": float(self.tax),
            "total": float(self.total),
            "notes": self.notes,
            "items": [item.to_dict() for item in self.items],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    def __repr__(self):
        return f"<Invoice {self.invoice_number}>"


class InvoiceItem(db.Model):
    __tablename__ = "invoice_items"

    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoices.id"), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    quantity = db.Column(db.Numeric(10, 2), default=1)
    unit_price = db.Column(db.Numeric(12, 2), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "invoice_id": self.invoice_id,
            "description": self.description,
            "quantity": float(self.quantity),
            "unit_price": float(self.unit_price),
            "amount": float(self.amount),
        }

    def __repr__(self):
        return f"<InvoiceItem {self.description}>"