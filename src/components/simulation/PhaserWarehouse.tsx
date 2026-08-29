import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createAMR, type AMRController } from '../custom-assets/AMR';
import { createAisle } from '../custom-assets/Aisle';
import { createObstacle } from '../custom-assets/Obstacle';
import { createWarehouseBlock } from '../custom-assets/WarehouseBlock';
import { useSimStore } from '../../store/useSimStore';
import { GRID_COLS, GRID_ROWS, WAREHOUSE_GRID } from '../../engine/warehouse';
import type { P2PLink, Robot } from '../../engine/types';

const CELL = 100;
const WORLD_WIDTH = GRID_COLS * CELL;
const WORLD_HEIGHT = GRID_ROWS * CELL;
const CLOUD = 0xf15b5b;
const MESH = 0x51d38d;

type Side = 'traditional' | 'proposed';

interface WarehouseFrame {
  robots: Robot[];
  blockedCells: Set<string>;
  links: P2PLink[];
  isPlaying: boolean;
  completedTasks: number;
  /** Per-robot tasks completed, indexed 0 = R1, 1 = R2, 2 = R3 */
  robotTaskCounts: number[];
  /**
   * Whether each robot (indexed 0 = R1, 1 = R2, 2 = R3) is currently
   * carrying stock (i.e. on the dropoff leg). Used to drain the source rack
   * immediately when the robot picks up, not just on delivery completion.
   */
  robotCarrying: boolean[];
}

interface RobotVisual {
  controller: AMRController;
  label: Phaser.GameObjects.Text;
  state: Phaser.GameObjects.Arc;
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
  const blockedCells = useSimStore((state) => state.blockedCells);
  const links = useSimStore((state) => state.proposed.p2pLinks);
  const isPlaying = useSimStore((state) => state.isPlaying);
  const completedTasks = useSimStore((state) => (side === 'traditional'
    ? state.traditional.metrics.totalTasksCompleted
    : state.proposed.metrics.totalTasksCompleted));

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;

    const scene = new WarehouseScene(side);
    sceneRef.current = scene;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#071617',
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
    // Derive per-robot task counts keyed by stationIndex (0/1/2)
    const robotTaskCounts = [0, 0, 0];
    const robotCarrying = [false, false, false];
    for (const robot of robots) {
      robotTaskCounts[robot.stationIndex] = robot.tasksCompleted;
      // A robot on the 'dropoff' leg is actively carrying stock — drain the
      // source rack immediately rather than waiting for delivery confirmation.
      robotCarrying[robot.stationIndex] = robot.task === 'dropoff';
    }

