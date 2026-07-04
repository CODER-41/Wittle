import re


def validate_email(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email.strip()))


def validate_positive_number(value) -> bool:
    try:
        return float(value) > 0
    except (TypeError, ValueError):
        return False


def sanitize_string(value: str, max_length: int = 255) -> str:
    return str(value).strip()[:max_length]


def validate_password(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    return True, ""


def validate_phone(phone: str) -> bool:
    cleaned = re.sub(r'[\s\-\+]', '', phone)
    return cleaned.isdigit() and 9 <= len(cleaned) <= 13