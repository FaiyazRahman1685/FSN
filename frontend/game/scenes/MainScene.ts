import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import {
  DIFFICULTY_SETTINGS,
  type Difficulty,
} from "../difficulty";
import type { GameCallbacks } from "../events";
import {
  isCoopMultiplayer,
  isLocalMultiplayer,
  isOnlineMultiplayer,
  type PlayerNames,
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
  ORB_ANIM_FPS,
  ORB_ANIM_KEYS,
  ORB_COLORS,
  ORB_DISPLAY_H,
  ORB_DISPLAY_W,
  ORB_FRAME_H,
  ORB_FRAME_W,
  ORB_LABELS,
  ORB_POINTS_MULTIPLIER,
  ORB_PULSE_FRAMES,
  ORB_RADIUS,
  ORB_SHEET_KEY,
  ORB_SHEET_PATH,
  ORB_SPAWN_CHANCE,
  ORB_SPAWN_INTERVAL_MS,
  ORB_SPEED_MULTIPLIER,
  getOrbPowerUpDurationMs,
  randomOrbPowerUpType,
  type OrbPowerUpType,
} from "../orbPowerUps";
import { getSfxVolume } from "../audioVolumes";
import { createRng, type GameRng } from "../rng";
import {
  InputSyncBridge,
  TICK_MS,
} from "../network/inputSync";
import {
  KILL_BONUS_BASE,
  NEAR_MISS_BONUS_BASE,
  NEAR_MISS_MARGIN,
  ScoreManager,
  TIME_POINTS_PER_SECOND,
} from "../scoring";
import { PlayerScoreLedger, type PlayerSlot } from "../playerScores";

const PLAYER_DISPLAY_W = 64;
const PLAYER_DISPLAY_H = 64;
const BALL_SIZE = 20;
const PLAYER_SPEED = 280;
const BASE_SCROLL_SPEED = 180;
const SPAWN_INTERVAL_MS = 900;
const PITCH_MARGIN = 36;
const FORCED_PASS_START_DELAY_MS = 3000;
const FORCED_PASS_DEFENDER_GAP = 4;
const PLAYER_LABEL_RESERVE = 28;
const PLAYER_Y = GAME_HEIGHT - 70 - PLAYER_LABEL_RESERVE;
const BALL_PASS_SPEED = 1100;
const BALL_CATCH_DISTANCE = 14;
const POWER_UP_TINT = 0xff3030;
const POWER_UP_DURATION_MS = 2000;
const POWER_UP_AURA_RADIUS = 30;
const LABEL_GAP = 2;
const NAME_TAG_STYLE = {
  fontFamily: "Pixelify Sans, sans-serif",
  fontSize: "10px",
  color: "#ffffff",
  backgroundColor: "#00000099",
  padding: { x: 4, y: 1 },
} as const;
const POWER_UP_TIMER_STYLE = {
  fontFamily: "Pixelify Sans, sans-serif",
  fontSize: "11px",
  color: "#ffffff",
  padding: { x: 3, y: 1 },
} as const;
const PASS_TIMER_BG = "#991b1b";
const ORB_TIMER_BG: Record<OrbPowerUpType, string> = {
  doublePoints: "#a16207",
  invulnerability: "#1d4ed8",
  speedBoost: "#b91c1c",
};

type PowerUpSource =
  | { kind: "pass" }
  | { kind: "orb"; type: OrbPowerUpType };

type ActivePowerUp = {
  source: PowerUpSource;
  expiresAt: number;
  timer: Phaser.GameObjects.Text;
  aura?: Phaser.GameObjects.Arc;
};

function getPowerUpDurationMs(source: PowerUpSource) {
  if (source.kind === "pass") return POWER_UP_DURATION_MS;
  return getOrbPowerUpDurationMs(source.type);
}

function getPowerUpTimerBg(source: PowerUpSource) {
  if (source.kind === "pass") return PASS_TIMER_BG;
  return ORB_TIMER_BG[source.type];
}

function getPowerUpAuraColor(source: PowerUpSource) {
  if (source.kind === "pass") return POWER_UP_TINT;
  if (source.type === "invulnerability") return ORB_COLORS.invulnerability;
  return undefined;
}

/** ballgen 8×8 sheet (1024², 128px frames) — MIT / CC0 via OpenGameArt */
const BALL_FRAME = 128;
const BALL_ROLL_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7];
const BALL_ANIM_FPS = 12;

