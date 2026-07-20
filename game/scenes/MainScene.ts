import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import {
  DIFFICULTY_SETTINGS,
  type Difficulty,
} from "../difficulty";
import type { GameCallbacks } from "../events";
import {
  isLocalMultiplayer,
  type SessionSettings,
} from "../playMode";
import {
  circlesGap,
  circlesOverlap,
  DEFENDER_VISUAL_RADIUS,
  getBallVisualRadius,
  PLAYER_VISUAL_RADIUS,
} from "../collision";
import {
  NEAR_MISS_MARGIN,
  ScoreManager,
} from "../scoring";

const PLAYER_DISPLAY_W = 64;
const PLAYER_DISPLAY_H = 64;
const BALL_SIZE = 20;
const DEFENDER_TINT = 0x1d4ed8;
const PLAYER_SPEED = 280;
const BASE_SCROLL_SPEED = 180;
const SPAWN_INTERVAL_MS = 900;
const PITCH_MARGIN = 36;
const FORCED_PASS_START_DELAY_MS = 3000;
const FORCED_PASS_DEFENDER_GAP = 4;
const PLAYER_Y = GAME_HEIGHT - 70;
const BALL_PASS_SPEED = 1100;
const BALL_CATCH_DISTANCE = 14;
const PLAYER2_TINT = 0x7dd3fc;
const POWER_UP_TINT = 0xff3030;
const POWER_UP_DURATION_MS = 2000;
const POWER_UP_AURA_RADIUS = 30;

/** ballgen 8×8 sheet (1024², 128px frames) — MIT / CC0 via OpenGameArt */
const BALL_FRAME = 128;
const BALL_ROLL_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7];
const BALL_ANIM_FPS = 12;

/** 16x16 pack run sheet — 24×24 canvas frames, 6 cols × 5 dirs; bottom row faces up the pitch */
const PLAYER_FRAME = 24;
const PLAYER_SHEET_COLS = 6;
const PLAYER_UP_ROW = 4;
const PLAYER_DOWN_ROW = 0;
const PLAYER_RUN_FRAMES = Array.from(
  { length: PLAYER_SHEET_COLS },
  (_, i) => PLAYER_UP_ROW * PLAYER_SHEET_COLS + i,
);
const DEFENDER_RUN_FRAMES = Array.from(
  { length: PLAYER_SHEET_COLS },
  (_, i) => PLAYER_DOWN_ROW * PLAYER_SHEET_COLS + i,
);
const PLAYER_ANIM_FPS = 12;
const ANIM_TIMESCALE_MAX = 1.25;

export class MainScene extends Phaser.Scene {
  private callbacks!: GameCallbacks;
  private settings!: SessionSettings;
  private localMultiplayer = false;
  private player!: Phaser.GameObjects.Sprite;
  private player2?: Phaser.GameObjects.Sprite;
  private ballHolder!: Phaser.GameObjects.Sprite;
  private ball!: Phaser.GameObjects.Sprite;
  private isPassing = false;
  private powerUpUntil = new Map<Phaser.GameObjects.Sprite, number>();
  private powerUpAuras = new Map<
    Phaser.GameObjects.Sprite,
    Phaser.GameObjects.Arc
  >();
  private powerUpTimers = new Map<
    Phaser.GameObjects.Sprite,
    Phaser.GameObjects.Text
  >();
  private defenders!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyEnter!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private difficulty: Difficulty = "easy";
  private scrollSpeed = BASE_SCROLL_SPEED;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private elapsedMs = 0;
  private nextForcedPassAtMs = FORCED_PASS_START_DELAY_MS;
  private lastReportedSeconds = -1;
  private isGameOver = false;
  private scoreManager!: ScoreManager;

  constructor() {
    super("MainScene");
  }

  preload() {
    this.load.spritesheet("football", "/sprites/football-roll.png", {
      frameWidth: BALL_FRAME,
      frameHeight: BALL_FRAME,
      spacing: 0,
    });
    this.load.spritesheet("player-run", "/sprites/player-run-16.png", {
      frameWidth: PLAYER_FRAME,
      frameHeight: PLAYER_FRAME,
    });
    this.load.image(
      "pitch-grass",
      "/background/Grass_23-512x512.png",
    );
  }

