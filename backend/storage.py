import boto3
from botocore.client import Config
from .config import settings

_client = None


def get_client():
    global _client
    if _client is None:
        scheme = "https" if settings.minio_use_ssl else "http"
        _client = boto3.client(
            "s3",
            endpoint_url=f"{scheme}://{settings.minio_endpoint}",
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
    return _client


def check_connection() -> bool:
    try:
        get_client().list_buckets()
        return True
    except Exception as e:
        print(f"[MINIO] Connection error: {e}")
        return False


def ensure_bucket() -> None:
    client = get_client()
    try:
        client.head_bucket(Bucket=settings.minio_bucket)
    except Exception:
        client.create_bucket(Bucket=settings.minio_bucket)
        print(f"[MINIO] Bucket '{settings.minio_bucket}' created.")