/** pixil-frame-0 sheet — 24×24 canvas frames, 6 cols × 5 character rows */
const PLAYER_FRAME = 24;
const PLAYER_SHEET_COLS = 6;
const PIXIL_PLAYER1_ROW = 1;
const PIXIL_PLAYER2_ROW = 4;
/** ops.png — same 6×5 / 24×24 grid; defender poses sit on row 1 */
const DEFENDER_ROW = 1;
const PLAYER1_RUN_FRAMES = Array.from(
  { length: PLAYER_SHEET_COLS },
  (_, i) => PIXIL_PLAYER1_ROW * PLAYER_SHEET_COLS + i,
);
const PLAYER2_RUN_FRAMES = Array.from(
  { length: PLAYER_SHEET_COLS },
  (_, i) => PIXIL_PLAYER2_ROW * PLAYER_SHEET_COLS + i,
);
const DEFENDER_RUN_FRAMES = Array.from(
  { length: PLAYER_SHEET_COLS },
  (_, i) => DEFENDER_ROW * PLAYER_SHEET_COLS + i,
);
const PLAYER_ANIM_FPS = 12;
const ANIM_TIMESCALE_MAX = 1.25;

export class MainScene extends Phaser.Scene {
  private callbacks!: GameCallbacks;
  private settings!: SessionSettings;
  private localMultiplayer = false;
  private onlineMultiplayer = false;
  private coopMultiplayer = false;
  private localSlot: 1 | 2 = 1;
  private inputSyncBridge?: InputSyncBridge;
  private rng!: GameRng;
  private simAccumulator = 0;
  private previousLocalPassDown = false;
  private player!: Phaser.GameObjects.Sprite;
  private player2?: Phaser.GameObjects.Sprite;
  private ballHolder!: Phaser.GameObjects.Sprite;
  private ball!: Phaser.GameObjects.Sprite;
  private isPassing = false;
  private activePowerUps = new Map<
    Phaser.GameObjects.Sprite,
    ActivePowerUp
  >();
  private orbs: Phaser.GameObjects.Sprite[] = [];
  private defenders!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyEnter!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private difficulty: Difficulty = "easy";
  private scrollSpeed = BASE_SCROLL_SPEED;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private orbSpawnTimer?: Phaser.Time.TimerEvent;
  private elapsedMs = 0;
  private nextForcedPassAtMs = FORCED_PASS_START_DELAY_MS;
  private lastReportedSeconds = -1;
  private isGameOver = false;
  private scoreManager!: ScoreManager;
  private playerScoreLedger = new PlayerScoreLedger();
  private playerNames!: PlayerNames;
  private playerNameTags = new Map<
    Phaser.GameObjects.Sprite,
    Phaser.GameObjects.Text
  >();

  constructor() {
    super("MainScene");
  }

  preload() {
    this.load.spritesheet("football", "/sprites/football-roll.png", {
      frameWidth: BALL_FRAME,
      frameHeight: BALL_FRAME,
      spacing: 0,
    });
    this.load.spritesheet("pixil-players", "/sprites/player2-run.png", {
      frameWidth: PLAYER_FRAME,
      frameHeight: PLAYER_FRAME,
    });
    this.load.spritesheet("defender-run-sheet", "/sprites/ops.png", {
      frameWidth: PLAYER_FRAME,
      frameHeight: PLAYER_FRAME,
    });
    this.load.spritesheet(ORB_SHEET_KEY, ORB_SHEET_PATH, {
      frameWidth: ORB_FRAME_W,
      frameHeight: ORB_FRAME_H,
    });
    this.load.image(
      "pitch-grass",
      "/background/Grass_23-512x512.png",
    );
    this.load.audio("whistle", "/sounds/whistle.wav");
    this.load.audio("powerup", "/sounds/powerup.wav");
    this.load.audio("kill", "/sounds/kill.wav");
  }

