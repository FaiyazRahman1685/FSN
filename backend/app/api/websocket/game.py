import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.websocket.constants import TICK_RATE
from app.api.websocket.manager import manager
from app.redis.client import get_redis
from app.services.room_service import RoomService

router = APIRouter()


@router.websocket("/ws/rooms/{code}")
async def room_websocket(websocket: WebSocket, code: str, player_id: str) -> None:
    redis = await get_redis()
    room_service = RoomService(redis)

    try:
        room = await room_service.verify_player(code, player_id)
    except Exception:
        await websocket.close(code=4403)
        return

    await manager.connect(code, player_id, websocket)
    room = await room_service.set_player_connected(code, player_id, True)
    await manager.broadcast(code, {"type": "room_state", "room": room.model_dump()})

    try:
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)
            msg_type = message.get("type")

            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            if msg_type == "input":
                tick = int(message["tick"])
                keys = message.get("keys", {})
                slot = room.players[player_id].slot
                normalized = {
                    "left": bool(keys.get("left")),
                    "right": bool(keys.get("right")),
                    "pass": bool(keys.get("pass")),
                }
                manager.input_buffers[code][tick][slot] = normalized
                await manager.schedule_input_frame(code, tick)
                continue

            if msg_type == "game_start":
                if room.host_player_id != player_id:
                    await websocket.send_text(
                        json.dumps({"type": "error", "message": "Only the host can start"})
                    )
                    continue
                seed, started_at, room = await room_service.start_room(code, player_id)
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
                continue

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(code, player_id)
        try:
            room = await room_service.set_player_connected(code, player_id, False)
            slot = room.players[player_id].slot
            await manager.broadcast(code, {"type": "player_left", "slot": slot})
            await manager.broadcast(code, {"type": "room_state", "room": room.model_dump()})
        except Exception:
            pass
