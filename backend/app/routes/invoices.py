from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, limiter
from decimal import Decimal
from app.models.invoice import Invoice, InvoiceItem
from app.models.client import Client
from flask import send_file
from app.services.pdf_service import generate_invoice_pdf
from app.services.email_service import send_invoice_email
from app.utils.permissions import get_business_user_id
from app.utils.permissions import require_owner
from app.services.audit_service import log_action
from app.tasks import send_invoice_email_task
from app.models.user import User
import secrets
from sqlalchemy import func, extract

invoices_bp = Blueprint("invoices", __name__)


def generate_invoice_number(user_id):
    count = Invoice.query.filter_by(user_id=user_id).count() + 1
    return f"WTL-{count:04d}"


@invoices_bp.route("/", methods=["POST"])
@jwt_required()
@limiter.limit("30 per hour")
def create_invoice():
    user, current_user_id = get_business_user_id()
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    client_id = data.get("client_id")
    items_data = data.get("items", [])

    if not client_id:
        return jsonify({"error": "client_id is required"}), 400

    if not items_data or len(items_data) == 0:
        return jsonify({"error": "At least one invoice item is required"}), 400

    client = Client.query.filter_by(id=client_id, user_id=current_user_id).first()
    if not client:
        return jsonify({"error": "Client not found"}), 404

    due_date = None
    if data.get("due_date"):
        try:
            due_date = datetime.strptime(data["due_date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "due_date must be in YYYY-MM-DD format"}), 400

    invoice = Invoice(
        user_id=current_user_id,
        client_id=client_id,
        invoice_number=generate_invoice_number(current_user_id),
        status="draft",
        due_date=due_date,
        notes=data.get("notes", "").strip(),
    )
    db.session.add(invoice)
    db.session.flush()  # get invoice.id before committing

    for item in items_data:
        description = item.get("description", "").strip()
        quantity = item.get("quantity", 1)
        unit_price = item.get("unit_price", 0)

        if not description:
            return jsonify({"error": "Each item must have a description"}), 400

        amount = Decimal(str(quantity)) * Decimal(str(unit_price))

        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            description=description,
            quantity=quantity,
            unit_price=unit_price,
            amount=amount,
        )
        db.session.add(invoice_item)

    db.session.flush()
    invoice.calculate_totals()
    db.session.commit()

    return jsonify({
        "message": "Invoice created successfully",
        "invoice": invoice.to_dict()
    }), 201


@invoices_bp.route("/", methods=["GET"])
@jwt_required()
@limiter.limit("60 per minute")
def get_invoices():
    user, current_user_id = get_business_user_id()

    status_filter = request.args.get("status")
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)

    query = Invoice.query.filter_by(user_id=current_user_id)

    if status_filter:
        query = query.filter_by(status=status_filter)

    invoices = query.order_by(Invoice.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "invoices": [inv.to_dict() for inv in invoices.items],
        "total": invoices.total,
        "page": invoices.page,
        "pages": invoices.pages,
    }), 200


