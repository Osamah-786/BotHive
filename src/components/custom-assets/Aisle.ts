import Phaser from "phaser";

export interface AisleOptions {
    /**
     * Number of rack bays side by side along the aisle length.
     * Each bay is ~80px wide to match warehouse-shelf proportions.
     * Default: 4
     */
    bays?: number;

    /**
     * Whether to show a clearance zone on the floor in front
     * of the aisle (the no-drive stripe the AMR must respect).
     * Default: true
     */
    showClearance?: boolean;

    /**
     * How full the rack is, from 0 (empty) to 1 (all pallet locations full).
     * This is intentionally visual-only: the simulation engine remains the
     * source of truth for task and route state.
     * Default: 1
     */
    fillLevel?: number;
}

/**
 * An aisle-facing rack row — a long horizontal obstacle the AMR
 * cannot drive through.
 *
 * Dimensions are calibrated to the AMR footprint:
 *   AMR body  ≈ 165 × 105 px
 *   Aisle rack depth ≈ 60 px (deeper than the AMR is long)
 *   Aisle rack height ≈ 200 px (taller than AMR cab at ~175 px)
 *   Bay width ≈ 80 px each → 4 bays = 320 px total (≈ 2× AMR width)
 *
 * Origin (0, 0) is the top-left corner of the front face.
 */
