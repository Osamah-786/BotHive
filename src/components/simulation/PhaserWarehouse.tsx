import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createAMR, type AMRController } from '../custom-assets/AMR';
import { createAisle } from '../custom-assets/Aisle';
import { createObstacle } from '../custom-assets/Obstacle';
import { createWarehouseBlock } from '../custom-assets/WarehouseBlock';
import { useSimStore } from '../../store/useSimStore';
import { GRID_COLS, GRID_ROWS, WAREHOUSE_GRID } from '../../engine/warehouse';
import type { P2PLink, Robot } from '../../engine/types';
import chargingStationSheet from '../../../charging_station.png';

const CELL = 100;
const WORLD_WIDTH = GRID_COLS * CELL;
const WORLD_HEIGHT = GRID_ROWS * CELL;
const CLOUD = 0xc45d5d;
const KILLED = 0xd94f4f;
const MESH = 0x23855f;

type Side = 'traditional' | 'proposed';

interface WarehouseFrame {
  robots: Robot[];
  blockedCells: Set<string>;
  links: P2PLink[];
  isPlaying: boolean;
  completedTasks: number;
  /** Remaining physical boxes in each stack, indexed 0 = Stack 1, 1 = Stack 2, 2 = Stack 3 */
  stackBoxes: number[];
  /**
   * Whether each robot (indexed 0 = R1, 1 = R2, 2 = R3) is currently
   * carrying stock (i.e. on the dropoff leg). Used to drain the source rack
   * immediately when the robot picks up, not just on delivery completion.
   */
  robotCarrying: boolean[];
  /** True when the warehouse power grid is down — warehouse lights dim and chargers are disabled. */
  powerOutage: boolean;
}

interface RobotVisual {
  controller: AMRController;
  label: Phaser.GameObjects.Text;
  state: Phaser.GameObjects.Arc;
  killedOverlay: Phaser.GameObjects.Graphics;
  lastPosition: { x: number; y: number };
  carrying: boolean;
}

interface PhaserWarehouseProps {
  side: Side;
}

/**
 * The production warehouse renderer. It intentionally reads the existing engine
 * state instead of reimplementing routing inside Phaser, so visual assets and
 * simulation logic can evolve independently.
 */
export function PhaserWarehouse({ side }: PhaserWarehouseProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<WarehouseScene | null>(null);
  const robots = useSimStore((state) => (side === 'traditional' ? state.traditional.robots : state.proposed.robots));
  const stackBoxes = useSimStore((state) => (side === 'traditional' ? state.traditional.stackBoxes : state.proposed.stackBoxes));
  const blockedCells = useSimStore((state) => state.blockedCells);
  const links = useSimStore((state) => state.proposed.p2pLinks);
  const isPlaying = useSimStore((state) => state.isPlaying);
  const completedTasks = useSimStore((state) => (side === 'traditional'
    ? state.traditional.metrics.totalTasksCompleted
    : state.proposed.metrics.totalTasksCompleted));
  const powerOutage = useSimStore((state) => !state.warehousePower);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const scene = new WarehouseScene(side);
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#fbf1eb',
      transparent: false,
      antialias: true,
      render: { pixelArt: false, roundPixels: true },
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: parent.clientWidth,
        height: parent.clientHeight,
      },
      scene,
    });

    return () => {
      sceneRef.current = null;
      game.destroy(true);
    };
  }, [side]);

  useEffect(() => {
    const robotCarrying = [false, false, false];

    for (const robot of robots) {
      // An item is in-transit if ANY robot assigned to this rack is physically carrying it.
      // (A dead robot holds it until the coverer completes the rescue transit)
      const isCarrying = robot.task === 'dropoff' && !robot.rescueFromPosition;
      robotCarrying[robot.stationIndex] = robotCarrying[robot.stationIndex] || isCarrying;
    }

     sceneRef.current?.sync({
      robots,
      blockedCells,
      links: side === 'proposed' ? links : [],
      isPlaying,
      completedTasks,
      stackBoxes,
      robotCarrying,
      powerOutage,
    });
  }, [robots, stackBoxes, blockedCells, links, isPlaying, completedTasks, side, powerOutage]);

  return <div ref={parentRef} className="h-full w-full" aria-label={`${side} live warehouse`} />;
}

