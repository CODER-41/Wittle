from datetime import datetime, timezone, timedelta
from app import db


class RecurringInvoice(db.Model):
    __tablename__ = "recurring_invoices"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    client_id = db.Column(db.Integer, db.ForeignKey("clients.id"), nullable=False)
    frequency = db.Column(db.String(20), nullable=False, default="monthly")  # monthly, weekly
    items_json = db.Column(db.Text, nullable=False)  # JSON list of {description, quantity, unit_price}
    notes = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    next_run_date = db.Column(db.Date, nullable=False)
    last_run_date = db.Column(db.Date, nullable=True)
    invoices_generated = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "user_id": self.user_id,
            "client_id": self.client_id,
            "frequency": self.frequency,
            "items": json.loads(self.items_json),
            "notes": self.notes,
            "is_active": self.is_active,
            "next_run_date": self.next_run_date.isoformat() if self.next_run_date else None,
            "last_run_date": self.last_run_date.isoformat() if self.last_run_date else None,
            "invoices_generated": self.invoices_generated,
            "created_at": self.created_at.isoformat(),
        }

    def advance_next_run(self):
        if self.frequency == "weekly":
            self.next_run_date = self.next_run_date + timedelta(weeks=1)
        else:  # monthly
            month = self.next_run_date.month
            year = self.next_run_date.year
            day = self.next_run_date.day
            if month == 12:
                new_month, new_year = 1, year + 1
            else:
                new_month, new_year = month + 1, year
            try:
                self.next_run_date = self.next_run_date.replace(year=new_year, month=new_month, day=day)
            except ValueError:
                # handle e.g. Jan 31 -> Feb (no 31st)
                from calendar import monthrange
                last_day = monthrange(new_year, new_month)[1]
                self.next_run_date = self.next_run_date.replace(year=new_year, month=new_month, day=last_day)

    def __repr__(self):
        return f"<RecurringInvoice client_id={self.client_id} {self.frequency}>"
