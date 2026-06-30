import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db, limiter
from app.models.recurring_invoice import RecurringInvoice
from app.models.client import Client
from app.utils.permissions import get_business_user_id
from app.services.audit_service import log_action

recurring_bp = Blueprint("recurring", __name__)


@recurring_bp.route("/", methods=["POST"])
@jwt_required()
@limiter.limit("30 per hour")
def create_recurring():
    user, current_user_id = get_business_user_id()
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    client_id = data.get("client_id")
    items = data.get("items", [])
    frequency = data.get("frequency", "monthly")
    start_date_str = data.get("start_date")

    if not client_id or not items:
        return jsonify({"error": "client_id and items are required"}), 400

    if frequency not in ["weekly", "monthly"]:
        return jsonify({"error": "frequency must be 'weekly' or 'monthly'"}), 400

    client = Client.query.filter_by(id=client_id, user_id=current_user_id).first()
    if not client:
        return jsonify({"error": "Client not found"}), 404

    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date() if start_date_str else datetime.utcnow().date()
    except ValueError:
        return jsonify({"error": "start_date must be in YYYY-MM-DD format"}), 400

    recurring = RecurringInvoice(
        user_id=current_user_id,
        client_id=client_id,
        frequency=frequency,
        items_json=json.dumps(items),
        notes=data.get("notes", ""),
        next_run_date=start_date,
    )
    db.session.add(recurring)
    db.session.commit()

    log_action(
        business_id=current_user_id,
        actor=user,
        action="recurring_invoice.created",
        entity_type="recurring_invoice",
        entity_id=recurring.id,
        details=f"Created {frequency} recurring invoice for {client.name}",
    )

    return jsonify({"message": "Recurring invoice created", "recurring_invoice": recurring.to_dict()}), 201


@recurring_bp.route("/", methods=["GET"])
@jwt_required()
def get_recurring():
    user, current_user_id = get_business_user_id()

    recurring = RecurringInvoice.query.filter_by(user_id=current_user_id).order_by(
        RecurringInvoice.next_run_date.asc()
    ).all()

    result = []
    for r in recurring:
        d = r.to_dict()
        client = Client.query.get(r.client_id)
        d["client_name"] = client.name if client else "Unknown"
        result.append(d)

    return jsonify({"recurring_invoices": result}), 200


@recurring_bp.route("/<int:recurring_id>", methods=["PATCH"])
@jwt_required()
def toggle_recurring(recurring_id):
    user, current_user_id = get_business_user_id()

    recurring = RecurringInvoice.query.filter_by(id=recurring_id, user_id=current_user_id).first()
    if not recurring:
        return jsonify({"error": "Recurring invoice not found"}), 404

    data = request.get_json()
    if "is_active" in data:
        recurring.is_active = data["is_active"]
        db.session.commit()

    return jsonify({"message": "Updated", "recurring_invoice": recurring.to_dict()}), 200


@recurring_bp.route("/<int:recurring_id>", methods=["DELETE"])
@jwt_required()
def delete_recurring(recurring_id):
    user, current_user_id = get_business_user_id()

    recurring = RecurringInvoice.query.filter_by(id=recurring_id, user_id=current_user_id).first()
    if not recurring:
        return jsonify({"error": "Recurring invoice not found"}), 404

    db.session.delete(recurring)
    db.session.commit()

    return jsonify({"message": "Recurring invoice deleted"}), 200