// ─── Per-robot rack layout ─────────────────────────────────────────────────────
// Racks are placed directly adjacent to the P/D stations so robots visually
// appear to pick from and deliver to their own shelf.
//
// Station positions (from warehouse.ts):
//   P1/D1 → row 2   |  P2/D2 → row 7  |  P3/D3 → row 11
//
// Each rack is 2 bays wide (~2 cells) and 2 cells tall, placed one row ABOVE
// the matching station so the station badge shows below the rack face.

const RACK_BAYS = 2; // narrow enough to sit beside P/D stations
const RACK_H_CELLS = 2; // rack visually spans 2 grid rows

// Vertical anchor: place rack top at (station_row - RACK_H_CELLS) so the rack
// sits immediately above the station tile.
const STATION_ROWS = [2, 7, 11] as const; // matches P1/D1, P2/D2, P3/D3

// Horizontal: source racks hug the left wall (col 0), dest racks hug right (col 17).
const SRC_RACK_COL = 0;
const DST_RACK_COL = 17;

const ROBOT_THEMES = [
  { body: 0x3b82f6, dark: 0x1d4ed8, light: 0x93c5fd },
  { body: 0x22c55e, dark: 0x15803d, light: 0x86efac },
  { body: 0xeab308, dark: 0xa16207, light: 0xfde047 },
] as const;

const ROBOT_ACCENT_COLORS = [ROBOT_THEMES[0].body, ROBOT_THEMES[1].body, ROBOT_THEMES[2].body] as const;
const ROBOT_LABELS = ['R1', 'R2', 'R3'] as const;

class WarehouseScene extends Phaser.Scene {
  private readonly robots = new Map<string, RobotVisual>();
  private readonly obstacles = new Map<string, ReturnType<typeof createObstacle>>();

  /**
   * Dedicated inventory racks — one per robot (0/1/2 = R1/R2/R3).
   * sourceRacks[i] empties; destRacks[i] fills.
   */
  private readonly sourceRacks: ReturnType<typeof createAisle>[] = [];
  private readonly destRacks: ReturnType<typeof createAisle>[] = [];

  /** Stored charging-station visuals for on/off dimming. */
  private readonly chargingStations = new Map<
    string,
    { image: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; highlight: Phaser.GameObjects.Graphics }
  >();

  /** Full-world overlay that dims lights when the grid is down. */
  private powerOverlay!: Phaser.GameObjects.Graphics;

  private frame: WarehouseFrame | null = null;
  private linkLayer!: Phaser.GameObjects.Graphics;
  private pathLayer!: Phaser.GameObjects.Graphics;
  private readonly side: Side;
  private lastStackBoxes: number[] = [-1, -1, -1];
  private lastRobotCarrying: boolean[] = [false, false, false];
  private lastPowerOutage: boolean = false;

  constructor(side: Side) {
    super(`warehouse-${side}`);
    this.side = side;
  }

  create() {
    this.cameras.main.setBackgroundColor('#fbf1eb');
    this.buildFloor();
    this.buildDecorativeBlocks();
    this.buildDedicatedRacks();
    this.buildStations();          // stations drawn on top of racks
    this.buildChargingStations();
    this.pathLayer = this.add.graphics().setDepth(34);
    this.linkLayer = this.add.graphics().setDepth(35);
    this.buildPowerOverlay();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.fitCamera();

    if (this.frame) this.renderFrame(this.frame, false);
  }

  preload() {
    this.load.image('charging-station-sheet', chargingStationSheet);
  }

  sync(frame: WarehouseFrame) {
    this.frame = frame;
    if (this.sys.isActive()) this.renderFrame(frame, true);
  }

  private fitCamera() {
    const { width, height } = this.scale;
    const zoom = Math.min(width / (WORLD_WIDTH + 150), height / (WORLD_HEIGHT + 140));
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
  }

