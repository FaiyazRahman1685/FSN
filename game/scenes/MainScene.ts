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

const PLAYER_DISPLAY_W = 64;
const PLAYER_DISPLAY_H = 64;
const PLAYER_BODY_RADIUS = 16;
const BALL_SIZE = 20;
const DEFENDER_RADIUS = 20;
/** Smaller than the sprite so near-misses feel fair */
const DEFENDER_BODY_RADIUS = 8;
const PLAYER_SPEED = 280;
const BASE_SCROLL_SPEED = 180;
const SPAWN_INTERVAL_MS = 900;
const PITCH_MARGIN = 36;
const STRIPE_WIDTH = 50;
const STRIPE_LIGHT = 0x3a9b5c;
const STRIPE_DARK = 0x2d8a4e;
const PLAYER_Y = GAME_HEIGHT - 70;
const BALL_PASS_SPEED = 1100;
const BALL_CATCH_DISTANCE = 14;
const BALL_HIT_RADIUS = BALL_SIZE / 2;
const PLAYER2_TINT = 0x7dd3fc;

/** ballgen 8×8 sheet (1024², 128px frames) — MIT / CC0 via OpenGameArt */
const BALL_FRAME = 128;
const BALL_ROLL_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7];
const BALL_ANIM_FPS = 12;

/** 16x16 pack run sheet — 24×24 canvas frames, 6 cols × 5 dirs; bottom row faces up the pitch */
const PLAYER_FRAME = 24;
const PLAYER_SHEET_COLS = 6;
const PLAYER_UP_ROW = 4;
const PLAYER_RUN_FRAMES = Array.from(
  { length: PLAYER_SHEET_COLS },
  (_, i) => PLAYER_UP_ROW * PLAYER_SHEET_COLS + i,
);
const PLAYER_ANIM_FPS = 12;
const ANIM_TIMESCALE_MAX = 1.25;

