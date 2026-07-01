from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, limiter
from app.models.client import Client
from app.utils.permissions import get_business_user_id
from app.utils.permissions import require_owner
from app.services.audit_service import log_action
from flask import send_file
import io
from datetime import datetime
from app.models.invoice import Invoice

clients_bp = Blueprint("clients", __name__)


@clients_bp.route("/", methods=["POST"])
@jwt_required()
@limiter.limit("60 per minute")
def create_client():
    user, current_user_id = get_business_user_id()
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Client name is required"}), 400

    client = Client(
        user_id=current_user_id,
        name=name,
        email=data.get("email", "").strip().lower(),
        phone=data.get("phone", "").strip(),
        address=data.get("address", "").strip(),
        notes=data.get("notes", "").strip(),
    )

    db.session.add(client)
    db.session.commit()
    log_action(
        business_id=current_user_id,
        actor=user,
        action="client.created",
        entity_type="client",
        entity_id=client.id,
        details=f"Created client: {client.name}",
    )

    return jsonify({
        "message": "Client created successfully",
        "client": client.to_dict()
    }), 201


@clients_bp.route("/", methods=["GET"])
@jwt_required()
@limiter.limit("60 per minute")
def get_clients():
    user, current_user_id = get_business_user_id()

    search = request.args.get("search", "").strip()
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 10, type=int)

    query = Client.query.filter_by(user_id=current_user_id)

    if search:
        query = query.filter(
            db.or_(
                Client.name.ilike(f"%{search}%"),
                Client.email.ilike(f"%{search}%")
            )
        )

    clients = query.order_by(Client.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    return jsonify({
        "clients": [c.to_dict() for c in clients.items],
        "total": clients.total,
        "page": clients.page,
        "pages": clients.pages,
        "per_page": clients.per_page,
    }), 200


@clients_bp.route("/<int:client_id>", methods=["GET"])
@jwt_required()
def get_client(client_id):
    user, current_user_id = get_business_user_id()

    client = Client.query.filter_by(
        id=client_id,
        user_id=current_user_id
    ).first()

    if not client:
        return jsonify({"error": "Client not found"}), 404

    return jsonify({"client": client.to_dict()}), 200


@clients_bp.route("/<int:client_id>", methods=["PUT"])
@jwt_required()
def update_client(client_id):
    user, current_user_id = get_business_user_id()

    client = Client.query.filter_by(
        id=client_id,
        user_id=current_user_id
    ).first()

    if not client:
        return jsonify({"error": "Client not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    client.name = data.get("name", client.name).strip()
    client.email = data.get("email", client.email)
    client.phone = data.get("phone", client.phone)
    client.address = data.get("address", client.address)
    client.notes = data.get("notes", client.notes)

    db.session.commit()
    log_action(
        business_id=current_user_id,
        actor=user,
        action="client.updated",
        entity_type="client",
        entity_id=client.id,
        details=f"Updated client: {client.name}",
    )

    return jsonify({
        "message": "Client updated successfully",
        "client": client.to_dict()
    }), 200


@clients_bp.route("/<int:client_id>", methods=["DELETE"])
@jwt_required()
@require_owner
def delete_client(client_id):
    user, current_user_id = get_business_user_id()

    client = Client.query.filter_by(
        id=client_id,
        user_id=current_user_id
    ).first()

    if not client:
        return jsonify({"error": "Client not found"}), 404
    

    log_action(
        business_id=current_user_id,
        actor=user,
        action="client.deleted",
        entity_type="client",
        entity_id=client.id,
        details=f"Deleted client: {client.name}",
    )

    db.session.delete(client)
    db.session.commit()

    return jsonify({"message": "Client deleted successfully"}), 200

@clients_bp.route("/<int:client_id>/statement", methods=["GET"])
@jwt_required()
def client_statement(client_id):
    user, current_user_id = get_business_user_id()

    client = Client.query.filter_by(id=client_id, user_id=current_user_id).first()
    if not client:
        return jsonify({"error": "Client not found"}), 404

    from_date_str = request.args.get("from_date")
    to_date_str = request.args.get("to_date")

    query = Invoice.query.filter_by(client_id=client_id, user_id=current_user_id)

    try:
        if from_date_str:
            from_date = datetime.strptime(from_date_str, "%Y-%m-%d").date()
            query = query.filter(Invoice.created_at >= from_date_str)
        if to_date_str:
            to_date = datetime.strptime(to_date_str, "%Y-%m-%d").date()
            query = query.filter(Invoice.created_at <= to_date_str + " 23:59:59")
    except ValueError:
        return jsonify({"error": "Dates must be in YYYY-MM-DD format"}), 400

    invoices = query.order_by(Invoice.created_at.asc()).all()

    total_billed = sum(float(inv.total) for inv in invoices)
    total_paid = sum(float(inv.total) for inv in invoices if inv.status == "paid")
    total_outstanding = total_billed - total_paid

    from flask import render_template
    from weasyprint import HTML

    html_content = render_template(
        "client_statement.html",
        client=client,
        business_name=user.business_name or "Your Business",
        invoices=invoices,
        total_billed=total_billed,
        total_paid=total_paid,
        total_outstanding=total_outstanding,
        from_date=from_date_str or "All time",
        to_date=to_date_str or datetime.utcnow().strftime("%Y-%m-%d"),
        generated_at=datetime.utcnow().strftime("%d %B %Y"),
    )

    pdf_bytes = HTML(string=html_content).write_pdf()
    pdf_io = io.BytesIO(pdf_bytes)
    pdf_io.seek(0)

    return send_file(
        pdf_io,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=f"statement_{client.name.replace(' ', '_')}.pdf",
    )