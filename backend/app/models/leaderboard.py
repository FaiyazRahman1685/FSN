from typing import Literal

from pydantic import BaseModel, Field, field_validator

Difficulty = Literal["easy", "medium", "hard"]
PlayMode = Literal["single", "multiplayer"]


class HighscoreEntry(BaseModel):
    id: int
    username: str
    score: int
    survival_seconds: float
    difficulty: Difficulty
    play_mode: PlayMode
    room_code: str | None
    created_at: str


class SubmitHighscoreRequest(BaseModel):
    username: str
    score: int = Field(ge=0)
    survival_seconds: float = Field(ge=0)
    difficulty: Difficulty
    play_mode: PlayMode
    room_code: str | None = None

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        trimmed = value.strip()[:16]
        if not trimmed:
            raise ValueError("Username is required")
        return trimmed


class LeaderboardResponse(BaseModel):
    entries: list[HighscoreEntry]