export function createAisle(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: AisleOptions = {}
) {
    const {
        bays = 4,
        showClearance = true,
        fillLevel: initialFillLevel = 1
    } = options;

    // ---- core dimensions -----------------------------------------------

    /** Width of a single rack bay (≈ half the AMR width) */
    const BAY_W = 80;

    /** Total rack width across all bays */
    const RACK_W = BAY_W * bays;

    /** Rack face height — taller than the AMR cab (~175 px) */
    const RACK_H = 200;

    /** Isometric depth slant (matches WarehouseBlock style) */
    const DEPTH = 24;

    /** Shelf levels inside each bay */
    const SHELF_LEVELS = 3;

    /** Every bay/level pair represents one visible pallet location. */
    const CAPACITY = bays * SHELF_LEVELS;

    /** Clearance stripe height in front of the rack */
    const CLEARANCE_H = 55;

    // ---- colors --------------------------------------------------------

    const FRONT      = 0xeadfd3;
    const SIDE       = 0xc6b8aa;
    const TOP_COL    = 0xf6eee7;
    const EDGE       = 0x9f8e7d;
    const UPRIGHT    = 0xb7a494;
    const SHELF_COL  = 0xd5c7b9;
    const CLEAR_COL  = 0xe4b866;

    // ---- container -----------------------------------------------------

    const container = scene.add.container(x, y);
    const g = scene.add.graphics();
    const inventory = scene.add.graphics();
    let fillLevel = Phaser.Math.Clamp(initialFillLevel, 0, 1);

    // ====================================================================
    // FLOOR CLEARANCE ZONE
    // Drawn first so it sits behind everything.
    // ====================================================================

    if (showClearance) {

        // Yellow safety stripe on the floor in front of the rack
        g.fillStyle(CLEAR_COL, 0.28);
        g.fillRect(
            0,
            RACK_H + 4,
            RACK_W,
            CLEARANCE_H
        );

        // Diagonal hazard lines
        g.lineStyle(3, CLEAR_COL, 0.55);

        const STRIPE_GAP = 22;

        for (
            let sx = -CLEARANCE_H;
            sx < RACK_W + CLEARANCE_H;
            sx += STRIPE_GAP
        ) {
            g.lineBetween(
                sx,
                RACK_H + 4,
                sx + CLEARANCE_H,
                RACK_H + 4 + CLEARANCE_H
            );
        }

        // Clearance border
        g.lineStyle(2, CLEAR_COL, 0.7);
        g.strokeRect(
            0,
            RACK_H + 4,
            RACK_W,
            CLEARANCE_H
        );

        // Label
        const label = scene.add.text(
            RACK_W / 2,
            RACK_H + 4 + CLEARANCE_H / 2,
            "NO ENTRY",
            {
                fontFamily: "monospace",
                fontSize: "10px",
                color: "#a8752a",
                align: "center"
            }
        );

        label.setOrigin(0.5, 0.5);
        label.setAlpha(0.8);
        container.add(label);
    }

    // ====================================================================
    // RACK SHADOW
    // ====================================================================

    g.fillStyle(0x000000, 0.18);
    g.fillRect(
        DEPTH,
        RACK_H + 2,
        RACK_W,
        9
    );

    // ====================================================================
    // FRONT FACE — main rack panel
    // ====================================================================

    g.fillStyle(FRONT, 1);
    g.fillRect(0, 0, RACK_W, RACK_H);

    // ====================================================================
    // RIGHT SIDE — isometric depth panel (matches WarehouseBlock)
    // ====================================================================

    g.fillStyle(SIDE, 1);

    g.beginPath();
    g.moveTo(RACK_W, 0);
    g.lineTo(RACK_W + DEPTH, -DEPTH);
    g.lineTo(RACK_W + DEPTH, RACK_H - DEPTH);
    g.lineTo(RACK_W, RACK_H);
    g.closePath();
    g.fillPath();

    // ====================================================================
    // TOP — isometric top panel
    // ====================================================================

    g.fillStyle(TOP_COL, 1);

    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(DEPTH, -DEPTH);
    g.lineTo(RACK_W + DEPTH, -DEPTH);
    g.lineTo(RACK_W, 0);
    g.closePath();
    g.fillPath();

    // ====================================================================
    // VERTICAL UPRIGHTS — one between every bay
    // ====================================================================

    const UPRIGHT_W = 8;

    for (let b = 0; b <= bays; b++) {

        const ux = b * BAY_W;

        // Front face upright
        g.fillStyle(UPRIGHT, 1);
        g.fillRect(ux - UPRIGHT_W / 2, 0, UPRIGHT_W, RACK_H);

        // Top-face upright slant
        if (b < bays) {
            g.fillStyle(UPRIGHT, 0.6);
            g.beginPath();
            g.moveTo(ux - UPRIGHT_W / 2, 0);
            g.lineTo(ux - UPRIGHT_W / 2 + DEPTH, -DEPTH);
            g.lineTo(ux + UPRIGHT_W / 2 + DEPTH, -DEPTH);
            g.lineTo(ux + UPRIGHT_W / 2, 0);
            g.closePath();
            g.fillPath();
        }
    }

    // ====================================================================
    // HORIZONTAL SHELF BOARDS
    // ====================================================================

    const SHELF_THICK = 6;

    for (let s = 0; s <= SHELF_LEVELS; s++) {

        const sy = (RACK_H / SHELF_LEVELS) * s;

        // Shelf board front face
        g.fillStyle(SHELF_COL, 1);
        g.fillRect(0, sy - SHELF_THICK / 2, RACK_W, SHELF_THICK);

        // Shelf board top edge (isometric)
        if (s === 0) {
            continue; // top already drawn as TOP panel
        }

        g.fillStyle(0x5a5a7f, 0.7);
        g.fillRect(0, sy - SHELF_THICK / 2, RACK_W, 2);
    }

    // ====================================================================
    // OUTER EDGE
    // ====================================================================

    g.lineStyle(2, EDGE, 1);
    g.strokeRect(0, 0, RACK_W, RACK_H);

    // ====================================================================
    // RACK ITEMS — drawn separately so live simulation state can refill
    // or empty a physical rack without recreating its chassis.
    // ====================================================================

    const BOX_COLORS = [0xc98b45, 0x4a7fc1, 0x9b4a4a, 0x4a9b5c];

    function renderInventory(level: number) {
        inventory.clear();
        const itemCount = Math.round(Phaser.Math.Clamp(level, 0, 1) * CAPACITY);
        let drawn = 0;

        // Fill from the lower shelves upward: incoming stock settles on the
        // floor level first, and outbound racks visibly empty from the top.
        for (let s = SHELF_LEVELS - 1; s >= 0; s--) {
            for (let b = 0; b < bays; b++) {
                if (drawn >= itemCount) return;
                drawn++;

                const shelfY = (RACK_H / SHELF_LEVELS) * s;
                const nextShelfY = (RACK_H / SHELF_LEVELS) * (s + 1);
                const boxH = (nextShelfY - shelfY) * 0.55;
                const boxW = BAY_W * 0.52;
                const bx = b * BAY_W + (BAY_W - boxW) / 2;
                const by = nextShelfY - SHELF_THICK / 2 - boxH;
                const col = BOX_COLORS[(b + s) % BOX_COLORS.length];
                const topH = 8;

                inventory.fillStyle(col, 0.9);
                inventory.fillRect(bx, by, boxW, boxH);

                inventory.fillStyle(Phaser.Display.Color.ValueToColor(col).brighten(20).color, 0.9);
                inventory.beginPath();
                inventory.moveTo(bx, by);
                inventory.lineTo(bx + topH, by - topH);
                inventory.lineTo(bx + boxW + topH, by - topH);
                inventory.lineTo(bx + boxW, by);
                inventory.closePath();
                inventory.fillPath();

                inventory.fillStyle(Phaser.Display.Color.ValueToColor(col).darken(25).color, 0.9);
                inventory.beginPath();
                inventory.moveTo(bx + boxW, by);
                inventory.lineTo(bx + boxW + topH, by - topH);
                inventory.lineTo(bx + boxW + topH, by - topH + boxH);
                inventory.lineTo(bx + boxW, by + boxH);
                inventory.closePath();
                inventory.fillPath();
            }
        }
    }

    renderInventory(fillLevel);

    // ====================================================================
    // FINISH
    // ====================================================================

    container.add(g);
    container.moveTo(g, 0); // keep graphics behind text label
    container.add(inventory);

    return {
        container,

        /** Number of pallet locations represented by this rack. */
        capacity: CAPACITY,

        /** Redraw only the pallet positions; the rack structure stays intact. */
        setFillLevel(value: number) {
            fillLevel = Phaser.Math.Clamp(value, 0, 1);
            renderInventory(fillLevel);
        },

        getFillLevel() {
            return fillLevel;
        },

        /**
         * Returns the axis-aligned bounding box (in world space)
         * for simple collision checks.
         *
         * The obstacle zone includes the clearance stripe.
         */
        getBounds(): Phaser.Geom.Rectangle {
            const extra = showClearance ? CLEARANCE_H : 0;

            return new Phaser.Geom.Rectangle(
                container.x,
                container.y - DEPTH,
                RACK_W + DEPTH,
                RACK_H + extra + DEPTH
            );
        },

        setPosition(newX: number, newY: number) {
            container.setPosition(newX, newY);
        },

        destroy() {
            container.destroy(true);
        }
    };
}
