import json
import random
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from redis.asyncio import Redis

from app.config import settings
from app.models.room import Room, RoomPlayer


def _room_key(code: str) -> str:
    return f"room:{code}"


def _player_key(player_id: str) -> str:
    return f"player:{player_id}"


def _serialize_room(room: Room) -> str:
    return room.model_dump_json()


def _deserialize_room(raw: str) -> Room:
    return Room.model_validate_json(raw)


class RoomService:
    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    async def _generate_code(self) -> str:
        for _ in range(10):
            code = str(random.randint(100000, 999999))
            if not await self.redis.sismember("room_code_index", code):
                return code
        raise HTTPException(status_code=503, detail="Unable to allocate room code")

    async def _save_room(self, room: Room) -> None:
        await self.redis.set(_room_key(room.code), _serialize_room(room), ex=settings.room_ttl_seconds)

    async def get_room(self, code: str) -> Room:
        raw = await self.redis.get(_room_key(code))
        if raw is None:
            raise HTTPException(status_code=404, detail="Room not found")
        return _deserialize_room(raw)

    async def create_room(self, username: str, difficulty: str) -> tuple[str, str, int, Room]:
        player_id = str(uuid.uuid4())
        code = await self._generate_code()
        room = Room(
            code=code,
            host_player_id=player_id,
            difficulty=difficulty,  # type: ignore[arg-type]
            players={
                player_id: RoomPlayer(username=username, slot=1, connected=False),
            },
        )

        pipe = self.redis.pipeline()
        pipe.sadd("room_code_index", code)
        pipe.set(_room_key(code), _serialize_room(room), ex=settings.room_ttl_seconds)
        pipe.set(
            _player_key(player_id),
            json.dumps({"room_code": code, "slot": 1, "username": username}),
            ex=settings.room_ttl_seconds,
        )
        await pipe.execute()
        return code, player_id, 1, room

    async def join_room(self, code: str, username: str) -> tuple[str, int, Room]:
        room = await self.get_room(code)
        if room.status != "waiting":
            raise HTTPException(status_code=409, detail="Game already started")

        if len(room.players) >= settings.max_players:
            raise HTTPException(status_code=409, detail="Room is full")

        player_id = str(uuid.uuid4())
        used_slots = {player.slot for player in room.players.values()}
        slot = 1 if 1 not in used_slots else 2
        room.players[player_id] = RoomPlayer(username=username, slot=slot, connected=False)

        pipe = self.redis.pipeline()
        pipe.set(_room_key(code), _serialize_room(room), ex=settings.room_ttl_seconds)
        pipe.set(
            _player_key(player_id),
            json.dumps({"room_code": code, "slot": slot, "username": username}),
            ex=settings.room_ttl_seconds,
        )
        await pipe.execute()
        return player_id, slot, room

    async def leave_room(self, code: str, player_id: str) -> Room | None:
        room = await self.get_room(code)
        if player_id not in room.players:
            raise HTTPException(status_code=404, detail="Player not in room")

        del room.players[player_id]
        await self.redis.delete(_player_key(player_id))

        if not room.players:
            await self.delete_room(code)
            return None

        if room.host_player_id == player_id:
            room.host_player_id = next(iter(room.players))

        await self._save_room(room)
        return room

    async def delete_room(self, code: str) -> None:
        room = await self.get_room(code)
        pipe = self.redis.pipeline()
        pipe.delete(_room_key(code))
        pipe.srem("room_code_index", code)
        for player_id in room.players:
            pipe.delete(_player_key(player_id))
        await pipe.execute()

    async def set_player_connected(self, code: str, player_id: str, connected: bool) -> Room:
        room = await self.get_room(code)
        if player_id not in room.players:
            raise HTTPException(status_code=404, detail="Player not in room")
        room.players[player_id].connected = connected
        await self._save_room(room)
        return room

    async def start_room(self, code: str, player_id: str) -> tuple[int, str, Room]:
        room = await self.get_room(code)
        if room.host_player_id != player_id:
            raise HTTPException(status_code=403, detail="Only the host can start the game")
        if room.status != "waiting":
            raise HTTPException(status_code=409, detail="Game already started")

        connected_count = sum(1 for player in room.players.values() if player.connected)
        if connected_count < settings.max_players:
            raise HTTPException(status_code=409, detail="All players must be connected")

        seed = secrets.randbelow(2**31 - 1)
        started_at = datetime.now(timezone.utc).isoformat()
        room.seed = seed
        room.started_at = started_at
        room.status = "playing"
        await self._save_room(room)
        return seed, started_at, room

    async def verify_player(self, code: str, player_id: str) -> Room:
        room = await self.get_room(code)
        if player_id not in room.players:
            raise HTTPException(status_code=403, detail="Invalid player")
        return room