export class MainScene extends Phaser.Scene {
  private callbacks!: GameCallbacks;
  private settings!: SessionSettings;
  private localMultiplayer = false;
  private player!: Phaser.Physics.Arcade.Sprite;
  private player2?: Phaser.Physics.Arcade.Sprite;
  private ballHolder!: Phaser.Physics.Arcade.Sprite;
  private ball!: Phaser.GameObjects.Sprite;
  private isPassing = false;
  private defenders!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private difficulty: Difficulty = "easy";
  private scrollSpeed = BASE_SCROLL_SPEED;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private elapsedMs = 0;
  private lastReportedSeconds = -1;
  private isGameOver = false;

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
  }

  create() {
    this.callbacks = this.registry.get("callbacks") as GameCallbacks;
    this.settings = this.registry.get("settings") as SessionSettings;
    this.difficulty = this.settings.difficulty;
    this.localMultiplayer = isLocalMultiplayer(this.settings);
    this.isGameOver = false;
    this.isPassing = false;
    this.elapsedMs = 0;
    this.lastReportedSeconds = -1;
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

    this.createCircleTexture("defender", DEFENDER_RADIUS, 0x1d4ed8);

    // Nearest-neighbor sampling (belt-and-suspenders with pixelArt: true)
    this.textures.get("player-run").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("football").setFilter(Phaser.Textures.FilterMode.NEAREST);

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
      allowGravity: false,
      immovable: true,
    });

    this.physics.add.overlap(
      this.player,
      this.defenders,
      () => this.endGame(),
      undefined,
      this,
    );
    if (this.player2) {
      this.physics.add.overlap(
        this.player2,
        this.defenders,
        () => this.endGame(),
        undefined,
        this,
      );
    }

    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.keyA = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
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

    this.handlePlayerInput(this.player, this.cursors.left, this.cursors.right);
    if (this.player2) {
      this.handlePlayerInput(this.player2, this.keyA, this.keyD);
    }

    this.handlePassInput();
    this.updateBall(delta);
    this.updateDefenders();
  }

  private createRunner(x: number) {
    const runner = this.physics.add.sprite(
      x,
      PLAYER_Y,
      "player-run",
      PLAYER_RUN_FRAMES[0],
    );
    runner.setDisplaySize(PLAYER_DISPLAY_W, PLAYER_DISPLAY_H);
    runner.setCollideWorldBounds(true);
    runner.setImmovable(true);
    runner.play("player-run");

    const body = runner.body as Phaser.Physics.Arcade.Body;
    body.setCircle(PLAYER_BODY_RADIUS);
    body.setOffset(
      runner.width / 2 - PLAYER_BODY_RADIUS,
      runner.height / 2 - PLAYER_BODY_RADIUS + 4,
    );
    return runner;
  }

  private drawPitch() {
    const stripeCount = Math.ceil(GAME_WIDTH / STRIPE_WIDTH);
    for (let i = 0; i < stripeCount; i++) {
      const color = i % 2 === 0 ? STRIPE_DARK : STRIPE_LIGHT;
      this.add.rectangle(
        i * STRIPE_WIDTH + STRIPE_WIDTH / 2,
        GAME_HEIGHT / 2,
        STRIPE_WIDTH,
        GAME_HEIGHT,
        color,
      );
    }
  }

  private createCircleTexture(key: string, radius: number, color: number) {
    if (this.textures.exists(key)) return;
    const size = radius * 2;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillStyle(color, 1);
    g.fillCircle(radius, radius, radius);
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private handlePlayerInput(
    runner: Phaser.Physics.Arcade.Sprite,
    left: Phaser.Input.Keyboard.Key | undefined,
    right: Phaser.Input.Keyboard.Key | undefined,
  ) {
    const body = runner.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);

    if (left?.isDown) {
      body.setVelocityX(-PLAYER_SPEED);
    } else if (right?.isDown) {
      body.setVelocityX(PLAYER_SPEED);
    }

    runner.y = PLAYER_Y;
    body.y = runner.y - runner.displayHeight / 2;
  }

  private handlePassInput() {
    if (!this.localMultiplayer || !this.player2 || this.isPassing) return;
    if (!Phaser.Input.Keyboard.JustDown(this.keySpace)) return;

    const receiver = this.ballHolder === this.player ? this.player2 : this.player;
    this.isPassing = true;
    this.ballHolder = receiver;
  }

  private updateBall(delta: number) {
    const targetX = this.ballHolder.x;
    const targetY = this.ballHolder.y - PLAYER_DISPLAY_H * 0.45;

    if (!this.isPassing) {
      this.ball.setPosition(targetX, targetY);
      return;
    }

    const dx = targetX - this.ball.x;
    const dy = targetY - this.ball.y;
    const distance = Math.hypot(dx, dy);
    const step = (BALL_PASS_SPEED * delta) / 1000;

    if (distance <= BALL_CATCH_DISTANCE || step >= distance) {
      this.ball.setPosition(targetX, targetY);
      this.isPassing = false;
      return;
    }

    this.ball.x += (dx / distance) * step;
    this.ball.y += (dy / distance) * step;
    this.checkPassInterception();
  }

  private checkPassInterception() {
    const hitRange = BALL_HIT_RADIUS + DEFENDER_BODY_RADIUS;

    this.defenders.children.each((child) => {
      if (this.isGameOver) return false;

      const defender = child as Phaser.Physics.Arcade.Image;
      if (!defender.active) return true;

      const distance = Phaser.Math.Distance.Between(
        this.ball.x,
        this.ball.y,
        defender.x,
        defender.y,
      );
      if (distance <= hitRange) {
        this.endGame();
        return false;
      }
      return true;
    });
  }

  private spawnDefenders() {
    if (this.isGameOver) return;

    const { defenderCount } = DIFFICULTY_SETTINGS[this.difficulty];
    const spawnY = -DEFENDER_RADIUS - 10;

    for (let lane = 0; lane < defenderCount; lane++) {
      const x =
        defenderCount === 1
          ? Phaser.Math.Between(PITCH_MARGIN, GAME_WIDTH - PITCH_MARGIN)
          : this.randomXInLane(lane, defenderCount);
      this.spawnDefender(x, spawnY);
    }
  }

  private randomXInLane(lane: number, laneCount: number) {
    const pitchWidth = GAME_WIDTH - PITCH_MARGIN * 2;
    const laneWidth = pitchWidth / laneCount;
    const laneStart = PITCH_MARGIN + lane * laneWidth;
    const padding = DEFENDER_RADIUS;

    return Phaser.Math.Between(
      Math.ceil(laneStart + padding),
      Math.floor(laneStart + laneWidth - padding),
    );
  }

  private spawnDefender(x: number, y: number) {
    const defender = this.defenders.create(
      x,
      y,
      "defender",
    ) as Phaser.Physics.Arcade.Image;

    defender.setActive(true).setVisible(true);
    const body = defender.body as Phaser.Physics.Arcade.Body;
    body.setCircle(DEFENDER_BODY_RADIUS);
    body.setOffset(
      DEFENDER_RADIUS - DEFENDER_BODY_RADIUS,
      DEFENDER_RADIUS - DEFENDER_BODY_RADIUS,
    );
    body.setAllowGravity(false);
    body.setVelocity(0, this.scrollSpeed);
  }

  private updateDefenders() {
    this.defenders.children.each((child) => {
      const defender = child as Phaser.Physics.Arcade.Image;
      if (!defender.active) return true;

      const body = defender.body as Phaser.Physics.Arcade.Body;
      body.setVelocityY(this.scrollSpeed);

      if (defender.y > GAME_HEIGHT + DEFENDER_RADIUS + 40) {
        this.defenders.killAndHide(defender);
        body.enable = false;
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
    this.ball.anims.pause();
    this.player.anims.pause();
    this.player2?.anims.pause();

    const seconds = Math.floor(this.elapsedMs / 100) / 10;
    this.callbacks.onTick(seconds);
    this.callbacks.onGameOver(seconds);
  }
}
