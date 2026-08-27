import Phaser from "phaser";

export interface WarehouseBlockOptions {
    width?: number;
    height?: number;
    depth?: number;
}

export function createWarehouseBlock(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: WarehouseBlockOptions = {}
) {
    const {
        width = 150,
        height = 200,
        depth = 18
    } = options;

    const container = scene.add.container(x, y);

    const g = scene.add.graphics();

    /*
     * =========================================================
     * COLORS
     * =========================================================
     */

    const FRONT = 0x5a2b16;
    const SIDE = 0x421d10;
    const TOP = 0x71391e;

    const EDGE = 0x30150c;

    /*
     * =========================================================
     * SHADOW
     * =========================================================
     */

    g.fillStyle(0x000000, 0.15);

    g.fillRect(
        depth,
        height + 4,
        width,
        7
    );

    /*
     * =========================================================
     * FRONT FACE
     * =========================================================
     *
     * This is the main visible warehouse shelf/block.
     */

    g.fillStyle(FRONT, 1);

    g.fillRect(
        0,
        0,
        width,
        height
    );

    /*
     * =========================================================
     * RIGHT SIDE
     * =========================================================
     *
     * Gives the block a pseudo-3D depth.
     */

    g.fillStyle(SIDE, 1);

    g.beginPath();

    g.moveTo(width, 0);

    g.lineTo(
        width + depth,
        -depth
    );

    g.lineTo(
        width + depth,
        height - depth
    );

    g.lineTo(
        width,
        height
    );

    g.closePath();

    g.fillPath();

    /*
     * =========================================================
     * TOP
     * =========================================================
     */

    g.fillStyle(TOP, 1);

    g.beginPath();

    g.moveTo(0, 0);

    g.lineTo(
        depth,
        -depth
    );

    g.lineTo(
        width + depth,
        -depth
    );

    g.lineTo(
        width,
        0
    );

    g.closePath();

    g.fillPath();

    /*
     * =========================================================
     * OUTER EDGE
     * =========================================================
     */

    g.lineStyle(
        2,
        EDGE,
        1
    );

    g.strokeRect(
        0,
        0,
        width,
        height
    );

    /*
     * =========================================================
     * SHELF LINES
     * =========================================================
     *
     * These make the block look more like warehouse shelving
     * instead of a single brown wall.
     */

    g.lineStyle(
        2,
        EDGE,
        0.8
    );

    const shelfCount = Math.max(
        2,
        Math.floor(height / 45)
    );

    for (let i = 1; i < shelfCount; i++) {

        const shelfY =
            (height / shelfCount) * i;

        g.lineBetween(
            0,
            shelfY,
            width,
            shelfY
        );
    }

    /*
     * =========================================================
     * VERTICAL SUPPORTS
     * =========================================================
     */

    g.lineStyle(
        2,
        EDGE,
        0.75
    );

    const supportCount =
        Math.max(2, Math.floor(width / 55));

    for (let i = 1; i < supportCount; i++) {

        const supportX =
            (width / supportCount) * i;

        g.lineBetween(
            supportX,
            0,
            supportX,
            height
        );
    }

    container.add(g);

    return {
        container,

        setPosition(newX: number, newY: number) {
            container.setPosition(newX, newY);
        },

        destroy() {
            container.destroy(true);
        }
    };
}