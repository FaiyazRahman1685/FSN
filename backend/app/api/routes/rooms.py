from fastapi import APIRouter, Response, status

from app.api.websocket.constants import TICK_RATE
from app.api.websocket.manager import manager
from app.models.room import (
    CreateRoomRequest,
    CreateRoomResponse,
    JoinRoomRequest,
    JoinRoomResponse,
    StartRoomRequest,
    StartRoomResponse,
)
from app.redis.client import get_redis
from app.services.room_service import RoomService

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=CreateRoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(payload: CreateRoomRequest) -> CreateRoomResponse:
    redis = await get_redis()
    service = RoomService(redis)
    code, player_id, slot, room = await service.create_room(payload.username, payload.difficulty)
    return CreateRoomResponse(code=code, player_id=player_id, slot=slot, room=room)


@router.post("/{code}/join", response_model=JoinRoomResponse)
async def join_room(code: str, payload: JoinRoomRequest) -> JoinRoomResponse:
    redis = await get_redis()
    service = RoomService(redis)
    player_id, slot, room = await service.join_room(code, payload.username)
    return JoinRoomResponse(player_id=player_id, slot=slot, room=room)


@router.get("/{code}")
async def get_room(code: str):
    redis = await get_redis()
    service = RoomService(redis)
    return await service.get_room(code)


@router.post("/{code}/start", response_model=StartRoomResponse)
async def start_room(code: str, payload: StartRoomRequest) -> StartRoomResponse:
    redis = await get_redis()
    service = RoomService(redis)
    seed, started_at, room = await service.start_room(code, payload.player_id)
    await manager.broadcast(
        code,
        {
            "type": "game_start",
            "seed": seed,
            "started_at": started_at,
            "tick_rate": TICK_RATE,
            "room": room.model_dump(),
        },
    )
    return StartRoomResponse(seed=seed, started_at=started_at, room=room)


@router.delete("/{code}/players/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
async def leave_room(code: str, player_id: str) -> Response:
    redis = await get_redis()
    service = RoomService(redis)
    await service.leave_room(code, player_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