    sceneRef.current?.sync({
      robots,
      blockedCells,
      links: side === 'proposed' ? links : [],
      isPlaying,
      completedTasks,
      robotTaskCounts,
      robotCarrying,
    });
  }, [robots, blockedCells, links, isPlaying, completedTasks, side]);

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

  private frame: WarehouseFrame | null = null;
  private linkLayer!: Phaser.GameObjects.Graphics;
  private readonly side: Side;
  private lastRobotTaskCounts: number[] = [-1, -1, -1];
  private lastRobotCarrying: boolean[] = [false, false, false];

  constructor(side: Side) {
    super(`warehouse-${side}`);
    this.side = side;
  }

  create() {
    this.cameras.main.setBackgroundColor('#071617');
    this.buildFloor();
    this.buildDecorativeBlocks();
    this.buildDedicatedRacks();
    this.buildStations();          // stations drawn on top of racks
    this.linkLayer = this.add.graphics().setDepth(35);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.fitCamera();

    if (this.frame) this.renderFrame(this.frame, false);
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
    floor.fillStyle(0x102b2c, 1);
    floor.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    floor.lineStyle(1, 0x3e6965, 0.48);
    for (let x = 0; x <= WORLD_WIDTH; x += CELL) floor.lineBetween(x, 0, x, WORLD_HEIGHT);
    for (let y = 0; y <= WORLD_HEIGHT; y += CELL) floor.lineBetween(0, y, WORLD_WIDTH, y);

    floor.lineStyle(3, 0x5f8b81, 0.35);
    [250, 650, 1_050].forEach((y) => floor.lineBetween(0, y, WORLD_WIDTH, y));
    floor.lineStyle(2, 0xf2c14e, 0.28);
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
        const color = cell.type === 'pickup' ? 0xf2c14e : 0xf28f3b;
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
            fontFamily: 'monospace',
            fontSize: '20px',
            fontStyle: 'bold',
            color: '#0a1c1d',
          })
          .setOrigin(0.5)
          .setDepth(12);
      }
    }
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
    this.renderStorageInventory(frame.robotTaskCounts, frame.robotCarrying);
    this.renderLinks(frame);
    this.renderObstacles(frame.blockedCells);

    const present = new Set(frame.robots.map((robot) => robot.id));
    for (const [id, visual] of this.robots) {
      if (!present.has(id)) {
        visual.controller.destroy();
        visual.state.destroy();
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
  private renderStorageInventory(robotTaskCounts: number[], robotCarrying: boolean[]) {
    const changed =
      robotTaskCounts.some((count, i) => count !== this.lastRobotTaskCounts[i]) ||
      robotCarrying.some((carrying, i) => carrying !== this.lastRobotCarrying[i]);
    if (!changed) return;
    this.lastRobotTaskCounts = [...robotTaskCounts];
    this.lastRobotCarrying = [...robotCarrying];

    for (let i = 0; i < 3; i++) {
      const srcRack = this.sourceRacks[i];
      const dstRack = this.destRacks[i];
      if (!srcRack || !dstRack) continue;

      const tasks = robotTaskCounts[i] ?? 0;
      const carrying = robotCarrying[i] ?? false;
      const cap = srcRack.capacity;

      // Items confirmed delivered to dest rack
      const delivered = Math.min(tasks, cap);
      // Items currently in-transit (robot is carrying one right now)
      const inTransit = carrying && tasks + 1 <= cap ? 1 : 0;

      // Source = (total capacity) − (delivered) − (currently being carried)
      srcRack.setFillLevel((cap - delivered - inTransit) / cap);
      // Dest fills only on confirmed delivery
      dstRack.setFillLevel(delivered / cap);
    }
  }

  private renderRobot(robot: Robot, animate: boolean) {
    const target = cellCenter(robot.position);
    let visual = this.robots.get(robot.id);
    const carrying = robot.task === 'dropoff';
    if (!visual) {
      const theme = ROBOT_THEMES[robot.stationIndex] || ROBOT_THEMES[0];
      const controller = createAMR(this, target.x - 46, target.y + 25, carrying, theme);
      controller.container.setScale(0.42).setDepth(55);
      const state = this.add.circle(target.x, target.y, 35).setStrokeStyle(3, 0xf2c14e, 0.75).setDepth(50);
      const label = this.add
        .text(target.x, target.y + 51, '', {
          fontFamily: 'monospace',
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#e5f3ee',
          stroke: '#071617',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(60);
      visual = { controller, label, state, lastPosition: robot.position, carrying };
      this.robots.set(robot.id, visual);
    }

    if (visual.carrying !== carrying) {
      visual.controller.setCarrying(carrying);
      visual.carrying = carrying;
    }

    const duration = animate ? 170 : 0;
    this.tweens.killTweensOf(visual.controller.container);
    this.tweens.killTweensOf(visual.state);
    this.tweens.killTweensOf(visual.label);
    if (duration) {
      visual.controller.moveTo(target.x - 46, target.y + 25, duration);
      this.tweens.add({ targets: visual.state, x: target.x, y: target.y, duration, ease: 'Sine.easeOut' });
      this.tweens.add({ targets: visual.label, x: target.x, y: target.y + 51, duration, ease: 'Sine.easeOut' });
    } else {
      visual.controller.container.setPosition(target.x - 46, target.y + 25);
      visual.state.setPosition(target.x, target.y);
      visual.label.setPosition(target.x, target.y + 51);
    }

    const frozen = robot.state === 'frozen';
    const waiting = robot.state === 'waiting';
    const themeBody = ROBOT_THEMES[robot.stationIndex]?.body || MESH;
    visual.state.setStrokeStyle(3, frozen ? CLOUD : carrying ? 0xf28f3b : 0xf2c14e, frozen ? 1 : waiting ? 0.45 : 0.75);
    visual.state.setFillStyle(frozen ? CLOUD : themeBody, frozen ? 0.2 : 0.04);
    visual.label.setText(`${robot.id}  ${Math.round(robot.battery)}%${frozen ? '  LOST' : waiting ? '  HOLD' : ''}`);
    visual.label.setColor(frozen ? '#ffc2c2' : robot.battery < 25 ? '#f2c14e' : '#e5f3ee');
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
