import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()


def make_celery():
    celery = Celery(
        "wittle",
        broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/1"),
        backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2"),
        include=["app.tasks"],
    )
    celery.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="Africa/Nairobi",
        enable_utc=True,
    )
    return celery


celery_app = make_celery()

