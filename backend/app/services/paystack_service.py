import requests
from app.config import Config

PAYSTACK_BASE_URL = "https://api.paystack.co"


def initiate_mpesa_charge(email, amount, phone):
    headers = {
        "Authorization": f"Bearer {Config.PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "email": email,
        "amount": int(amount * 100),  # Paystack expects amount in kobo/cents
        "currency": "KES",
        "mobile_money": {
            "phone": phone,
            "provider": "mpesa",
        },
    }

    response = requests.post(
        f"{PAYSTACK_BASE_URL}/charge",
        json=payload,
        headers=headers,
    )

    return response.json()


def verify_transaction(reference):
    headers = {
        "Authorization": f"Bearer {Config.PAYSTACK_SECRET_KEY}",
    }

    response = requests.get(
        f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
        headers=headers,
    )

    return response.json()
