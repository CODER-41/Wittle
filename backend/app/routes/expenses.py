from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app import db, limiter
from app.models.expense import Expense
from app.utils.permissions import get_business_user_id
from app.services.audit_service import log_action

expenses_bp = Blueprint("expenses", __name__)

VALID_CATEGORIES = ["rent", "utilities", "supplies", "salaries", "marketing", "transport", "other"]


@expenses_bp.route("/", methods=["POST"])
@jwt_required()
@limiter.limit("60 per hour")
def create_expense():
    user, current_user_id = get_business_user_id()
    data = request.get_json()

    if not data:
        return jsonify({"error": "No data provided"}), 400

    description = data.get("description", "").strip()
    amount = data.get("amount")
    category = data.get("category", "other")
    expense_date_str = data.get("expense_date")

    if not description or amount is None:
        return jsonify({"error": "description and amount are required"}), 400

    if category not in VALID_CATEGORIES:
        category = "other"

    try:
        expense_date = datetime.strptime(expense_date_str, "%Y-%m-%d").date() if expense_date_str else datetime.utcnow().date()
    except ValueError:
        return jsonify({"error": "expense_date must be in YYYY-MM-DD format"}), 400

    expense = Expense(
        user_id=current_user_id,
        description=description,
        category=category,
        amount=amount,
        expense_date=expense_date,
        notes=data.get("notes", "").strip(),
    )
    db.session.add(expense)
    db.session.commit()

    log_action(
        business_id=current_user_id,
        actor=user,
        action="expense.created",
        entity_type="expense",
        entity_id=expense.id,
        details=f"Added expense: {expense.description} (KES {expense.amount})",
    )

    return jsonify({"message": "Expense added", "expense": expense.to_dict()}), 201


@expenses_bp.route("/", methods=["GET"])
@jwt_required()
def get_expenses():
    user, current_user_id = get_business_user_id()

    month = request.args.get("month", type=int)
    year = request.args.get("year", type=int)
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)

    query = Expense.query.filter_by(user_id=current_user_id)

    if month and year:
        from sqlalchemy import extract
        query = query.filter(
            extract("month", Expense.expense_date) == month,
            extract("year", Expense.expense_date) == year,
        )

    expenses = query.order_by(Expense.expense_date.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    total_amount = sum(float(e.amount) for e in expenses.items)

    return jsonify({
        "expenses": [e.to_dict() for e in expenses.items],
        "total": expenses.total,
        "total_amount": round(total_amount, 2),
        "page": expenses.page,
        "pages": expenses.pages,
    }), 200


@expenses_bp.route("/<int:expense_id>", methods=["DELETE"])
@jwt_required()
def delete_expense(expense_id):
    user, current_user_id = get_business_user_id()

    expense = Expense.query.filter_by(id=expense_id, user_id=current_user_id).first()
    if not expense:
        return jsonify({"error": "Expense not found"}), 404

    log_action(
        business_id=current_user_id,
        actor=user,
        action="expense.deleted",
        entity_type="expense",
        entity_id=expense.id,
        details=f"Deleted expense: {expense.description}",
    )

    db.session.delete(expense)
    db.session.commit()

    return jsonify({"message": "Expense deleted"}), 200

