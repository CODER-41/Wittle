import os
from flask import render_template
from weasyprint import HTML
from app.config import Config


def generate_invoice_pdf(invoice, client, business_name):
    html_content = render_template(
        "invoice_pdf.html",
        invoice=invoice,
        client=client,
        business_name=business_name or "Your Business"
    )

    storage_path = Config.PDF_STORAGE_PATH
    os.makedirs(storage_path, exist_ok=True)

    file_path = os.path.join(storage_path, f"{invoice.invoice_number}.pdf")

    HTML(string=html_content).write_pdf(file_path)

    return file_path
