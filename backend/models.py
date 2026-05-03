from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class ChannelCreate(BaseModel):
    url: str
    name: Optional[str] = None
    active: bool = True
    formats: list[Literal["short", "long"]] = ["short"]
    job_hour: int = 12
    job_minute: int = 0
    upload_hour: int = 14
    upload_minute: int = 0
    max_clips: int = 6


class ChannelOut(ChannelCreate):
    id: str
    created_at: datetime


class AppSettings(BaseModel):
    # LLM
    llm_provider: Literal["openai", "llamacpp"] = "openai"
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    llamacpp_model_path: Optional[str] = None
    llamacpp_n_ctx: int = 4096
    llamacpp_n_gpu_layers: int = -1  # -1 = all layers on GPU

    # Whisper
    whisper_model: Literal["tiny", "base", "small", "medium", "large-v3"] = "base"
    whisper_device_override: Optional[str] = None  # override auto-detect

    # YouTube OAuth2
    youtube_client_id: Optional[str] = None
    youtube_client_secret: Optional[str] = None
    youtube_refresh_token: Optional[str] = None

    # LLM prompt (None = use built-in podcast default)
    llm_prompt: Optional[str] = None

    # Pipeline limits
    max_clips_per_run: int = 6
    clip_min_duration: int = 15
    clip_max_duration: int = 120
    long_clip_min_duration: int = 300
    long_clip_max_duration: int = 600
    daily_short_uploads: int = 9
    daily_long_uploads: int = 1
    clip_ttl_days: int = 7