  create() {
    this.callbacks = this.registry.get("callbacks") as GameCallbacks;
    this.settings = this.registry.get("settings") as SessionSettings;
    this.difficulty = this.settings.difficulty;
    this.localMultiplayer = isLocalMultiplayer(this.settings);
    this.isGameOver = false;
    this.isPassing = false;
    this.powerUpUntil.clear();
    this.powerUpAuras.clear();
    this.powerUpTimers.clear();
    this.elapsedMs = 0;
    this.nextForcedPassAtMs = FORCED_PASS_START_DELAY_MS;
    this.lastReportedSeconds = -1;
    this.scoreManager = new ScoreManager((score) =>
      this.callbacks.onScoreChange(score),
    );
    this.scoreManager.reset();
    this.scrollSpeed =
      BASE_SCROLL_SPEED *
      DIFFICULTY_SETTINGS[this.difficulty].speedMultiplier;

    this.drawPitch();

    this.add.rectangle(18, GAME_HEIGHT / 2, 4, GAME_HEIGHT, 0xffffff, 0.35);
    this.add.rectangle(
      GAME_WIDTH - 18,
      GAME_HEIGHT / 2,
      4,
      GAME_HEIGHT,
      0xffffff,
      0.35,
    );

    // Nearest-neighbor sampling (belt-and-suspenders with pixelArt: true)
    this.textures.get("player-run").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("football").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("pitch-grass").setFilter(Phaser.Textures.FilterMode.LINEAR);

    if (!this.anims.exists("ball-roll")) {
      this.anims.create({
        key: "ball-roll",
        frames: this.anims.generateFrameNumbers("football", {
          frames: BALL_ROLL_FRAMES,
        }),
        frameRate: BALL_ANIM_FPS,
        repeat: -1,
      });
    }

    if (!this.anims.exists("player-run")) {
      this.anims.create({
        key: "player-run",
        frames: this.anims.generateFrameNumbers("player-run", {
          frames: PLAYER_RUN_FRAMES,
        }),
        frameRate: PLAYER_ANIM_FPS,
        repeat: -1,
      });
    }

    if (!this.anims.exists("defender-run")) {
      this.anims.create({
        key: "defender-run",
        frames: this.anims.generateFrameNumbers("player-run", {
          frames: DEFENDER_RUN_FRAMES,
        }),
        frameRate: PLAYER_ANIM_FPS,
        repeat: -1,
      });
    }

    const p1X = this.localMultiplayer ? GAME_WIDTH / 2 - 70 : GAME_WIDTH / 2;
    this.player = this.createRunner(p1X);
    this.ballHolder = this.player;

    if (this.localMultiplayer) {
      this.player2 = this.createRunner(GAME_WIDTH / 2 + 70);
      this.player2.setTint(PLAYER2_TINT);
    }

    // Ball in front of the runner (toward top of pitch / direction of travel)
    this.ball = this.add.sprite(
      this.ballHolder.x,
      this.ballHolder.y - PLAYER_DISPLAY_H * 0.45,
      "football",
      0,
    );
    this.ball.setDisplaySize(BALL_SIZE, BALL_SIZE);
    this.ball.setDepth(3);
    this.player.setDepth(2);
    this.player2?.setDepth(2);
    this.ball.play("ball-roll");

    this.defenders = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      allowGravity: false,
      immovable: true,
    });

    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyEnter = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.keySpace = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.spawnTimer = this.time.addEvent({
      delay: SPAWN_INTERVAL_MS,
      callback: this.spawnDefenders,
      callbackScope: this,
      loop: true,
    });

    this.spawnDefenders();
    this.time.delayedCall(400, () => this.spawnDefenders());
  }

  update(_time: number, delta: number) {
    if (this.isGameOver) return;

    this.elapsedMs += delta;
    this.scoreManager.addTimePoints(delta, this.elapsedMs);
    const seconds = Math.floor(this.elapsedMs / 100) / 10;
    if (seconds !== this.lastReportedSeconds) {
      this.lastReportedSeconds = seconds;
      this.callbacks.onTick(seconds);
    }

    const { speedMultiplier } = DIFFICULTY_SETTINGS[this.difficulty];
    this.scrollSpeed =
      (BASE_SCROLL_SPEED + (this.elapsedMs / 1000) * 8) * speedMultiplier;

    const speedScale = Math.min(
      this.scrollSpeed / BASE_SCROLL_SPEED,
      ANIM_TIMESCALE_MAX,
    );
    this.ball.anims.timeScale = this.isPassing
      ? Math.max(speedScale, 1.8)
      : speedScale;
    this.player.anims.timeScale = speedScale;
    if (this.player2) this.player2.anims.timeScale = speedScale;

    this.handlePlayerInput(
      this.player,
      this.cursors.left,
      this.cursors.right,
      delta,
    );
    if (this.player2) {
      this.handlePlayerInput(this.player2, this.keyA, this.keyD, delta);
    }

    this.handlePassInput();
    this.updateBall(delta);
    this.updatePowerUps();
    this.updateDefenders();
    this.checkPlayerDefenderCollisions();
    this.checkNearMisses();
  }

  private createRunner(x: number) {
    const runner = this.add.sprite(
      x,
      PLAYER_Y,
      "player-run",
      PLAYER_RUN_FRAMES[0],
    );
    runner.setDisplaySize(PLAYER_DISPLAY_W, PLAYER_DISPLAY_H);
    runner.setOrigin(0.5, 0.5);
    runner.play("player-run");
    return runner;
  }

  private drawPitch() {
    const pitch = this.add.tileSprite(
      0,
      0,
      GAME_WIDTH,
      GAME_HEIGHT,
      "pitch-grass",
    );
    pitch.setOrigin(0, 0);
    pitch.setDepth(-10);
  }

  private handlePlayerInput(
    runner: Phaser.GameObjects.Sprite,
    left: Phaser.Input.Keyboard.Key | undefined,
    right: Phaser.Input.Keyboard.Key | undefined,
    delta: number,
  ) {
    const step = (PLAYER_SPEED * delta) / 1000;

    if (left?.isDown) {
      runner.x -= step;
    } else if (right?.isDown) {
      runner.x += step;
    }

    const minX = PITCH_MARGIN + PLAYER_VISUAL_RADIUS;
    const maxX = GAME_WIDTH - PITCH_MARGIN - PLAYER_VISUAL_RADIUS;
    runner.x = Phaser.Math.Clamp(Math.round(runner.x), minX, maxX);
    runner.y = PLAYER_Y;
  }

  private handlePassInput() {
    if (!this.localMultiplayer || !this.player2 || this.isPassing) return;

    const passKey =
      this.ballHolder === this.player ? this.keyEnter : this.keySpace;
    if (!Phaser.Input.Keyboard.JustDown(passKey)) return;

    const passer = this.ballHolder;
    const receiver = this.ballHolder === this.player ? this.player2 : this.player;
    this.grantPowerUp(passer);
    this.isPassing = true;
    this.ballHolder = receiver;
  }

  private grantPowerUp(runner: Phaser.GameObjects.Sprite) {
    this.powerUpUntil.set(runner, this.elapsedMs + POWER_UP_DURATION_MS);
    runner.setTint(POWER_UP_TINT);

    if (!this.powerUpAuras.has(runner)) {
      const aura = this.add
        .circle(
          runner.x,
          runner.y,
          POWER_UP_AURA_RADIUS,
          POWER_UP_TINT,
          0.28,
        )
        .setDepth(1)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.powerUpAuras.set(runner, aura);
      this.tweens.add({
        targets: aura,
        alpha: { from: 0.18, to: 0.42 },
        scale: { from: 0.85, to: 1.15 },
        duration: 300,
        yoyo: true,
        repeat: -1,
      });
    }

    if (!this.powerUpTimers.has(runner)) {
      const timer = this.add
        .text(runner.x, runner.y, "2.0s", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#ffffff",
          backgroundColor: "#991b1b",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(5);
      this.powerUpTimers.set(runner, timer);
    }
  }

  private updatePowerUps() {
    this.powerUpUntil.forEach((expiresAt, runner) => {
      if (this.elapsedMs >= expiresAt) {
        this.removePowerUp(runner);
        return;
      }

      this.powerUpAuras.get(runner)?.setPosition(runner.x, runner.y);
      const remainingSeconds =
        Math.ceil((expiresAt - this.elapsedMs) / 100) / 10;
      this.powerUpTimers
        .get(runner)
        ?.setText(`${remainingSeconds.toFixed(1)}s`)
        .setPosition(runner.x, runner.y + PLAYER_DISPLAY_H / 2 + 7);
    });
  }

  private removePowerUp(runner: Phaser.GameObjects.Sprite) {
    this.powerUpUntil.delete(runner);
    const aura = this.powerUpAuras.get(runner);
    if (aura) {
      this.tweens.killTweensOf(aura);
      aura.destroy();
      this.powerUpAuras.delete(runner);
    }
    this.powerUpTimers.get(runner)?.destroy();
    this.powerUpTimers.delete(runner);

    if (runner === this.player2) {
      runner.setTint(PLAYER2_TINT);
    } else {
      runner.clearTint();
    }
  }

  private clearPowerUps() {
    [...this.powerUpUntil.keys()].forEach((runner) =>
      this.removePowerUp(runner),
    );
  }

  private isPlayerPowered(runner: Phaser.GameObjects.Sprite) {
    return (this.powerUpUntil.get(runner) ?? 0) > this.elapsedMs;
  }

  private updateBall(delta: number) {
    const targetX = this.ballHolder.x;
    const targetY = this.ballHolder.y - PLAYER_DISPLAY_H * 0.45;

    if (!this.isPassing) {
      this.cancelPowerUpForBallHolder();
      this.ball.setPosition(
        Math.round(targetX),
        Math.round(targetY),
      );
      return;
    }

    const dx = targetX - this.ball.x;
    const dy = targetY - this.ball.y;
    const distance = Math.hypot(dx, dy);
    const step = (BALL_PASS_SPEED * delta) / 1000;

    if (distance <= BALL_CATCH_DISTANCE || step >= distance) {
      this.ball.setPosition(targetX, targetY);
      this.isPassing = false;
      this.cancelPowerUpForBallHolder();
      return;
    }

    this.ball.x += (dx / distance) * step;
    this.ball.y += (dy / distance) * step;
    this.checkPassInterception();
  }

  private cancelPowerUpForBallHolder() {
    if (this.isPlayerPowered(this.ballHolder)) {
      this.removePowerUp(this.ballHolder);
    }
  }

  private checkPassInterception() {
    const ballRadius = getBallVisualRadius(BALL_SIZE);

    this.defenders.children.each((child) => {
      if (this.isGameOver) return false;

      const defender = child as Phaser.Physics.Arcade.Sprite;
      if (!defender.active) return true;

      if (
        circlesOverlap(
          this.ball.x,
          this.ball.y,
          ballRadius,
          defender.x,
          defender.y,
          DEFENDER_VISUAL_RADIUS,
        )
      ) {
        this.endGame();
        return false;
      }
      return true;
    });
  }

  private checkPlayerDefenderCollisions() {
    const runners = this.player2 ? [this.player, this.player2] : [this.player];

    this.defenders.children.each((child) => {
      if (this.isGameOver) return false;

      const defender = child as Phaser.Physics.Arcade.Sprite;
      if (!defender.active) return true;

      for (const runner of runners) {
        if (
          !circlesOverlap(
            runner.x,
            runner.y,
            PLAYER_VISUAL_RADIUS,
            defender.x,
            defender.y,
            DEFENDER_VISUAL_RADIUS,
          )
        ) {
          continue;
        }

        if (this.isPlayerPowered(runner)) {
          this.destroyDefenderWithGlow(defender);
        } else {
          this.endGame();
        }
        return false;
      }

      return true;
    });
  }

  private destroyDefenderWithGlow(defender: Phaser.Physics.Arcade.Sprite) {
    const { x, y } = defender;
    defender.anims.pause();
    this.defenders.killAndHide(defender);
    (defender.body as Phaser.Physics.Arcade.Body).enable = false;
    this.scoreManager.awardKill(this.elapsedMs);

    const glow = this.add
      .circle(x, y, PLAYER_VISUAL_RADIUS, 0xfff3b0, 0.9)
      .setDepth(4)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: glow,
      alpha: 0,
      scale: 2.5,
      duration: 240,
      ease: "Quad.easeOut",
      onComplete: () => glow.destroy(),
    });
  }

  private spawnDefenders() {
    if (this.isGameOver) return;

    const settings = DIFFICULTY_SETTINGS[this.difficulty];
    const spawnY = -PLAYER_DISPLAY_H / 2 - 10;

    if (this.shouldSpawnForcedPassWall(settings.forcedPassChance)) {
      this.spawnForcedPassWall(
        spawnY,
        settings.forcedPassDefenderCount,
        settings.forcedPassCooldownMs,
      );
      return;
    }

    for (let lane = 0; lane < settings.defenderCount; lane++) {
      const x =
        settings.defenderCount === 1
          ? Phaser.Math.Between(PITCH_MARGIN, GAME_WIDTH - PITCH_MARGIN)
          : this.randomXInLane(lane, settings.defenderCount);
      this.spawnDefender(x, spawnY);
    }
  }

  private shouldSpawnForcedPassWall(chance: number) {
    return (
      this.localMultiplayer &&
      !this.isPassing &&
      this.elapsedMs >= this.nextForcedPassAtMs &&
      Math.random() < chance
    );
  }

  private spawnForcedPassWall(
    y: number,
    defenderCount: number,
    cooldownMs: number,
  ) {
    const spacing = PLAYER_DISPLAY_W + FORCED_PASS_DEFENDER_GAP;
    const halfWidth = ((defenderCount - 1) * spacing) / 2;
    const centerX = Phaser.Math.Clamp(
      this.ball.x,
      PITCH_MARGIN + halfWidth,
      GAME_WIDTH - PITCH_MARGIN - halfWidth,
    );

    for (let index = 0; index < defenderCount; index++) {
      this.spawnDefender(centerX - halfWidth + index * spacing, y);
    }

    this.nextForcedPassAtMs = this.elapsedMs + cooldownMs;
  }

  private randomXInLane(lane: number, laneCount: number) {
    const pitchWidth = GAME_WIDTH - PITCH_MARGIN * 2;
    const laneWidth = pitchWidth / laneCount;
    const laneStart = PITCH_MARGIN + lane * laneWidth;
    const padding = PLAYER_VISUAL_RADIUS;

    return Phaser.Math.Between(
      Math.ceil(laneStart + padding),
      Math.floor(laneStart + laneWidth - padding),
    );
  }

  private spawnDefender(x: number, y: number) {
    const defender = this.defenders.create(
      x,
      y,
      "player-run",
      DEFENDER_RUN_FRAMES[0],
    ) as Phaser.Physics.Arcade.Sprite;

    defender
      .setActive(true)
      .setVisible(true)
      .setDisplaySize(PLAYER_DISPLAY_W, PLAYER_DISPLAY_H)
      .setOrigin(0.5, 0.5)
      .setTint(DEFENDER_TINT)
      .setDepth(2)
      .play("defender-run");

    const body = defender.body as Phaser.Physics.Arcade.Body;
    body.setCircle(PLAYER_VISUAL_RADIUS / defender.scaleX);
    body.setAllowGravity(false);
    body.setVelocity(0, this.scrollSpeed);
  }

  private updateDefenders() {
    const speedScale = Math.min(
      this.scrollSpeed / BASE_SCROLL_SPEED,
      ANIM_TIMESCALE_MAX,
    );

    this.defenders.children.each((child) => {
      const defender = child as Phaser.Physics.Arcade.Sprite;
      if (!defender.active) return true;

      const body = defender.body as Phaser.Physics.Arcade.Body;
      body.setVelocityY(this.scrollSpeed);
      defender.anims.timeScale = speedScale;

      if (defender.y > GAME_HEIGHT + PLAYER_DISPLAY_H / 2 + 40) {
        defender.anims.pause();
        this.defenders.killAndHide(defender);
        body.enable = false;
      }
      return true;
    });
  }

  private checkNearMisses() {
    if (this.isGameOver) return;

    const runners = this.player2 ? [this.player, this.player2] : [this.player];

    this.defenders.children.each((child) => {
      const defender = child as Phaser.Physics.Arcade.Sprite;
      if (!defender.active || defender.getData("nearMissAwarded")) {
        return true;
      }

      for (const runner of runners) {
        // Only count a near miss once the defender has scrolled past the player.
        if (defender.y <= runner.y) continue;

        const gap = circlesGap(
          runner.x,
          runner.y,
          PLAYER_VISUAL_RADIUS,
          defender.x,
          defender.y,
          DEFENDER_VISUAL_RADIUS,
        );

        if (gap > 0 && gap <= NEAR_MISS_MARGIN) {
          defender.setData("nearMissAwarded", true);
          this.scoreManager.awardNearMiss(this.elapsedMs);
          break;
        }
      }

      return true;
    });
  }

  private endGame() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.isPassing = false;

    this.spawnTimer?.remove(false);
    this.physics.pause();
    this.clearPowerUps();
    this.ball.anims.pause();
    this.player.anims.pause();
    this.player2?.anims.pause();
    this.defenders.children.each((child) => {
      (child as Phaser.Physics.Arcade.Sprite).anims.pause();
      return true;
    });

    this.scoreManager.finalizeStreak();

    const seconds = Math.floor(this.elapsedMs / 100) / 10;
    this.callbacks.onTick(seconds);
    this.callbacks.onGameOver(seconds, this.scoreManager.getFinalScore());
  }
}
