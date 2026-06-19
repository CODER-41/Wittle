from flask_mail import Message
from app import mail


def send_invoice_email(invoice, client, pdf_path, business_name):
    if not client.email:
        return False, "Client has no email address"

    subject = f"Invoice {invoice.invoice_number} from {business_name}"

    body = f"""Hi {client.name},

Please find attached invoice {invoice.invoice_number} for KES {float(invoice.total):,.2f}.

Due date: {invoice.due_date.strftime('%d %B %Y') if invoice.due_date else 'N/A'}

{f'Notes: {invoice.notes}' if invoice.notes else ''}

Thank you for your business.

{business_name}
Powered by Wittle
"""

    msg = Message(
        subject=subject,
        recipients=[client.email],
        body=body,
    )

    with open(pdf_path, "rb") as f:
        msg.attach(
            filename=f"{invoice.invoice_number}.pdf",
            content_type="application/pdf",
            data=f.read(),
        )

    mail.send(msg)
    return True, "Email sent successfully"


def send_payment_receipt_email(payment, invoice, client, business_name):
    if not client.email:
        return False, "Client has no email address"

    subject = f"Payment Receipt — Invoice {invoice.invoice_number}"

    body = f"""Hi {client.name},

We've received your payment of KES {float(payment.amount):,.2f} for invoice {invoice.invoice_number}.

Payment method: {payment.method.upper()}
Reference: {payment.reference}

Thank you for your business.

{business_name}
Powered by Wittle
"""

    msg = Message(
        subject=subject,
        recipients=[client.email],
        body=body,
    )

    mail.send(msg)
    return True, "Receipt sent successfully"
