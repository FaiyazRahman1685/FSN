from app.db.sqlite import get_connection
from app.models.leaderboard import HighscoreEntry, SubmitHighscoreRequest


class LeaderboardService:
    def get_leaderboard(
        self,
        difficulty: str,
        play_mode: str,
        limit: int = 10,
    ) -> list[HighscoreEntry]:
        conn = get_connection()
        try:
            rows = conn.execute(
                """
                SELECT id, username, score, survival_seconds, difficulty, play_mode, room_code, created_at
                FROM highscores
                WHERE difficulty = ? AND play_mode = ?
                ORDER BY score DESC, survival_seconds DESC
                LIMIT ?
                """,
                (difficulty, play_mode, limit),
            ).fetchall()
            return [HighscoreEntry.model_validate(dict(row)) for row in rows]
        finally:
            conn.close()

    def submit_score(self, payload: SubmitHighscoreRequest) -> HighscoreEntry:
        conn = get_connection()
        try:
            cursor = conn.execute(
                """
                INSERT INTO highscores (username, score, survival_seconds, difficulty, play_mode, room_code)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.username,
                    payload.score,
                    payload.survival_seconds,
                    payload.difficulty,
                    payload.play_mode,
                    payload.room_code,
                ),
            )
            conn.commit()
            row = conn.execute(
                """
                SELECT id, username, score, survival_seconds, difficulty, play_mode, room_code, created_at
                FROM highscores WHERE id = ?
                """,
                (cursor.lastrowid,),
            ).fetchone()
            return HighscoreEntry.model_validate(dict(row))
        finally:
            conn.close()
