from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 7070
    mongodb_uri: str = "mongodb://localhost:27018"
    mongodb_db: str = "autoyt"
    minio_endpoint: str = "localhost:9100"
    minio_access_key: str = "admin"
    minio_secret_key: str = "changeme_autoyt"
    minio_bucket: str = "automation-yt"
    minio_use_ssl: bool = False
    gpu_backend: str = "cpu"


settings = Settings()
