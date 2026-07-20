CREATE TABLE IF NOT EXISTS highscores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  score INTEGER NOT NULL,
  survival_seconds REAL NOT NULL,
  difficulty TEXT NOT NULL,
  play_mode TEXT NOT NULL,
  room_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_highscores_board
  ON highscores (difficulty, play_mode, score DESC);
