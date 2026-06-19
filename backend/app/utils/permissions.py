from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from app.models.user import User


def require_owner(fn):
    """Only the business owner can access this route. Staff are blocked."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user:
            return jsonify({"error": "User not found"}), 404

        if user.role != "owner":
            return jsonify({"error": "Only the business owner can perform this action"}), 403

        return fn(*args, **kwargs)
    return wrapper


def get_business_user_id():
    """Helper to fetch the logged-in user and the business id they operate on."""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    business_id = user.get_business_owner_id() if user else None
    return user, business_id
