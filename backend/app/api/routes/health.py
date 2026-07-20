from fastapi import APIRouter, Response
from pydantic import BaseModel

from app.redis.client import get_redis

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    redis: str
    online_multiplayer_available: bool


@router.get("/health", response_model=HealthResponse)
async def health_check(response: Response) -> HealthResponse:
    try:
        redis = await get_redis()
        pong = await redis.ping()
        redis_ok = pong is True
    except Exception:
        redis_ok = False

    if redis_ok:
        return HealthResponse(
            status="ok",
            redis="ok",
            online_multiplayer_available=True,
        )

    response.status_code = 503
    return HealthResponse(
        status="degraded",
        redis="error",
        online_multiplayer_available=False,
    )
