import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_queue: str = os.getenv("REDIS_QUEUE", "docuchain:documents:queue")
    redis_dead_letter_queue: str = os.getenv("REDIS_DLQ", "docuchain:documents:dlq")
    database_url: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres")
    backend_api_url: str = os.getenv("BACKEND_API_URL", "http://localhost:3000")
    max_retries: int = int(os.getenv("MAX_RETRIES", "3"))
    log_level: str = os.getenv("LOG_LEVEL", "INFO")


settings = Settings()