  private buildFloor() {
    const floor = this.add.graphics().setDepth(0);
    floor.fillStyle(0xfdfdfc, 1);
    floor.fillRoundedRect(18, 18, WORLD_WIDTH - 36, WORLD_HEIGHT - 36, 18);
    floor.lineStyle(2, 0xe2ded9, 1);
    floor.strokeRoundedRect(18, 18, WORLD_WIDTH - 36, WORLD_HEIGHT - 36, 18);

    floor.lineStyle(1, 0xe7ecee, 0.9);
    for (let x = CELL; x < WORLD_WIDTH; x += CELL) floor.lineBetween(x, 18, x, WORLD_HEIGHT - 18);
    for (let y = CELL; y < WORLD_HEIGHT; y += CELL) floor.lineBetween(18, y, WORLD_WIDTH - 18, y);

    floor.lineStyle(3, 0xd9e4e5, 0.7);
    [250, 650, 1_050].forEach((y) => floor.lineBetween(24, y, WORLD_WIDTH - 24, y));
    floor.lineStyle(2, 0xd8b36b, 0.35);
    for (let x = 40; x < WORLD_WIDTH; x += 55) {
      floor.lineBetween(x, 48, x + 28, 48);
      floor.lineBetween(x, WORLD_HEIGHT - 48, x + 28, WORLD_HEIGHT - 48);
    }

    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (WAREHOUSE_GRID[y][x].type !== 'floor') continue;
        const hitArea = this.add.zone(x * CELL, y * CELL, CELL, CELL).setOrigin(0).setDepth(2).setInteractive();
        hitArea.on(Phaser.Input.Events.POINTER_DOWN, () => {
          useSimStore.getState().toggleBlockCell(x, y);
        });
      }
    }
  }

  private buildStations() {
    const stations = this.add.graphics().setDepth(10);
    for (const row of WAREHOUSE_GRID) {
      for (const cell of row) {
        if (cell.type !== 'pickup' && cell.type !== 'dropoff') continue;
        const color = cell.type === 'pickup' ? 0xf0c45f : 0xe9a15b;
        const x = cell.x * CELL + 8;
        const y = cell.y * CELL + 8;
        stations.fillStyle(color, 0.92);
        stations.fillRoundedRect(x, y, CELL - 16, CELL - 16, 8);
        stations.lineStyle(3, 0x0a1c1d, 0.7);
        stations.strokeRoundedRect(x, y, CELL - 16, CELL - 16, 8);
        stations.lineStyle(2, 0x0a1c1d, 0.45);
        stations.lineBetween(x + 12, y + CELL / 2 - 8, x + CELL - 28, y + CELL / 2 - 8);
        stations.lineBetween(x + 12, y + CELL / 2 + 8, x + CELL - 28, y + CELL / 2 + 8);

        this.add
          .text(cell.x * CELL + CELL / 2, cell.y * CELL + CELL / 2, cell.label ?? '', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
            fontStyle: 'bold',
          color: '#5a4630',
          })
          .setOrigin(0.5)
          .setDepth(12);
      }
    }
  }

  private buildChargingStations() {
    for (const row of WAREHOUSE_GRID) {
      for (const cell of row) {
        if (cell.type !== 'charging') continue;
        const visualX = cell.x * CELL;
        const visualY = cell.y * CELL;

        const highlight = this.add.graphics().setDepth(23);
        highlight.fillStyle(0xf4fbf8, 1);
        highlight.fillRoundedRect(
          visualX + 9,
          visualY + 9,
          CELL - 18,
          CELL - 18,
          12,
        );
        highlight.lineStyle(3, 0x8ec9ae, 1);
        highlight.strokeRoundedRect(
          visualX + 5,
          visualY + 5,
          CELL - 10,
          CELL - 10,
          14,
        );

        const image = this.add
          .image(visualX + CELL / 2, visualY + CELL / 2 - 4, 'charging-station-sheet')
          .setCrop(0, 50, 320, 360)
          .setTint(0x78b995)
          .setDisplaySize(70, 78)
          .setDepth(24);

        const label = this.add
          .text(visualX + CELL / 2, visualY + CELL - 7, cell.label ?? '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            fontStyle: 'bold',
            color: '#2b7650',
            stroke: '#ffffff',
            strokeThickness: 3,
          })
          .setOrigin(0.5, 1)
          .setDepth(25);

        image.setName(`charging-${cell.label ?? `${cell.x}-${cell.y}`}`);
        this.chargingStations.set(`${cell.x},${cell.y}`, { image, label, highlight });
      }
    }
  }

  /**
   * Full-world dark overlay that dims the warehouse lighting when the power
   * grid is down.  Kept as a single Graphics object for efficiency — toggling
   * its alpha is far cheaper than mutating every tile sprite per frame.
   */
  private buildPowerOverlay() {
    this.powerOverlay = this.add.graphics().setDepth(40);
    this.powerOverlay.fillStyle(0x0a1115, 0);
    this.powerOverlay.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  /**
   * All shelf-grid clusters become purely decorative WarehouseBlock instances.
   * No inventory tracking — just static brown storage blocks for warehouse ambience.
   */
  private buildDecorativeBlocks() {
    for (const cluster of shelfClusters()) {
      const x = cluster.x * CELL + 4;
      const y = cluster.y * CELL + 5;
      const shelf = createWarehouseBlock(this, x, y, {
        width: cluster.w * CELL - 8,
        height: cluster.h * CELL - 8,
        depth: 20,
      });
      shelf.container.setDepth(18);
    }
  }

  /**
   * Builds 3 source racks (left wall, above each P station) and 3 destination
   * racks (right wall, above each D station). Each rack is exclusively owned by
   * one robot. Source racks start full; destination racks start empty.
   *
   * The racks are placed so they sit directly above the pickup/dropoff badges,
   * making it visually clear that the robot is loading from / delivering to its
   * own dedicated shelf.
   */
  private buildDedicatedRacks() {
    // Rack pixel dimensions after scaling to fit 2 grid-cols × 2 grid-rows
    const rackPixelW = 2 * CELL - 10; // ~190 px, fits within 2 columns
    // The aisle asset draws at BAY_W=80 per bay, so 2 bays = 160px native width.
    // We scale it up to fill rackPixelW.
    const scaleX = rackPixelW / (RACK_BAYS * 80);
    // Height: scale to fill RACK_H_CELLS rows
    const rackPixelH = RACK_H_CELLS * CELL - 10;
    // Aisle native RACK_H = 200px
    const scaleY = rackPixelH / 200;

    for (let i = 0; i < 3; i++) {
      const stationRow = STATION_ROWS[i];
      // Place rack so its bottom aligns with the top of the station row
      // → rack top at (stationRow - RACK_H_CELLS)
      const rackTopRow = stationRow - RACK_H_CELLS;
      const ry = rackTopRow * CELL + 5;

      const accentColor = ROBOT_ACCENT_COLORS[i];
      const accentHex = Phaser.Display.Color.IntegerToColor(accentColor).rgba;

      // ── Source rack — far left wall ─────────────────────────────────────────
      const srcX = SRC_RACK_COL * CELL + 5;
      const srcAisle = createAisle(this, srcX, ry, {
        bays: RACK_BAYS,
        showClearance: false,
        fillLevel: 1,
      });
      srcAisle.container.setScale(scaleX, scaleY).setDepth(20);

      // Coloured accent border — robot ownership at a glance
      const srcBorder = this.add.graphics().setDepth(22);
      srcBorder.lineStyle(3, accentColor, 0.8);
      srcBorder.strokeRoundedRect(srcX - 3, ry - 3, rackPixelW + 6, rackPixelH + 6, 6);

      // Ownership label sits above the rack
      this.add
        .text(srcX + rackPixelW / 2, ry - 18, `${ROBOT_LABELS[i]} SOURCE`, {
          fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold',
          color: accentHex, stroke: '#071617', strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(25);

      this.sourceRacks[i] = srcAisle;

      // ── Destination rack — far right wall ───────────────────────────────────
      const dstX = DST_RACK_COL * CELL + 5;
      const dstAisle = createAisle(this, dstX, ry, {
        bays: RACK_BAYS,
        showClearance: false,
        fillLevel: 0,
      });
      dstAisle.container.setScale(scaleX, scaleY).setDepth(20);

      const dstBorder = this.add.graphics().setDepth(22);
      dstBorder.lineStyle(3, accentColor, 0.8);
      dstBorder.strokeRoundedRect(dstX - 3, ry - 3, rackPixelW + 6, rackPixelH + 6, 6);

      this.add
        .text(dstX + rackPixelW / 2, ry - 18, `${ROBOT_LABELS[i]} DEST`, {
          fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold',
          color: accentHex, stroke: '#071617', strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(25);

      this.destRacks[i] = dstAisle;
    }
  }

  private renderFrame(frame: WarehouseFrame, animate: boolean) {
    this.renderPowerState(frame.powerOutage);
    this.renderStorageInventory(frame.stackBoxes, frame.robotCarrying);
    this.renderPaths(frame.robots);
    this.renderLinks(frame);
    this.renderObstacles(frame.blockedCells);

    const present = new Set(frame.robots.map((robot) => robot.id));
    for (const [id, visual] of this.robots) {
      if (!present.has(id)) {
        visual.controller.destroy();
        visual.state.destroy();
        visual.killedOverlay.destroy();
        this.robots.delete(id);
      }
    }
    for (const robot of frame.robots) this.renderRobot(robot, animate && frame.isPlaying);
  }

  /**
   * Robot i's tasksCompleted drains sourceRacks[i] and fills destRacks[i].
   * When a robot is actively carrying (on the dropoff leg), the source rack
   * immediately shows one fewer item — it shouldn't wait until delivery.
   * Completely independent between robots.
   */
  private renderStorageInventory(stackBoxes: number[], robotCarrying: boolean[]) {
    const changed =
      stackBoxes.some((count, i) => count !== this.lastStackBoxes[i]) ||
      robotCarrying.some((carrying, i) => carrying !== this.lastRobotCarrying[i]);
    if (!changed) return;
    this.lastStackBoxes = [...stackBoxes];
    this.lastRobotCarrying = [...robotCarrying];

    for (let i = 0; i < 3; i++) {
      const srcRack = this.sourceRacks[i];
      const dstRack = this.destRacks[i];
      if (!srcRack || !dstRack) continue;

      const initialBoxes = 2;
      const remaining = Math.max(0, Math.min(initialBoxes, stackBoxes[i] ?? 0));
      const carrying = robotCarrying[i] ?? false;
      const delivered = Math.max(0, Math.min(initialBoxes, initialBoxes - remaining));

      // Items currently in-transit (robot is carrying one right now)
      const inTransit = carrying && remaining > 0 ? 1 : 0;

      // Source inventory is persistent engine state, not robot ownership/progress.
      srcRack.setFillLevel(Math.max(0, remaining - inTransit) / initialBoxes);
      // Dest fills only on confirmed delivery
      dstRack.setFillLevel(delivered / initialBoxes);
    }
  }

  private renderRobot(robot: Robot, animate: boolean) {
    const target = cellCenter(robot.position);
    let visual = this.robots.get(robot.id);
    // In rescue mode the robot is heading to the death position — not carrying yet.
    const carrying = robot.task === 'dropoff' && !robot.rescueFromPosition;
    if (!visual) {
      const theme = ROBOT_THEMES[robot.stationIndex] || ROBOT_THEMES[0];
      const controller = createAMR(this, target.x - 46, target.y + 25, carrying, theme);
      controller.container.setScale(0.42).setDepth(55);
      const state = this.add.circle(target.x, target.y, 35).setStrokeStyle(3, 0xf2c14e, 0.75).setDepth(50);

      // ── Killed overlay: an X drawn with two diagonal lines + tinted fill ──
      const killedOverlay = this.add.graphics().setDepth(65);
      killedOverlay.setVisible(false);

      const label = this.add
        .text(target.x, target.y + 51, '', {
          fontFamily: 'Arial, sans-serif',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#e5f3ee',
          stroke: '#071617',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(60);
      visual = { controller, label, state, killedOverlay, lastPosition: robot.position, carrying };
      this.robots.set(robot.id, visual);
    }

    if (visual.carrying !== carrying) {
      visual.controller.setCarrying(carrying);
      visual.carrying = carrying;
    }

    const killed = robot.state === 'killed';
    const failed = robot.state === 'failed';
    const frozen = robot.state === 'frozen';
    const waiting = robot.state === 'waiting';

    const duration = animate ? 170 : 0;
    this.tweens.killTweensOf(visual.controller.container);
    this.tweens.killTweensOf(visual.state);
    this.tweens.killTweensOf(visual.label);
    this.tweens.killTweensOf(visual.killedOverlay);
    if (duration) {
      visual.controller.moveTo(target.x - 46, target.y + 25, duration);
      this.tweens.add({ targets: visual.state, x: target.x, y: target.y, duration, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: visual.label, x: target.x, y: target.y + 51, duration, ease: 'Sine.easeOut' });
    } else {
      visual.controller.container.setPosition(target.x - 46, target.y + 25);
      visual.state.setPosition(target.x, target.y);
      visual.label.setPosition(target.x, target.y + 51);
    }

    // ── State ring & body tint ─────────────────────────────────────────────
    const themeBody = ROBOT_THEMES[robot.stationIndex]?.body || MESH;
    if (killed || failed) {
      visual.state.setStrokeStyle(3, KILLED, 0.9);
      visual.state.setFillStyle(KILLED, 0.18);
    } else if (frozen) {
      visual.state.setStrokeStyle(3, CLOUD, 1);
      visual.state.setFillStyle(CLOUD, 0.2);
    } else {
      visual.state.setStrokeStyle(3, carrying ? 0xf28f3b : 0xf2c14e, waiting ? 0.45 : 0.75);
      visual.state.setFillStyle(themeBody, 0.04);
    }

    // ── Killed X overlay ──────────────────────────────────────────────────
    if (killed || failed) {
      visual.killedOverlay.setVisible(true);
      visual.killedOverlay.clear();
      const ox = target.x;
      const oy = target.y;
      const r = 20;
      // Dark tinted circle behind the X
      visual.killedOverlay.fillStyle(0x1a0505, 0.55);
      visual.killedOverlay.fillCircle(ox, oy, r + 4);
      // Bold X strokes
      visual.killedOverlay.lineStyle(5, KILLED, 1);
      visual.killedOverlay.lineBetween(ox - r, oy - r, ox + r, oy + r);
      visual.killedOverlay.lineBetween(ox + r, oy - r, ox - r, oy + r);
      // Thin highlight stroke
      visual.killedOverlay.lineStyle(1.5, 0xffaaaa, 0.6);
      visual.killedOverlay.lineBetween(ox - r, oy - r, ox + r, oy + r);
      visual.killedOverlay.lineBetween(ox + r, oy - r, ox - r, oy + r);
    } else {
      visual.killedOverlay.setVisible(false);
      visual.killedOverlay.clear();
    }

    // ── Label ─────────────────────────────────────────────────────────────
    if (killed) {
      visual.label.setText(`${robot.id}  DEAD`);
      visual.label.setColor('#ff6b6b');
    } else if (failed) {
      visual.label.setText(`${robot.id}  FAILED`);
      visual.label.setColor('#ff6b6b');
    } else if (robot.rescueFromPosition) {
      // Heading to collect stranded cargo from the death position
      visual.label.setText(`${robot.id}  RESCUE ▶ ${robot.coveringForRobotId ?? ''}`);
      visual.label.setColor('#f97316'); // orange — distinct from normal covering amber
    } else if (robot.coveringForRobotId) {
      visual.label.setText(`${robot.id}  ▶ ${robot.coveringForRobotId}`);
      visual.label.setColor('#f2c14e');
    } else {
      visual.label.setText(`${robot.id}  ${Math.round(robot.battery)}%${frozen ? '  DONE' : waiting ? '  HOLD' : ''}`);
      visual.label.setColor(frozen ? '#3d936c' : robot.battery < 25 ? '#b77d24' : '#34434b');
    }

    // Dim the robot body when killed
    visual.controller.container.setAlpha(killed ? 0.35 : 1);

    visual.lastPosition = robot.position;
  }

  private renderObstacles(blockedCells: Set<string>) {
    for (const [key, obstacle] of this.obstacles) {
      if (!blockedCells.has(key)) {
        obstacle.destroy();
        this.obstacles.delete(key);
      }

    }
    for (const key of blockedCells) {
      if (this.obstacles.has(key)) continue;
      const [x, y] = key.split(',').map(Number);
      const pos = cellCenter({ x, y });
      const obstacle = createObstacle(this, pos.x - 43, pos.y + 29, { width: 86, label: 'STOP' });
      obstacle.container.setScale(0.78).setDepth(48);
      this.obstacles.set(key, obstacle);
    }
   }

  /**
   * Dims warehouse lighting and disables the visual appearance of charging
   * stations C1/C2 when the power grid is down.  Uses a subtle ambient overlay
   * (not a jarring red screen) to keep the light-industrial aesthetic.
   */
  private renderPowerState(powerOutage: boolean) {
    if (powerOutage === this.lastPowerOutage) return;
    this.lastPowerOutage = powerOutage;

    this.powerOverlay.clear();
    this.powerOverlay.fillStyle(0x0a1115, powerOutage ? 0.22 : 0);
    this.powerOverlay.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    for (const { image, label, highlight } of this.chargingStations.values()) {
      const dimAlpha = powerOutage ? 0.3 : 1;
      image.setAlpha(dimAlpha);
      label.setAlpha(powerOutage ? 0.4 : 1);
      highlight.setAlpha(dimAlpha);
      if (powerOutage) {
        image.setTint(0x5a5a5a);
      } else {
        image.setTint(0x78b995);
      }
    }
  }

  private renderPaths(robots: Robot[]) {
    this.pathLayer.clear();
    for (const robot of robots) {
      if (robot.path.length === 0) continue;
      const pathColor = robot.state === 'goingToCharge' || robot.state === 'charging'
        ? 0x3e9b70
        : robot.battery < 25
          ? 0xc18a2e
          : robot.state === 'failed' || robot.state === 'killed'
            ? 0xd94f4f
            : 0x397fc1;
      this.pathLayer.lineStyle(3, pathColor, 0.72);
      let previous = cellCenter(robot.position);
      for (const waypoint of robot.path) {
        const next = cellCenter(waypoint);
        this.pathLayer.lineBetween(previous.x, previous.y, next.x, next.y);
        previous = next;
      }
    }
  }

  private renderLinks(frame: WarehouseFrame) {
    this.linkLayer.clear();
    if (this.side !== 'proposed') return;
    const byId = new Map(frame.robots.map((robot) => [robot.id, robot]));
    const pulse = 0.56 + (Math.sin(this.time.now / 210) + 1) * 0.16;
    for (const link of frame.links) {
      const from = byId.get(link.from);
      const to = byId.get(link.to);
      if (!from || !to) continue;
      const start = cellCenter(from.position);
      const end = cellCenter(to.position);
      const themeColor = ROBOT_THEMES[from.stationIndex]?.body || MESH;
      this.linkLayer.lineStyle(9, themeColor, 0.12 * pulse);
      this.linkLayer.lineBetween(start.x, start.y, end.x, end.y);
      this.linkLayer.lineStyle(2, themeColor, pulse);
      this.linkLayer.lineBetween(start.x, start.y, end.x, end.y);
    }
  }
}

function cellCenter(position: { x: number; y: number }) {
  return { x: position.x * CELL + CELL / 2, y: position.y * CELL + CELL / 2 };
}

function shelfClusters() {
  const visited = new Set<string>();
  const clusters: { x: number; y: number; w: number; h: number }[] = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      const key = `${x},${y}`;
      if (visited.has(key) || WAREHOUSE_GRID[y][x].type !== 'shelf') continue;
      const queue = [{ x, y }];
      const cells: { x: number; y: number }[] = [];
      visited.add(key);
      while (queue.length) {
        const current = queue.pop()!;
        cells.push(current);
        for (const next of [
          { x: current.x + 1, y: current.y }, { x: current.x - 1, y: current.y },
          { x: current.x, y: current.y + 1 }, { x: current.x, y: current.y - 1 },
        ]) {
          const nextKey = `${next.x},${next.y}`;
          if (visited.has(nextKey) || WAREHOUSE_GRID[next.y]?.[next.x]?.type !== 'shelf') continue;
          visited.add(nextKey);
          queue.push(next);
        }
      }
      const xs = cells.map((cell) => cell.x);
      const ys = cells.map((cell) => cell.y);
      clusters.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 });
    }
  }
  return clusters;
}
