import uuid
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, limiter
from app.models.payment import Payment
from app.models.invoice import Invoice
from app.models.user import User
from app.services.paystack_service import initiate_mpesa_charge, initialize_card_transaction, verify_transaction


payments_bp = Blueprint("payments", __name__)


@payments_bp.route("/mpesa/initiate", methods=["POST"])
@jwt_required()
@limiter.limit("10 per hour")
def initiate_payment():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    invoice_id = data.get("invoice_id")
    phone = data.get("phone", "").strip()

    if not invoice_id or not phone:
        return jsonify({"error": "invoice_id and phone are required"}), 400

    invoice = Invoice.query.filter_by(id=invoice_id, user_id=current_user_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    if invoice.status == "paid":
        return jsonify({"error": "Invoice is already paid"}), 400

    user = User.query.get(current_user_id)
    reference = f"WTL-PAY-{uuid.uuid4().hex[:10]}"

    result = initiate_mpesa_charge(
        email=user.email,
        amount=float(invoice.total),
        phone=phone,
    )
    print("PAYSTACK RAW RESPONSE:", result)

    if not result.get("status"):
        return jsonify({
            "error": "Failed to initiate payment",
            "details": result.get("message", "Unknown error")
        }), 400

    paystack_data = result.get("data", {})

    payment = Payment(
        user_id=current_user_id,
        invoice_id=invoice.id,
        reference=paystack_data.get("reference", reference),
        method="mpesa",
        amount=invoice.total,
        phone=phone,
        status="pending",
        paystack_response=str(paystack_data),
    )
    db.session.add(payment)
    db.session.commit()

    return jsonify({
        "message": "Payment initiated. Check your phone to complete the M-Pesa payment.",
        "payment": payment.to_dict(),
        "display_text": paystack_data.get("display_text", "")
    }), 201


@payments_bp.route("/mpesa/webhook", methods=["POST"])
def paystack_webhook():
    event = request.get_json()

    if not event:
        return jsonify({"error": "No data received"}), 400

    event_type = event.get("event")
    data = event.get("data", {})
    reference = data.get("reference")

    if not reference:
        return jsonify({"error": "No reference in webhook"}), 400

    payment = Payment.query.filter_by(reference=reference).first()
    if not payment:
        return jsonify({"error": "Payment not found"}), 404

    if event_type == "charge.success":
        payment.status = "success"
        invoice = Invoice.query.get(payment.invoice_id)
        if invoice:
            invoice.status = "paid"
        db.session.commit()
    elif event_type == "charge.failed":
        payment.status = "failed"
        db.session.commit()

    return jsonify({"message": "Webhook processed"}), 200


@payments_bp.route("/mpesa/verify/<reference>", methods=["GET"])
@jwt_required()
def verify_payment(reference):
    current_user_id = int(get_jwt_identity())

    payment = Payment.query.filter_by(reference=reference, user_id=current_user_id).first()
    if not payment:
        return jsonify({"error": "Payment not found"}), 404

    result = verify_transaction(reference)
    data = result.get("data", {})
    paystack_status = data.get("status")

    if paystack_status == "success" and payment.status != "success":
        payment.status = "success"
        invoice = Invoice.query.get(payment.invoice_id)
        if invoice:
            invoice.status = "paid"
        db.session.commit()
    elif paystack_status == "failed" and payment.status != "failed":
        payment.status = "failed"
        db.session.commit()

    return jsonify({"payment": payment.to_dict(), "paystack_status": paystack_status}), 200

@payments_bp.route("/card/initiate", methods=["POST"])
@jwt_required()
@limiter.limit("10 per hour")
def initiate_card_payment():
    current_user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    invoice_id = data.get("invoice_id")

    if not invoice_id:
        return jsonify({"error": "invoice_id is required"}), 400

    invoice = Invoice.query.filter_by(id=invoice_id, user_id=current_user_id).first()
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    if invoice.status == "paid":
        return jsonify({"error": "Invoice is already paid"}), 400

    user = User.query.get(current_user_id)
    reference = f"WTL-CARD-{uuid.uuid4().hex[:10]}"

    result = initialize_card_transaction(
        email=user.email,
        amount=float(invoice.total),
        reference=reference,
    )

    if not result.get("status"):
        return jsonify({
            "error": "Failed to initialize card payment",
            "details": result.get("message", "Unknown error")
        }), 400

    paystack_data = result.get("data", {})

    payment = Payment(
        user_id=current_user_id,
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
        "message": "Card payment initialized. Redirect customer to the authorization URL.",
        "payment": payment.to_dict(),
        "authorization_url": paystack_data.get("authorization_url"),
    }), 201

@payments_bp.route("/", methods=["GET"])
@jwt_required()
def get_payments():
    current_user_id = int(get_jwt_identity())

    payments = Payment.query.filter_by(user_id=current_user_id).order_by(Payment.created_at.desc()).all()

    return jsonify({"payments": [p.to_dict() for p in payments]}), 200