from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, leaderboards, rooms
from app.api.websocket import game as game_ws
from app.config import settings
from app.db.sqlite import init_db
from app.redis.client import close_redis


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield
    await close_redis()


app = FastAPI(title="Pitch Runner API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(rooms.router)
app.include_router(leaderboards.router)
app.include_router(game_ws.router)
