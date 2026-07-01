import os
import hmac
import hashlib
import requests
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db
from app.models.user import User
from app.utils.permissions import get_business_user_id
from datetime import datetime, timezone, timedelta

subscriptions_bp = Blueprint("subscriptions", __name__)

PAYSTACK_SECRET = os.getenv("PAYSTACK_SECRET_KEY")
WITTLE_PRO_PLAN_CODE = os.getenv("WITTLE_PRO_PLAN_CODE", "")  # set after creating plan in Paystack
PRO_MONTHLY_PRICE = 99900  # KES 999 in kobo


@subscriptions_bp.route("/plans", methods=["GET"])
def get_plans():
    return jsonify({
        "plans": [
            {
                "id": "free",
                "name": "Free",
                "price": 0,
                "currency": "KES",
                "features": [
                    "5 invoices per month",
                    "Unlimited clients",
                    "M-Pesa & Card payments",
                    "Client portal",
                    "PDF invoices",
                ]
            },
            {
                "id": "pro",
                "name": "Pro",
                "price": 999,
                "currency": "KES",
                "billing": "monthly",
                "features": [
                    "Unlimited invoices",
                    "Team management",
                    "Recurring invoices",
                    "Expense tracking",
                    "VAT reports",
                    "3 PDF templates",
                    "Priority support",
                ]
            }
        ]
    }), 200


@subscriptions_bp.route("/subscribe", methods=["POST"])
@jwt_required()
def subscribe():
    user, current_user_id = get_business_user_id()

    if user.plan == "pro":
        return jsonify({"error": "Already on Pro plan"}), 400

    data = request.get_json()
    email = data.get("email", user.email)

    headers = {
        "Authorization": f"Bearer {PAYSTACK_SECRET}",
        "Content-Type": "application/json",
    }

    # Initialize transaction
    payload = {
        "email": email,
        "amount": PRO_MONTHLY_PRICE,
        "currency": "KES",
        "callback_url": "http://localhost:5173/settings?subscription=success",
        "metadata": {
            "user_id": user.id,
            "plan": "pro",
            "custom_fields": [
                {"display_name": "Business", "variable_name": "business", "value": user.business_name}
            ]
        }
    }

    if WITTLE_PRO_PLAN_CODE:
        payload["plan"] = WITTLE_PRO_PLAN_CODE

    res = requests.post(
        "https://api.paystack.co/transaction/initialize",
        json=payload,
        headers=headers
    )
    data = res.json()

    if not data.get("status"):
        return jsonify({"error": "Failed to initialize subscription payment"}), 400

    return jsonify({
        "authorization_url": data["data"]["authorization_url"],
        "reference": data["data"]["reference"],
    }), 200


@subscriptions_bp.route("/verify/<reference>", methods=["GET"])
@jwt_required()
def verify_subscription(reference):
    user, current_user_id = get_business_user_id()

    headers = {"Authorization": f"Bearer {PAYSTACK_SECRET}"}
    res = requests.get(
        f"https://api.paystack.co/transaction/verify/{reference}",
        headers=headers
    )
    data = res.json()

    if not data.get("status") or data["data"]["status"] != "success":
        return jsonify({"error": "Payment not successful"}), 400

    # Upgrade user to Pro
    user.plan = "pro"
    user.plan_status = "active"
    user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    db.session.commit()

    return jsonify({
        "message": "Upgraded to Pro successfully",
        "user": user.to_dict()
    }), 200


@subscriptions_bp.route("/cancel", methods=["POST"])
@jwt_required()
def cancel_subscription():
    user, current_user_id = get_business_user_id()

    if user.plan != "pro":
        return jsonify({"error": "Not on Pro plan"}), 400

    user.plan = "free"
    user.plan_status = "cancelled"
    user.paystack_subscription_code = None
    db.session.commit()

    return jsonify({"message": "Subscription cancelled. You'll retain Pro access until end of billing period."}), 200


@subscriptions_bp.route("/webhook", methods=["POST"])
def subscription_webhook():
    # Verify Paystack signature
    signature = request.headers.get("x-paystack-signature", "")
    body = request.get_data()
    expected = hmac.new(
        PAYSTACK_SECRET.encode(),
        body,
        hashlib.sha512
    ).hexdigest()

    if signature != expected:
        return jsonify({"error": "Invalid signature"}), 400

    event = request.get_json()
    event_type = event.get("event")

    if event_type == "charge.success":
        data = event["data"]
        metadata = data.get("metadata", {})
        user_id = metadata.get("user_id")
        plan = metadata.get("plan")

        if user_id and plan == "pro":
            user = User.query.get(int(user_id))
            if user:
                user.plan = "pro"
                user.plan_status = "active"
                user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
                db.session.commit()

    elif event_type == "subscription.disable":
        data = event["data"]
        sub_code = data.get("subscription_code")
        user = User.query.filter_by(paystack_subscription_code=sub_code).first()
        if user:
            user.plan = "free"
            user.plan_status = "expired"
            db.session.commit()

    return jsonify({"status": "ok"}), 200