  create() {
    this.callbacks = this.registry.get("callbacks") as GameCallbacks;
    this.settings = this.registry.get("settings") as SessionSettings;
    this.difficulty = this.settings.difficulty;
    this.localMultiplayer = isLocalMultiplayer(this.settings);
    this.onlineMultiplayer = isOnlineMultiplayer(this.settings);
    this.coopMultiplayer = isCoopMultiplayer(this.settings);
    this.simAccumulator = 0;
    this.previousLocalPassDown = false;

    const seed =
      this.onlineMultiplayer && this.settings.online?.seed != null
        ? this.settings.online.seed
        : Date.now();
    this.rng = createRng(seed);

    if (this.onlineMultiplayer) {
      this.localSlot = this.settings.online!.slot;
      this.inputSyncBridge = this.registry.get("inputSyncBridge") as InputSyncBridge;
      this.inputSyncBridge?.reset(this.settings.online?.startedAt);
    }
    this.isGameOver = false;
    this.isPassing = false;
    this.orbs.forEach((orb) => orb.destroy());
    this.orbs = [];
    this.elapsedMs = 0;
    this.nextForcedPassAtMs = FORCED_PASS_START_DELAY_MS;
    this.lastReportedSeconds = -1;
    this.scoreManager = new ScoreManager((score) =>
      this.callbacks.onScoreChange(score),
    );
    this.scoreManager.reset();
    this.playerScoreLedger.reset();
    this.playerNames = this.settings.playerNames;
    this.playerNameTags.clear();
    this.clearAllActivePowerUps();
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
    this.textures.get("pixil-players").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures
      .get("defender-run-sheet")
      .setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get("football").setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get(ORB_SHEET_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
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
        frames: this.anims.generateFrameNumbers("pixil-players", {
          frames: PLAYER1_RUN_FRAMES,
        }),
        frameRate: PLAYER_ANIM_FPS,
        repeat: -1,
      });
    }

    if (!this.anims.exists("player2-run")) {
      this.anims.create({
        key: "player2-run",
        frames: this.anims.generateFrameNumbers("pixil-players", {
          frames: PLAYER2_RUN_FRAMES,
        }),
        frameRate: PLAYER_ANIM_FPS,
        repeat: -1,
      });
    }

    if (!this.anims.exists("defender-run")) {
      this.anims.create({
        key: "defender-run",
        frames: this.anims.generateFrameNumbers("defender-run-sheet", {
          frames: DEFENDER_RUN_FRAMES,
        }),
        frameRate: PLAYER_ANIM_FPS,
        repeat: -1,
      });
    }

    for (const type of Object.keys(ORB_ANIM_KEYS) as OrbPowerUpType[]) {
      const animKey = ORB_ANIM_KEYS[type];
      if (this.anims.exists(animKey)) continue;
      this.anims.create({
        key: animKey,
        frames: this.anims.generateFrameNumbers(ORB_SHEET_KEY, {
          frames: ORB_PULSE_FRAMES[type],
        }),
        frameRate: ORB_ANIM_FPS,
        repeat: -1,
      });
    }

    const p1X = this.coopMultiplayer ? GAME_WIDTH / 2 - 70 : GAME_WIDTH / 2;
    this.player = this.createRunner(p1X, false, this.playerNames.player1);
    this.ballHolder = this.player;

    if (this.coopMultiplayer) {
      this.player2 = this.createRunner(
        GAME_WIDTH / 2 + 70,
        true,
        this.playerNames.player2,
      );
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

    this.orbSpawnTimer = this.time.addEvent({
      delay: ORB_SPAWN_INTERVAL_MS,
      callback: this.trySpawnOrb,
      callbackScope: this,
      loop: true,
    });

    this.spawnDefenders();
    this.time.delayedCall(400, () => this.spawnDefenders());
    this.time.delayedCall(1500, () => this.trySpawnOrb());

    this.sound.play("whistle", { volume: getSfxVolume() });
  }

  update(_time: number, delta: number) {
    if (this.isGameOver) return;

    if (this.onlineMultiplayer) {
      this.simAccumulator += delta;
      while (this.simAccumulator >= TICK_MS) {
        this.simStep(TICK_MS);
        this.simAccumulator -= TICK_MS;
      }
      return;
    }

    this.simStep(delta);
  }

  private simStep(delta: number) {
    if (this.isGameOver) return;

    this.elapsedMs += delta;
    this.addTimePointsForPlayers(delta);
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

    if (this.onlineMultiplayer && this.player2 && this.inputSyncBridge) {
      const localKeys = this.readLocalInputKeys();
      this.inputSyncBridge.publishLocalInput(localKeys);

      if (this.localSlot === 1) {
        this.applyDirectionalInput(this.player, localKeys.left, localKeys.right, delta);
        const remote = this.inputSyncBridge.getRemoteInput();
        this.applyDirectionalInput(this.player2, remote.left, remote.right, delta);
        this.handleNetworkPass(this.localSlot === 1, localKeys.pass, remote.passPressed);
      } else {
        const remote = this.inputSyncBridge.getRemoteInput();
        this.applyDirectionalInput(this.player, remote.left, remote.right, delta);
        this.applyDirectionalInput(this.player2, localKeys.left, localKeys.right, delta);
        this.handleNetworkPass(this.localSlot === 2, remote.passPressed, localKeys.pass);
      }
    } else {
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
    }

    this.updateBall(delta);
    this.updateNameTags();
    this.updateActivePowerUps();
    this.syncPointsMultiplier();
    this.updateOrbs(delta);
    this.checkOrbCollisions();
    this.updateDefenders();
    this.checkPlayerDefenderCollisions();
    this.checkNearMisses();
  }

  private readLocalInputKeys() {
    if (this.localSlot === 1) {
      return {
        left: this.cursors.left.isDown,
        right: this.cursors.right.isDown,
        pass: this.keyEnter.isDown,
      };
    }
    return {
      left: this.keyA.isDown,
      right: this.keyD.isDown,
      pass: this.keySpace.isDown,
    };
  }

  private applyDirectionalInput(
    runner: Phaser.GameObjects.Sprite,
    left: boolean,
    right: boolean,
    delta: number,
  ) {
    const step =
      (PLAYER_SPEED * this.getSpeedMultiplier(runner) * delta) / 1000;

    if (left) {
      runner.x -= step;
    } else if (right) {
      runner.x += step;
    }

    const minX = PITCH_MARGIN + PLAYER_VISUAL_RADIUS;
    const maxX = GAME_WIDTH - PITCH_MARGIN - PLAYER_VISUAL_RADIUS;
    runner.x = Phaser.Math.Clamp(Math.round(runner.x), minX, maxX);
    runner.y = PLAYER_Y;
  }

  private handleNetworkPass(
    localIsP1: boolean,
    localPassDown: boolean,
    remotePassPressed: boolean,
  ) {
    if (!this.player2 || this.isPassing) return;

    const localRunner = localIsP1 ? this.player : this.player2;
    const remoteRunner = localIsP1 ? this.player2 : this.player;
    const localPassTriggered =
      localPassDown &&
      !this.previousLocalPassDown &&
      this.ballHolder === localRunner;
    this.previousLocalPassDown = localPassDown;

    const remotePassTriggered =
      remotePassPressed && this.ballHolder === remoteRunner;

    if (!localPassTriggered && !remotePassTriggered) return;

    const passer = localPassTriggered ? localRunner : remoteRunner;
    const receiver = passer === this.player ? this.player2! : this.player;
    this.grantPassPowerUp(passer);
    this.isPassing = true;
    this.ballHolder = receiver;
  }

  private createRunner(
    x: number,
    isPlayer2 = false,
    displayName = isPlayer2 ? "Player 2" : "Player 1",
  ) {
    const animKey = isPlayer2 ? "player2-run" : "player-run";
    const startFrame = isPlayer2 ? PLAYER2_RUN_FRAMES[0] : PLAYER1_RUN_FRAMES[0];
    const runner = this.add.sprite(x, PLAYER_Y, "pixil-players", startFrame);
    runner.setDisplaySize(PLAYER_DISPLAY_W, PLAYER_DISPLAY_H);
    runner.setOrigin(0.5, 0.5);
    runner.play(animKey);
    this.createNameTag(runner, displayName);
    return runner;
  }

  private createNameTag(runner: Phaser.GameObjects.Sprite, displayName: string) {
    const tag = this.add
      .text(runner.x, runner.y, displayName, NAME_TAG_STYLE)
      .setOrigin(0.5, 0)
      .setDepth(6);
    tag.setPosition(runner.x, this.nameTagY(runner));
    this.playerNameTags.set(runner, tag);
  }

  private playerFeetY(runner: Phaser.GameObjects.Sprite) {
    return runner.y + PLAYER_DISPLAY_H / 2;
  }

  private nameTagY(runner: Phaser.GameObjects.Sprite) {
    return this.playerFeetY(runner) + LABEL_GAP;
  }

  private updateNameTags() {
    for (const runner of this.getRunners()) {
      const tag = this.playerNameTags.get(runner);
      tag?.setPosition(runner.x, this.nameTagY(runner));
    }
  }

  private powerUpTimerY(runner: Phaser.GameObjects.Sprite) {
    const nameTag = this.playerNameTags.get(runner);
    if (nameTag) {
      return nameTag.y + nameTag.height + LABEL_GAP;
    }
    return this.nameTagY(runner) + 12 + LABEL_GAP;
  }

  private getPlayerSlot(runner: Phaser.GameObjects.Sprite): PlayerSlot {
    return runner === this.player2 ? "p2" : "p1";
  }

  private getOrbPointsMultiplier() {
    return this.getRunners().some((runner) => {
      const powerUp = this.getActivePowerUp(runner);
      return (
        powerUp?.source.kind === "orb" && powerUp.source.type === "doublePoints"
      );
    })
      ? ORB_POINTS_MULTIPLIER
      : 1;
  }

  private addTimePointsForPlayers(delta: number) {
    this.scoreManager.addTimePoints(delta, this.elapsedMs);
    const points =
      (delta / 1000) * TIME_POINTS_PER_SECOND * this.getOrbPointsMultiplier();

    if (points <= 0) return;

    this.playerScoreLedger.add("p1", points);
    if (this.player2) {
      this.playerScoreLedger.add("p2", points);
    }
  }

  private creditPlayerBonus(
    runner: Phaser.GameObjects.Sprite,
    basePoints: number,
  ) {
    this.playerScoreLedger.add(
      this.getPlayerSlot(runner),
      basePoints * this.getOrbPointsMultiplier(),
    );
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
    const step =
      (PLAYER_SPEED * this.getSpeedMultiplier(runner) * delta) / 1000;

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
    if (!this.coopMultiplayer || !this.player2 || this.isPassing) return;

    const passKey =
      this.ballHolder === this.player ? this.keyEnter : this.keySpace;
    if (!Phaser.Input.Keyboard.JustDown(passKey)) return;

    const passer = this.ballHolder;
    const receiver = this.ballHolder === this.player ? this.player2 : this.player;
    this.grantPassPowerUp(passer);
    this.isPassing = true;
    this.ballHolder = receiver;
  }

  private grantPassPowerUp(runner: Phaser.GameObjects.Sprite) {
    this.grantActivePowerUp(runner, { kind: "pass" });
  }

  private getRunners() {
    return this.player2 ? [this.player, this.player2] : [this.player];
  }

  private getActivePowerUp(runner: Phaser.GameObjects.Sprite) {
    const powerUp = this.activePowerUps.get(runner);
    if (!powerUp || this.elapsedMs >= powerUp.expiresAt) return undefined;
    return powerUp;
  }

  private grantActivePowerUp(
    runner: Phaser.GameObjects.Sprite,
    source: PowerUpSource,
  ) {
    this.clearActivePowerUp(runner);

    const durationMs = getPowerUpDurationMs(source);
    const expiresAt = this.elapsedMs + durationMs;
    const initialSeconds = durationMs / 1000;
    const timer = this.add
      .text(
        runner.x,
        runner.y,
        `${initialSeconds.toFixed(1)}s`,
        {
          ...POWER_UP_TIMER_STYLE,
          backgroundColor: getPowerUpTimerBg(source),
        },
      )
      .setOrigin(0.5, 0)
      .setDepth(7);

    const auraColor = getPowerUpAuraColor(source);
    let aura: Phaser.GameObjects.Arc | undefined;
    if (auraColor !== undefined) {
      aura = this.add
        .circle(
          runner.x,
          runner.y,
          POWER_UP_AURA_RADIUS,
          auraColor,
          0.28,
        )
        .setDepth(1)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: aura,
        alpha: { from: 0.18, to: 0.42 },
        scale: { from: 0.85, to: 1.15 },
        duration: 300,
        yoyo: true,
        repeat: -1,
      });
    }

    this.activePowerUps.set(runner, { source, expiresAt, timer, aura });
    this.applyRunnerTint(runner);
    this.sound.play("powerup", { volume: getSfxVolume() });
  }

  private updateActivePowerUps() {
    for (const runner of this.getRunners()) {
      const powerUp = this.activePowerUps.get(runner);
      if (!powerUp) continue;

      if (this.elapsedMs >= powerUp.expiresAt) {
        this.clearActivePowerUp(runner);
        continue;
      }

      powerUp.aura?.setPosition(runner.x, runner.y);
      const remainingSeconds =
        Math.ceil((powerUp.expiresAt - this.elapsedMs) / 100) / 10;
      powerUp.timer
        .setText(`${remainingSeconds.toFixed(1)}s`)
        .setPosition(runner.x, this.powerUpTimerY(runner));
    }
  }

  private clearActivePowerUp(runner: Phaser.GameObjects.Sprite) {
    const powerUp = this.activePowerUps.get(runner);
    if (!powerUp) return;

    if (powerUp.aura) {
      this.tweens.killTweensOf(powerUp.aura);
      powerUp.aura.destroy();
    }
    powerUp.timer.destroy();
    this.activePowerUps.delete(runner);
    this.applyRunnerTint(runner);
  }

  private clearAllActivePowerUps() {
    [...this.activePowerUps.keys()].forEach((runner) =>
      this.clearActivePowerUp(runner),
    );
    this.scoreManager.setPointsMultiplier(1);
  }

  private isPlayerInvulnerable(runner: Phaser.GameObjects.Sprite) {
    const powerUp = this.getActivePowerUp(runner);
    if (!powerUp) return false;
    return (
      powerUp.source.kind === "pass" ||
      (powerUp.source.kind === "orb" &&
        powerUp.source.type === "invulnerability")
    );
  }

  private getSpeedMultiplier(runner: Phaser.GameObjects.Sprite) {
    const powerUp = this.getActivePowerUp(runner);
    return powerUp?.source.kind === "orb" &&
      powerUp.source.type === "speedBoost"
      ? ORB_SPEED_MULTIPLIER
      : 1;
  }

  private syncPointsMultiplier() {
    const hasDoublePoints = this.getRunners().some((runner) => {
      const powerUp = this.getActivePowerUp(runner);
      return (
        powerUp?.source.kind === "orb" && powerUp.source.type === "doublePoints"
      );
    });
    this.scoreManager.setPointsMultiplier(
      hasDoublePoints ? ORB_POINTS_MULTIPLIER : 1,
    );
  }

  private applyRunnerTint(runner: Phaser.GameObjects.Sprite) {
    const powerUp = this.getActivePowerUp(runner);
    if (powerUp?.source.kind === "pass") {
      runner.setTint(POWER_UP_TINT);
      return;
    }
    if (
      powerUp?.source.kind === "orb" &&
      powerUp.source.type === "speedBoost"
    ) {
      runner.setTint(ORB_COLORS.speedBoost);
      return;
    }
    runner.clearTint();
  }

  private trySpawnOrb() {
    if (this.isGameOver || this.rng.next() >= ORB_SPAWN_CHANCE) return;

    const type = randomOrbPowerUpType(this.rng);
    const x = this.rng.between(
      PITCH_MARGIN + ORB_RADIUS,
      GAME_WIDTH - PITCH_MARGIN - ORB_RADIUS,
    );
    const y = -ORB_RADIUS - 10;

    const orb = this.add
      .sprite(x, y, ORB_SHEET_KEY, ORB_PULSE_FRAMES[type][0])
      .setDepth(2)
      .setDisplaySize(ORB_DISPLAY_W, ORB_DISPLAY_H)
      .setData("type", type);
    orb.play(ORB_ANIM_KEYS[type]);

    this.orbs.push(orb);
  }

  private updateOrbs(delta: number) {
    for (let index = this.orbs.length - 1; index >= 0; index -= 1) {
      const orb = this.orbs[index];
      orb.y += (this.scrollSpeed * delta) / 1000;

      if (orb.y > GAME_HEIGHT + ORB_RADIUS + 20) {
        orb.destroy();
        this.orbs.splice(index, 1);
      }
    }
  }

  private checkOrbCollisions() {
    for (let index = this.orbs.length - 1; index >= 0; index -= 1) {
      const orb = this.orbs[index];
      const type = orb.getData("type") as OrbPowerUpType;

      for (const runner of this.getRunners()) {
        if (
          !circlesOverlap(
            runner.x,
            runner.y,
            PLAYER_VISUAL_RADIUS,
            orb.x,
            orb.y,
            ORB_RADIUS,
          )
        ) {
          continue;
        }

        this.collectOrb(orb, index, runner, type);
        break;
      }
    }
  }

  private collectOrb(
    orb: Phaser.GameObjects.Sprite,
    index: number,
    runner: Phaser.GameObjects.Sprite,
    type: OrbPowerUpType,
  ) {
    const { x, y } = orb;
    orb.destroy();
    this.orbs.splice(index, 1);

    const burst = this.add
      .circle(x, y, ORB_RADIUS, ORB_COLORS[type], 0.85)
      .setDepth(4)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: burst,
      alpha: 0,
      scale: 2.2,
      duration: 220,
      ease: "Quad.easeOut",
      onComplete: () => burst.destroy(),
    });

    this.applyOrbPowerUp(runner, type);
    this.scoreManager.notifyPowerUp(ORB_LABELS[type], this.elapsedMs);
  }

  private applyOrbPowerUp(
    runner: Phaser.GameObjects.Sprite,
    type: OrbPowerUpType,
  ) {
    this.grantActivePowerUp(runner, { kind: "orb", type });
  }

  private clearOrbEffects() {
    this.orbs.forEach((orb) => orb.destroy());
    this.orbs = [];
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
    const powerUp = this.getActivePowerUp(this.ballHolder);
    if (powerUp?.source.kind === "pass") {
      this.clearActivePowerUp(this.ballHolder);
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

        if (this.isPlayerInvulnerable(runner)) {
          this.destroyDefenderWithGlow(defender, runner);
        } else {
          this.endGame();
        }
        return false;
      }

      return true;
    });
  }

  private destroyDefenderWithGlow(
    defender: Phaser.Physics.Arcade.Sprite,
    runner: Phaser.GameObjects.Sprite,
  ) {
    const { x, y } = defender;
    defender.anims.pause();
    this.defenders.killAndHide(defender);
    (defender.body as Phaser.Physics.Arcade.Body).enable = false;
    this.sound.play("kill", { volume: getSfxVolume() });
    this.scoreManager.awardKill(this.elapsedMs);
    this.creditPlayerBonus(runner, KILL_BONUS_BASE);

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
          ? this.rng.between(PITCH_MARGIN, GAME_WIDTH - PITCH_MARGIN)
          : this.randomXInLane(lane, settings.defenderCount);
      this.spawnDefender(x, spawnY);
    }
  }

  private shouldSpawnForcedPassWall(chance: number) {
    return (
      this.coopMultiplayer &&
      !this.isPassing &&
      this.elapsedMs >= this.nextForcedPassAtMs &&
      this.rng.next() < chance
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

    return this.rng.between(
      Math.ceil(laneStart + padding),
      Math.floor(laneStart + laneWidth - padding),
    );
  }

  private spawnDefender(x: number, y: number) {
    const defender = this.defenders.create(
      x,
      y,
      "defender-run-sheet",
      DEFENDER_RUN_FRAMES[0],
    ) as Phaser.Physics.Arcade.Sprite;

    defender
      .setActive(true)
      .setVisible(true)
      .setDisplaySize(PLAYER_DISPLAY_W, PLAYER_DISPLAY_H)
      .setOrigin(0.5, 0.5)
      .clearTint()
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
          this.creditPlayerBonus(runner, NEAR_MISS_BONUS_BASE);
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
    this.orbSpawnTimer?.remove(false);
    this.physics.pause();
    this.clearAllActivePowerUps();
    this.clearOrbEffects();
    this.ball.anims.pause();
    this.player.anims.pause();
    this.player2?.anims.pause();
    this.defenders.children.each((child) => {
      (child as Phaser.Physics.Arcade.Sprite).anims.pause();
      return true;
    });

    this.scoreManager.finalizeStreak();

    const seconds = Math.floor(this.elapsedMs / 100) / 10;
    const totalScore = this.scoreManager.getFinalScore();
    this.playerScoreLedger.distributeRemainder(totalScore, Boolean(this.player2));

    this.callbacks.onTick(seconds);
    this.callbacks.onGameOver({
      seconds,
      totalScore,
      players: this.player2
        ? [
            {
              name: this.playerNames.player1,
              score: this.playerScoreLedger.get("p1"),
            },
            {
              name: this.playerNames.player2,
              score: this.playerScoreLedger.get("p2"),
            },
          ]
        : [
            {
              name: this.playerNames.player1,
              score: totalScore,
            },
          ],
    });
  }
}
