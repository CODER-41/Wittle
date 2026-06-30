from app import db
from app.celery_app import celery_app
from app import create_app
from app.models.invoice import Invoice
from app.models.client import Client
from app.models.user import User
from app.models.payment import Payment
from app.services.pdf_service import generate_invoice_pdf
from app.services.email_service import send_invoice_email, send_payment_receipt_email


def set_tenant_context(business_id):
    db.session.execute(
        db.text("SET LOCAL app.current_business_id = :bid"),
        {"bid": str(business_id)}
    )


@celery_app.task(name="app.tasks.send_invoice_email_task")
def send_invoice_email_task(invoice_id, business_id):
    app = create_app("production")
    with app.app_context():
        set_tenant_context(business_id)

        invoice = Invoice.query.get(invoice_id)
        if not invoice:
            return {"success": False, "error": "Invoice not found"}

        client = Client.query.get(invoice.client_id)
        user = User.query.get(invoice.user_id)

        pdf_path = generate_invoice_pdf(invoice, client, user.business_name, user.invoice_template)
        success, message = send_invoice_email(invoice, client, pdf_path, user.business_name)

        return {"success": success, "message": message}


@celery_app.task(name="app.tasks.send_payment_receipt_task")
def send_payment_receipt_task(payment_id, business_id):
    app = create_app("production")
    with app.app_context():
        set_tenant_context(business_id)

        payment = Payment.query.get(payment_id)
        if not payment:
            return {"success": False, "error": "Payment not found"}

        invoice = Invoice.query.get(payment.invoice_id)
        client = Client.query.get(invoice.client_id)
        user = User.query.get(invoice.user_id)

        success, message = send_payment_receipt_email(payment, invoice, client, user.business_name)
        return {"success": success, "message": message}



@celery_app.task(name="app.tasks.process_recurring_invoices")
def process_recurring_invoices():
    app = create_app("production")
    with app.app_context():
        from datetime import datetime
        import json
        from app.models.recurring_invoice import RecurringInvoice
        from app.models.invoice import Invoice, InvoiceItem
        from decimal import Decimal

        today = datetime.utcnow().date()

        db.session.execute(db.text("SET app.current_business_id = '0'"))

        due = RecurringInvoice.query.filter(
            RecurringInvoice.is_active == True,
            RecurringInvoice.next_run_date <= today,
        ).all()
        results = []
        for recurring in due:
            set_tenant_context(recurring.user_id)

            count = Invoice.query.filter_by(user_id=recurring.user_id).count() + 1
            invoice_number = f"WTL-{count:04d}"

            invoice = Invoice(
                user_id=recurring.user_id,
                client_id=recurring.client_id,
                invoice_number=invoice_number,
                status="draft",
                notes=recurring.notes,
            )
            db.session.add(invoice)
            db.session.flush()

            items = json.loads(recurring.items_json)
            for item in items:
                amount = Decimal(str(item["quantity"])) * Decimal(str(item["unit_price"]))
                invoice_item = InvoiceItem(
                    invoice_id=invoice.id,
                    description=item["description"],
                    quantity=item["quantity"],
                    unit_price=item["unit_price"],
                    amount=amount,
                )
                db.session.add(invoice_item)

            db.session.flush()
            invoice.calculate_totals()

            recurring.last_run_date = today
            recurring.invoices_generated += 1
            recurring.advance_next_run()

            db.session.commit()
            results.append(invoice.invoice_number)

        return {"generated": results, "count": len(results)}