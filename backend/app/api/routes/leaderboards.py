from fastapi import APIRouter, Query

from app.models.leaderboard import LeaderboardResponse, SubmitHighscoreRequest
from app.services.leaderboard_service import LeaderboardService

router = APIRouter(prefix="/leaderboards", tags=["leaderboards"])


@router.get("", response_model=LeaderboardResponse)
def get_leaderboard(
    difficulty: str = Query(default="easy"),
    play_mode: str = Query(default="single"),
    limit: int = Query(default=10, ge=1, le=100),
) -> LeaderboardResponse:
    service = LeaderboardService()
    entries = service.get_leaderboard(difficulty, play_mode, limit)
    return LeaderboardResponse(entries=entries)


@router.post("", response_model=LeaderboardResponse)
def submit_score(payload: SubmitHighscoreRequest) -> LeaderboardResponse:
    service = LeaderboardService()
    entry = service.submit_score(payload)
    return LeaderboardResponse(entries=[entry])
