import Phaser from "phaser";

export interface ObstacleOptions {
    /**
     * Pixel width of the blocked zone.
     * Should be at least 180 px to fully block an AMR path.
     * Default: 200
     */
    width?: number;

    /**
     * Label text shown on the hazard sign.
     * Default: "BLOCKED"
     */
    label?: string;
}

/**
 * A ground-level dynamic obstacle — a pair of traffic barriers
 * connected by hazard tape, with a flashing warning light on top.
 *
 * Calibrated to the AMR footprint (≈ 180 × 105 px):
 *   - Barrier width: 200 px by default  → wider than AMR body
 *   - Barrier height: 80 px             → clearly blocks sensor line of sight
 *   - Hazard zone on floor: 55 px deep  → matches Aisle clearance zone style
 *
 * Origin (0, 0) is the top-left of the floor hazard zone.
 *
 * getBounds() returns the full blocked rectangle for AABB collision checks.
 */
export function createObstacle(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: ObstacleOptions = {}
) {
    const {
        width = 200,
        label = "BLOCKED"
    } = options;

    // ---- core dimensions -----------------------------------------------

    /** Height of each barrier post */
    const POST_H = 80;
    /** Width of each barrier post */
    const POST_W = 30;
    /** Depth slant for pseudo-3D */
    const DEPTH = 14;
    /** Thickness of the top cap on each post */
    const CAP_H = 10;
    /** Height of the hazard floor zone */
    const FLOOR_H = 50;
    /** Horizontal tape sag in the middle */
    const TAPE_SAG = 14;

    // ---- colors --------------------------------------------------------
    const ORANGE       = 0xe8642a;
    const ORANGE_DARK  = 0xb84a18;
    const ORANGE_TOP   = 0xf5834a;
    const WHITE_STRIPE = 0xf0eeea;
    const GREY_BASE    = 0x606060;
    const GREY_DARK    = 0x3a3a3a;
    const YELLOW       = 0xffd166;
    const BLACK_TAPE   = 0x1a1a1a;
    const LIGHT_ON     = 0xfff176;   // warning beacon colour (on)
    const SHADOW_COL   = 0x000000;

    // ---- container -----------------------------------------------------
    const container = scene.add.container(x, y);
    const g = scene.add.graphics();

    // ====================================================================
    // FLOOR HAZARD ZONE
    // Yellow/black diagonal-striped ground marking
    // ====================================================================

    // Base fill
    g.fillStyle(YELLOW, 0.22);
    g.fillRect(0, 0, width, FLOOR_H);

    // Diagonal hazard stripes
    g.lineStyle(4, BLACK_TAPE, 0.45);
    const SGAP = 20;

    for (let sx = -FLOOR_H; sx < width + FLOOR_H; sx += SGAP) {
        g.lineBetween(sx, 0, sx + FLOOR_H, FLOOR_H);
    }

    // Border
    g.lineStyle(2, YELLOW, 0.7);
    g.strokeRect(0, 0, width, FLOOR_H);

    // ====================================================================
    // LEFT BARRIER POST
    // ====================================================================

    drawPost(0);

    // ====================================================================
    // RIGHT BARRIER POST
    // ====================================================================

    drawPost(width - POST_W);

    // ====================================================================
    // CAUTION TAPE
    // Three parallel runs of tape between the two posts, with gentle sag
    // ====================================================================

    const tapeRuns = [
        { yPct: 0.25, col: YELLOW,     alpha: 0.95 },
        { yPct: 0.52, col: BLACK_TAPE, alpha: 0.85 },
        { yPct: 0.78, col: YELLOW,     alpha: 0.95 }
    ];

    const tapeX0 = POST_W;
    const tapeX1 = width - POST_W;
    const tapeMidX = (tapeX0 + tapeX1) / 2;

    for (const run of tapeRuns) {

        const tapeY = -POST_H * run.yPct;
        const midY  = tapeY + TAPE_SAG;

        g.lineStyle(5, run.col, run.alpha);

        g.beginPath();
        g.moveTo(tapeX0, tapeY);
        // Quadratic bezier via a control point at the sag centre
        // Phaser doesn't have native bezier on Graphics so we approximate
        // with short line segments
        const SEGS = 18;

        for (let i = 1; i <= SEGS; i++) {
            const t  = i / SEGS;
            const mt = 1 - t;
            const bx = mt * mt * tapeX0 + 2 * mt * t * tapeMidX + t * t * tapeX1;
            const by = mt * mt * tapeY  + 2 * mt * t * midY      + t * t * tapeY;
            g.lineTo(bx, by);
        }

        g.strokePath();

        // Black edge outline for contrast
        g.lineStyle(1, 0x000000, 0.3);
        g.beginPath();
        g.moveTo(tapeX0, tapeY);

        for (let i = 1; i <= SEGS; i++) {
            const t  = i / SEGS;
            const mt = 1 - t;
            const bx = mt * mt * tapeX0 + 2 * mt * t * tapeMidX + t * t * tapeX1;
            const by = mt * mt * tapeY  + 2 * mt * t * midY      + t * t * tapeY;
            g.lineTo(bx, by);
        }

        g.strokePath();
    }

    // ====================================================================
    // WARNING BEACON (flashing light on left post cap)
    // ====================================================================

    const beaconX = POST_W / 2;
    const beaconY = -POST_H - CAP_H - 14;

    // Beacon housing
    g.fillStyle(0x222222, 1);
    g.fillCircle(beaconX, beaconY, 11);

    // Inner glow
    g.fillStyle(LIGHT_ON, 1);
    g.fillCircle(beaconX, beaconY, 7);

    // Highlight
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(beaconX - 2, beaconY - 2, 3);

    // ====================================================================
    // HAZARD SIGN — centred between posts, mid-height
    // ====================================================================

    const signW = Math.min(width * 0.36, 80);
    const signH = 28;
    const signX = width / 2 - signW / 2;
    const signY = -POST_H * 0.55 - signH / 2;

    // Sign background
    g.fillStyle(0xffd166, 1);
    g.fillRoundedRect(signX, signY, signW, signH, 4);

    // Sign border
    g.lineStyle(2, 0x1a1a1a, 1);
    g.strokeRoundedRect(signX, signY, signW, signH, 4);

    // Sign text
    const signText = scene.add.text(
        width / 2,
        signY + signH / 2,
        label,
        {
            fontFamily: "monospace",
            fontSize: "10px",
            fontStyle: "bold",
            color: "#1a1a1a",
            align: "center"
        }
    );

    signText.setOrigin(0.5, 0.5);
    container.add(signText);

    // ====================================================================
    // SHADOW under whole unit
    // ====================================================================

    g.fillStyle(SHADOW_COL, 0.12);
    g.fillEllipse(width / 2, FLOOR_H + 5, width * 0.9, 14);

    // ====================================================================
    // FINISH — add graphics first so text renders on top
    // ====================================================================

    container.addAt(g, 0);

    // ====================================================================
    // BEACON TWEEN — pulses the glow
    // ====================================================================

    scene.tweens.add({
        targets: signText,
        alpha: 0.4,
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
    });

    // ====================================================================
    // HELPER: draw a single barrier post at postX
    // ====================================================================

    function drawPost(postX: number) {

        // Post shadow
        g.fillStyle(SHADOW_COL, 0.15);
        g.fillRect(
            postX + DEPTH,
            -POST_H + DEPTH,
            POST_W,
            POST_H + 2
        );

        // Base plate (rubber foot)
        g.fillStyle(GREY_DARK, 1);
        g.fillRoundedRect(postX - 5, -8, POST_W + 10, 10, 3);

        // Base plate 3D top
        g.fillStyle(GREY_BASE, 1);
        g.beginPath();
        g.moveTo(postX - 5, -8);
        g.lineTo(postX - 5 + DEPTH / 2, -8 - DEPTH / 2);
        g.lineTo(postX + POST_W + 5 + DEPTH / 2, -8 - DEPTH / 2);
        g.lineTo(postX + POST_W + 5, -8);
        g.closePath();
        g.fillPath();

        // Main post body — alternating orange & white stripes
        const STRIPE_COUNT = 4;
        const stripeH = POST_H / STRIPE_COUNT;

        for (let s = 0; s < STRIPE_COUNT; s++) {
            const sy  = -POST_H + s * stripeH;
            const col = s % 2 === 0 ? ORANGE : WHITE_STRIPE;
            g.fillStyle(col, 1);
            g.fillRect(postX, sy, POST_W, stripeH);
        }

        // Post right-side face (depth illusion)
        for (let s = 0; s < STRIPE_COUNT; s++) {
            const sy   = -POST_H + s * stripeH;
            const col  = s % 2 === 0 ? ORANGE_DARK : 0xd8d6d2;
            g.fillStyle(col, 1);
            g.beginPath();
            g.moveTo(postX + POST_W, sy);
            g.lineTo(postX + POST_W + DEPTH, sy - DEPTH);
            g.lineTo(postX + POST_W + DEPTH, sy - DEPTH + stripeH);
            g.lineTo(postX + POST_W, sy + stripeH);
            g.closePath();
            g.fillPath();
        }

        // Cap top face
        g.fillStyle(ORANGE_TOP, 1);
        g.beginPath();
        g.moveTo(postX, -POST_H);
        g.lineTo(postX + DEPTH, -POST_H - DEPTH);
        g.lineTo(postX + POST_W + DEPTH, -POST_H - DEPTH);
        g.lineTo(postX + POST_W, -POST_H);
        g.closePath();
        g.fillPath();

        // Cap rim
        g.fillStyle(ORANGE_DARK, 1);
        g.fillRect(postX, -POST_H - CAP_H, POST_W, CAP_H);

        // Highlight stripe on post
        g.fillStyle(0xffffff, 0.12);
        g.fillRect(postX + 4, -POST_H, 5, POST_H);

        // Post outline
        g.lineStyle(1, 0x1a1a1a, 0.5);
        g.strokeRect(postX, -POST_H, POST_W, POST_H);
    }

    // ====================================================================
    // PUBLIC API
    // ====================================================================

    return {
        container,

        /**
         * Full blocked rectangle in world space (for AABB collision).
         * Includes the floor hazard zone depth.
         */
        getBounds(): Phaser.Geom.Rectangle {
            return new Phaser.Geom.Rectangle(
                container.x,
                container.y - POST_H - CAP_H - 14,   // top of beacon
                width + DEPTH,
                POST_H + CAP_H + 14 + FLOOR_H        // beacon → floor zone bottom
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