@invoices_bp.route("/<int:invoice_id>", methods=["GET"])
@jwt_required()
def get_invoice(invoice_id):
    user, current_user_id = get_business_user_id()

    invoice = Invoice.query.filter_by(id=invoice_id, user_id=current_user_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    return jsonify({"invoice": invoice.to_dict()}), 200


@invoices_bp.route("/<int:invoice_id>/pdf", methods=["GET"])
@jwt_required()
@limiter.limit("20 per hour")
def download_invoice_pdf(invoice_id):
    user, current_user_id = get_business_user_id()

    invoice = Invoice.query.filter_by(id=invoice_id, user_id=current_user_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    client = Client.query.get(invoice.client_id)

    pdf_path = generate_invoice_pdf(invoice, client, user.business_name, user.invoice_template)

    return send_file(pdf_path, as_attachment=True, download_name=f"{invoice.invoice_number}.pdf")


@invoices_bp.route("/<int:invoice_id>/send", methods=["POST"])
@jwt_required()
@limiter.limit("20 per hour")
def send_invoice(invoice_id):
    user, current_user_id = get_business_user_id()

    invoice = Invoice.query.filter_by(id=invoice_id, user_id=current_user_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    client = Client.query.get(invoice.client_id)

    if not client.email:
        return jsonify({"error": "Client has no email address"}), 400

    send_invoice_email_task.delay(invoice.id, current_user_id)

    if invoice.status == "draft":
        invoice.status = "sent"
        db.session.commit()

    log_action(
        business_id=current_user_id,
        actor=user,
        action="invoice.sent",
        entity_type="invoice",
        entity_id=invoice.id,
        details=f"Queued invoice {invoice.invoice_number} for sending to {client.email}",
    )

    return jsonify({
        "message": "Invoice is being sent in the background",
        "invoice": invoice.to_dict()
    }), 202


@invoices_bp.route("/<int:invoice_id>", methods=["PUT"])
@jwt_required()
def update_invoice(invoice_id):
    user, current_user_id = get_business_user_id()

    invoice = Invoice.query.filter_by(id=invoice_id, user_id=current_user_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    if "notes" in data:
        invoice.notes = data["notes"]

    if "due_date" in data and data["due_date"]:
        try:
            invoice.due_date = datetime.strptime(data["due_date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "due_date must be in YYYY-MM-DD format"}), 400

    if "items" in data:
        # remove old items and replace
        for item in invoice.items:
            db.session.delete(item)
        db.session.flush()

        for item_data in data["items"]:
            description = item_data.get("description", "").strip()
            quantity = item_data.get("quantity", 1)
            unit_price = item_data.get("unit_price", 0)
            amount = Decimal(str(quantity)) * Decimal(str(unit_price))

            new_item = InvoiceItem(
                invoice_id=invoice.id,
                description=description,
                quantity=quantity,
                unit_price=unit_price,
                amount=amount,
            )
            db.session.add(new_item)

        db.session.flush()
        invoice.calculate_totals()

    db.session.commit()

    return jsonify({
        "message": "Invoice updated successfully",
        "invoice": invoice.to_dict()
    }), 200


@invoices_bp.route("/<int:invoice_id>/status", methods=["PATCH"])
@jwt_required()
def update_invoice_status(invoice_id):
    user, current_user_id = get_business_user_id()

    invoice = Invoice.query.filter_by(id=invoice_id, user_id=current_user_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    data = request.get_json()
    new_status = data.get("status")

    valid_statuses = ["draft", "sent", "paid", "overdue"]
    if new_status not in valid_statuses:
        return jsonify({"error": f"Status must be one of {valid_statuses}"}), 400

    invoice.status = new_status
    db.session.commit()

    return jsonify({
        "message": "Invoice status updated",
        "invoice": invoice.to_dict()
    }), 200


@invoices_bp.route("/<int:invoice_id>", methods=["DELETE"])
@jwt_required()
@require_owner
def delete_invoice(invoice_id):
    user, current_user_id = get_business_user_id()

    invoice = Invoice.query.filter_by(id=invoice_id, user_id=current_user_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    log_action(
        business_id=current_user_id,
        actor=user,
        action="invoice.deleted",
        entity_type="invoice",
        entity_id=invoice.id,
        details=f"Deleted invoice: {invoice.invoice_number}",
    )

    db.session.delete(invoice)
    db.session.commit()

    return jsonify({"message": "Invoice deleted successfully"}), 200


@invoices_bp.route("/<int:invoice_id>/portal", methods=["POST"])
@jwt_required()
def generate_portal_link(invoice_id):
    user, current_user_id = get_business_user_id()

    invoice = Invoice.query.filter_by(id=invoice_id, user_id=current_user_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    if not invoice.portal_token:
        invoice.portal_token = secrets.token_urlsafe(32)
        db.session.commit()

    return jsonify({
        "portal_token": invoice.portal_token,
        "portal_url": f"http://localhost:5173/portal/{invoice.portal_token}"
    }), 200


@invoices_bp.route("/portal/<token>", methods=["GET"])
def get_portal_invoice(token):
    db.session.execute(db.text("SET app.current_business_id = '0'"))

    invoice = Invoice.query.filter_by(portal_token=token).first()
    if not invoice:
        return jsonify({"error": "Invalid or expired portal link"}), 404

    db.session.execute(
        db.text("SET app.current_business_id = :bid"),
        {"bid": str(invoice.user_id)}
    )

    client = Client.query.get(invoice.client_id)
    user = User.query.get(invoice.user_id)

    return jsonify({
        "invoice": invoice.to_dict(),
        "client": {"name": client.name if client else "Client"},
        "business": {"name": user.business_name or "Business"}
    }), 200

@invoices_bp.route("/portal/<token>/pay/mpesa", methods=["POST"])
def portal_pay_mpesa(token):
    invoice = Invoice.query.filter_by(portal_token=token).first()
    if not invoice:
        return jsonify({"error": "Invalid portal link"}), 404

    if invoice.status == "paid":
        return jsonify({"error": "Invoice already paid"}), 400

    data = request.get_json()
    phone = data.get("phone", "").strip()
    if not phone:
        return jsonify({"error": "Phone number is required"}), 400

    from app.services.paystack_service import initiate_mpesa_charge
    result = initiate_mpesa_charge(phone, float(invoice.total), invoice.invoice_number)

    if not result.get("status"):
        return jsonify({"error": "Failed to initiate payment"}), 400

    from app.models.payment import Payment
    paystack_data = result.get("data", {})
    payment = Payment(
        user_id=invoice.user_id,
        invoice_id=invoice.id,
        reference=paystack_data.get("reference", ""),
        method="mpesa",
        amount=invoice.total,
        status="pending",
        phone=phone,
        paystack_response=str(paystack_data),
    )
    db.session.add(payment)
    db.session.commit()

    return jsonify({
        "message": "Payment request sent to your phone",
        "reference": payment.reference
    }), 201


@invoices_bp.route("/portal/<token>/pay/card", methods=["POST"])
def portal_pay_card(token):
    invoice = Invoice.query.filter_by(portal_token=token).first()
    if not invoice:
        return jsonify({"error": "Invalid portal link"}), 404

    if invoice.status == "paid":
        return jsonify({"error": "Invoice already paid"}), 400

    data = request.get_json()
    email = data.get("email", "").strip()
    if not email:
        return jsonify({"error": "Email is required for card payment"}), 400

    from app.services.paystack_service import initialize_card_transaction
    import uuid
    reference = f"WTL-PORTAL-{uuid.uuid4().hex[:10]}"
    result = initialize_card_transaction(email, float(invoice.total), reference)

    if not result.get("status"):
        return jsonify({"error": "Failed to initialize payment"}), 400

    from app.models.payment import Payment
    paystack_data = result.get("data", {})
    payment = Payment(
        user_id=invoice.user_id,
        invoice_id=invoice.id,
        reference=paystack_data.get("reference", reference),
        method="card",
        amount=invoice.total,
        status="pending",
        paystack_response=str(paystack_data),
    )
    db.session.add(payment)
    db.session.commit()

    return jsonify({
        "authorization_url": paystack_data.get("authorization_url"),
        "reference": payment.reference
    }), 201
@invoices_bp.route("/vat-report", methods=["GET"])
@jwt_required()
def vat_report():
    user, current_user_id = get_business_user_id()

    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)

    if not month or not year:
        return jsonify({"error": "month and year query parameters are required"}), 400

    invoices = Invoice.query.filter(
        Invoice.user_id == current_user_id,
        Invoice.status == "paid",
        extract("month", Invoice.created_at) == month,
        extract("year", Invoice.created_at) == year,
    ).order_by(Invoice.created_at.asc()).all()

    total_subtotal = sum(float(inv.subtotal) for inv in invoices)
    total_vat = sum(float(inv.tax) for inv in invoices)
    total_gross = sum(float(inv.total) for inv in invoices)

    return jsonify({
        "month": month,
        "year": year,
        "business_name": user.business_name,
        "kra_pin": user.kra_pin,
        "invoice_count": len(invoices),
        "total_subtotal": round(total_subtotal, 2),
        "total_vat_collected": round(total_vat, 2),
        "total_gross": round(total_gross, 2),
        "invoices": [
            {
                "invoice_number": inv.invoice_number,
                "date": inv.created_at.strftime("%Y-%m-%d"),
                "subtotal": float(inv.subtotal),
                "vat": float(inv.tax),
                "total": float(inv.total),
            }
            for inv in invoices
        ]
    }), 200