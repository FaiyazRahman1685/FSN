import asyncio
import json
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

INPUT_FRAME_TIMEOUT_MS = 50


class RoomConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[str, dict[str, WebSocket]] = defaultdict(dict)
        self.input_buffers: dict[str, dict[int, dict[int, dict[str, bool]]]] = defaultdict(
            lambda: defaultdict(dict)
        )
        self.pending_tasks: dict[str, dict[int, asyncio.Task[Any]]] = defaultdict(dict)

    async def connect(self, code: str, player_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[code][player_id] = websocket

    def disconnect(self, code: str, player_id: str) -> None:
        self.connections[code].pop(player_id, None)
        if not self.connections[code]:
            self.connections.pop(code, None)
            self.input_buffers.pop(code, None)
            pending = self.pending_tasks.pop(code, {})
            for task in pending.values():
                task.cancel()

    async def broadcast(self, code: str, message: dict[str, Any]) -> None:
        payload = json.dumps(message)
        dead: list[str] = []
        for player_id, websocket in self.connections.get(code, {}).items():
            try:
                await websocket.send_text(payload)
            except Exception:
                dead.append(player_id)
        for player_id in dead:
            self.disconnect(code, player_id)

    async def schedule_input_frame(self, code: str, tick: int) -> None:
        existing = self.pending_tasks[code].get(tick)
        if existing and not existing.done():
            return

        async def flush() -> None:
            await asyncio.sleep(INPUT_FRAME_TIMEOUT_MS / 1000)
            slot_inputs = self.input_buffers[code].pop(tick, {})
            if not slot_inputs:
                self.pending_tasks[code].pop(tick, None)
                return

            inputs = [
                {"slot": slot, "keys": keys}
                for slot, keys in sorted(slot_inputs.items())
            ]
            await self.broadcast(
                code,
                {"type": "input_frame", "tick": tick, "inputs": inputs},
            )
            self.pending_tasks[code].pop(tick, None)

        self.pending_tasks[code][tick] = asyncio.create_task(flush())


manager = RoomConnectionManager()
