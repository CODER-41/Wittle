from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, create_access_token, create_refresh_token
from app import db, limiter, mail
from app.models.user import User
from app.models.invite import Invite
from app.utils.permissions import require_owner, get_business_user_id
from flask_mail import Message

team_bp = Blueprint("team", __name__)


@team_bp.route("/invite", methods=["POST"])
@jwt_required()
@require_owner
@limiter.limit("10 per hour")
def invite_staff():
    user, business_id = get_business_user_id()
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    email = data.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "A user with this email already exists"}), 409

    existing_invite = Invite.query.filter_by(owner_id=business_id, email=email, status="pending").first()
    if existing_invite and existing_invite.is_valid():
        return jsonify({"error": "An active invite already exists for this email"}), 409

    invite = Invite(owner_id=business_id, email=email)
    db.session.add(invite)
    db.session.commit()

    invite_link = f"https://wittle.co.ke/accept-invite?token={invite.token}"

    msg = Message(
        subject=f"You've been invited to join {user.business_name or 'a team'} on Wittle",
        recipients=[email],
        body=f"""Hi,

{user.name} has invited you to join their team on Wittle.

Click the link below to accept and set up your account:
{invite_link}

This invite expires in 7 days.

Wittle — Invoicing & Payments for Kenyan Businesses
"""
    )
    mail.send(msg)

    return jsonify({
        "message": "Invite sent successfully",
        "invite": invite.to_dict()
    }), 201


@team_bp.route("/invite/accept", methods=["POST"])
@limiter.limit("10 per hour")
def accept_invite():
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    token = data.get("token", "").strip()
    name = data.get("name", "").strip()
    password = data.get("password", "")

    if not token or not name or not password:
        return jsonify({"error": "token, name and password are required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    invite = Invite.query.filter_by(token=token).first()
    if not invite:
        return jsonify({"error": "Invalid invite link"}), 404

    if not invite.is_valid():
        return jsonify({"error": "This invite has expired or was already used"}), 400

    staff_user = User(
        name=name,
        email=invite.email,
        role="staff",
        owner_id=invite.owner_id,
    )
    staff_user.set_password(password)
    db.session.add(staff_user)

    invite.status = "accepted"
    db.session.commit()

    access_token = create_access_token(identity=str(staff_user.id))
    refresh_token = create_refresh_token(identity=str(staff_user.id))

    return jsonify({
        "message": "Account created successfully. Welcome to the team!",
        "user": staff_user.to_dict(),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }), 201


@team_bp.route("/", methods=["GET"])
@jwt_required()
def list_team():
    user, business_id = get_business_user_id()

    members = User.query.filter(
        db.or_(User.id == business_id, User.owner_id == business_id)
    ).all()

    pending_invites = Invite.query.filter_by(owner_id=business_id, status="pending").all()

    return jsonify({
        "members": [m.to_dict() for m in members],
        "pending_invites": [i.to_dict() for i in pending_invites if i.is_valid()],
    }), 200


@team_bp.route("/<int:staff_id>", methods=["DELETE"])
@jwt_required()
@require_owner
def remove_staff(staff_id):
    user, business_id = get_business_user_id()

    staff_user = User.query.filter_by(id=staff_id, owner_id=business_id, role="staff").first()
    if not staff_user:
        return jsonify({"error": "Staff member not found"}), 404

    db.session.delete(staff_user)
    db.session.commit()

    return jsonify({"message": "Staff member removed"}), 200
