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

    pdf_path = generate_invoice_pdf(invoice, client, user.business_name)

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