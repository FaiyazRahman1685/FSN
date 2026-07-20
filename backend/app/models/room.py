from typing import Literal

from pydantic import BaseModel, Field, field_validator

Difficulty = Literal["easy", "medium", "hard"]
RoomStatus = Literal["waiting", "playing", "finished"]


class PlayerInput(BaseModel):
    left: bool = False
    right: bool = False
    pass_key: bool = Field(False, alias="pass")

    model_config = {"populate_by_name": True}


class RoomPlayer(BaseModel):
    username: str
    slot: int
    connected: bool = False


class Room(BaseModel):
    code: str
    host_player_id: str
    difficulty: Difficulty
    status: RoomStatus = "waiting"
    seed: int | None = None
    started_at: str | None = None
    players: dict[str, RoomPlayer]


class CreateRoomRequest(BaseModel):
    username: str
    difficulty: Difficulty

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        trimmed = value.strip()[:16]
        if not trimmed:
            raise ValueError("Username is required")
        return trimmed


class JoinRoomRequest(BaseModel):
    username: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        trimmed = value.strip()[:16]
        if not trimmed:
            raise ValueError("Username is required")
        return trimmed


class StartRoomRequest(BaseModel):
    player_id: str


class CreateRoomResponse(BaseModel):
    code: str
    player_id: str
    slot: int
    room: Room


class JoinRoomResponse(BaseModel):
    player_id: str
    slot: int
    room: Room


class StartRoomResponse(BaseModel):
    seed: int
    started_at: str
    room: Room
