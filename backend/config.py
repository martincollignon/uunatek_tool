"""Application configuration."""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    # CORS origins - dynamic localhost ports handled by DynamicCORSMiddleware in main.py
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Gemini API
    gemini_api_key: Optional[str] = None

    # Plotter Settings
    plotter_port: Optional[str] = None  # Auto-detect if not set
    plotter_baud_rate: int = 115200

    # Pen Settings (mm)
    pen_up_height: float = 0.5
    pen_down_height: float = 5.0

    # Speed Settings (mm/min)
    pen_down_speed: int = 2000
    pen_up_speed: int = 8000

    # Safety Margin (mm) - prevents plotting within this distance from paper edge
    safety_margin_mm: float = 3.0

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Get cached settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
