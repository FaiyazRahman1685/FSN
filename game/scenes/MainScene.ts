import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../constants";
import type { GameCallbacks } from "../events";

const PLAYER_RADIUS = 22;
const BALL_RADIUS = 8;
const DEFENDER_RADIUS = 20;
const PLAYER_SPEED = 280;
const BASE_SCROLL_SPEED = 180;
const SPAWN_INTERVAL_MS = 900;
const PITCH_MARGIN = 36;
const LINE_SPACING = 80;

export class MainScene extends Phaser.Scene {
  private callbacks!: GameCallbacks;
  private player!: Phaser.Physics.Arcade.Image;
  private ball!: Phaser.GameObjects.Arc;
  private defenders!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private laneLines: Phaser.GameObjects.Rectangle[] = [];
  private lineOffset = 0;
  private scrollSpeed = BASE_SCROLL_SPEED;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private elapsedMs = 0;
  private lastReportedSeconds = -1;
  private isGameOver = false;

  constructor() {
    super("MainScene");
  }

  create() {
    this.callbacks = this.registry.get("callbacks") as GameCallbacks;
    this.isGameOver = false;
    this.elapsedMs = 0;
    this.lastReportedSeconds = -1;
    this.scrollSpeed = BASE_SCROLL_SPEED;
    this.lineOffset = 0;

    this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x2d8a4e,
    );

    this.laneLines = [];
    const lineCount = Math.ceil(GAME_HEIGHT / LINE_SPACING) + 2;
    for (let i = 0; i < lineCount; i++) {
      const line = this.add.rectangle(
        GAME_WIDTH / 2,
        i * LINE_SPACING,
        GAME_WIDTH * 0.7,
        3,
        0xffffff,
        0.22,
      );
      this.laneLines.push(line);
    }

    // Left / right touchlines
    this.add.rectangle(18, GAME_HEIGHT / 2, 4, GAME_HEIGHT, 0xffffff, 0.35);
    this.add.rectangle(
      GAME_WIDTH - 18,
      GAME_HEIGHT / 2,
      4,
      GAME_HEIGHT,
      0xffffff,
      0.35,
    );

    this.createCircleTexture("player", PLAYER_RADIUS, 0xe63946);
    this.createCircleTexture("defender", DEFENDER_RADIUS, 0x1d4ed8);
    this.createCircleTexture("ball", BALL_RADIUS, 0xffffff);

    const playerY = GAME_HEIGHT - 70;
    this.player = this.physics.add.image(GAME_WIDTH / 2, playerY, "player");
    this.player.setCollideWorldBounds(true);
    this.player.setImmovable(true);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setCircle(PLAYER_RADIUS);
    playerBody.setOffset(0, 0);

    this.ball = this.add.circle(
      this.player.x,
      this.player.y - PLAYER_RADIUS - BALL_RADIUS + 2,
      BALL_RADIUS,
      0xffffff,
    );
    this.ball.setStrokeStyle(1, 0xcccccc);

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

    this.cursors = this.input.keyboard!.createCursorKeys();

    this.spawnTimer = this.time.addEvent({
      delay: SPAWN_INTERVAL_MS,
      callback: this.spawnDefender,
      callbackScope: this,
      loop: true,
    });

    // Prime a couple defenders so the field isn't empty
    this.spawnDefender();
    this.time.delayedCall(400, () => this.spawnDefender());
  }

  update(_time: number, delta: number) {
    if (this.isGameOver) return;

    this.elapsedMs += delta;
    const seconds = Math.floor(this.elapsedMs / 100) / 10;
    if (seconds !== this.lastReportedSeconds) {
      this.lastReportedSeconds = seconds;
      this.callbacks.onTick(seconds);
    }

    // Mild speed ramp
    this.scrollSpeed = BASE_SCROLL_SPEED + this.elapsedMs / 1000 * 8;

    this.updateLaneLines(delta);
    this.handlePlayerInput();
    this.syncBall();
    this.updateDefenders();
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

  private updateLaneLines(delta: number) {
    const shift = (this.scrollSpeed * delta) / 1000;
    this.lineOffset = (this.lineOffset + shift) % LINE_SPACING;

    this.laneLines.forEach((line, i) => {
      line.y = i * LINE_SPACING + this.lineOffset - LINE_SPACING;
    });
  }

  private handlePlayerInput() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(0);

    if (this.cursors.left?.isDown) {
      body.setVelocityX(-PLAYER_SPEED);
    } else if (this.cursors.right?.isDown) {
      body.setVelocityX(PLAYER_SPEED);
    }

    this.player.y = GAME_HEIGHT - 70;
    body.y = this.player.y - PLAYER_RADIUS;
  }

  private syncBall() {
    this.ball.setPosition(
      this.player.x,
      this.player.y - PLAYER_RADIUS - BALL_RADIUS + 2,
    );
  }

  private spawnDefender() {
    if (this.isGameOver) return;

    const x = Phaser.Math.Between(PITCH_MARGIN, GAME_WIDTH - PITCH_MARGIN);
    const defender = this.defenders.create(
      x,
      -DEFENDER_RADIUS - 10,
      "defender",
    ) as Phaser.Physics.Arcade.Image;

    defender.setActive(true).setVisible(true);
    const body = defender.body as Phaser.Physics.Arcade.Body;
    body.setCircle(DEFENDER_RADIUS);
    body.setOffset(0, 0);
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

    this.spawnTimer?.remove(false);
    this.physics.pause();

    const seconds = Math.floor(this.elapsedMs / 100) / 10;
    this.callbacks.onTick(seconds);
    this.callbacks.onGameOver(seconds);
  }
}
