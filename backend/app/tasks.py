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