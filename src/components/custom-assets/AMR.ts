import Phaser from "phaser";

export interface AMRController {
    container: Phaser.GameObjects.Container;

    setCarrying(value: boolean): void;
    isCarrying(): boolean;

    moveTo(
        x: number,
        y: number,
        duration?: number
    ): void;

    destroy(): void;
}

export interface AMRTheme {
    body: number;
    dark: number;
    light: number;
}

export function createAMR(
    scene: Phaser.Scene,
    x: number,
    y: number,
    initialCarrying = false,
    theme?: AMRTheme
): AMRController {

    const container = scene.add.container(x, y);

    let carrying = initialCarrying;
    let pallet: Phaser.GameObjects.Container | null = null;

    /*
     * =========================================================
     * COLORS
     * =========================================================
     */

    const BODY = theme ? theme.body : 0x55b94d;
    const BODY_DARK = theme ? theme.dark : 0x318b38;
    const BODY_LIGHT = theme ? theme.light : 0x7ed66e;

    const BLACK = 0x202020;
    const DARK = 0x111111;
    const METAL = 0x555555;

    /*
     * =========================================================
     * MACHINE GRAPHICS
     * =========================================================
     */

    const graphics = scene.add.graphics();

    // Shadow
    graphics.fillStyle(0x000000, 0.18);
    graphics.fillEllipse(40, 38, 220, 42);

    // Main body
    graphics.fillStyle(BODY, 1);
    graphics.fillRoundedRect(
        40,
        -80,
        130,
        105,
        18
    );

    // Lower chassis
    graphics.fillStyle(BODY_DARK, 1);
    graphics.fillRoundedRect(
        35,
        -10,
        145,
        30,
        12
    );

    // Front body
    graphics.fillStyle(BODY_LIGHT, 1);

    graphics.beginPath();

    graphics.moveTo(55, -70);
    graphics.lineTo(105, -90);
    graphics.lineTo(155, -65);
    graphics.lineTo(155, 5);
    graphics.lineTo(55, 5);

    graphics.closePath();
    graphics.fillPath();

    /*
     * =========================================================
     * CAB
     * =========================================================
     */

    // Rear vertical support
    graphics.fillStyle(DARK, 1);

    graphics.fillRoundedRect(
        75,
        -145,
        17,
        70,
        5
    );

    // // Roof
    // graphics.fillStyle(BLACK, 1);

    // graphics.fillRoundedRect(
    //     110,
    //     -150,
    //     90,
    //     15,
    //     7
    // );

    // // Front support
    // graphics.fillStyle(DARK, 1);

    // graphics.fillRoundedRect(
    //     188,
    //     -145,
    //     13,
    //     75,
    //     5
    // );

    /*
     * =========================================================
     * WINDOWS
     * =========================================================
     */

    // graphics.fillStyle(0x101010, 1);

    // graphics.fillRoundedRect(
    //     120,
    //     -137,
    //     65,
    //     62,
    //     5
    // );

    // // Upper window
    // graphics.fillStyle(0x8fd8b4, 1);

    // graphics.fillRoundedRect(
    //     126,
    //     -131,
    //     53,
    //     25,
    //     3
    // );

    // // Lower window
    // graphics.fillStyle(0x5c967a, 1);

    // graphics.beginPath();

    // graphics.moveTo(126, -98);
    // graphics.lineTo(153, -115);
    // graphics.lineTo(179, -101);
    // graphics.lineTo(165, -78);
    // graphics.lineTo(126, -78);

    // graphics.closePath();
    // graphics.fillPath();

    /*
     * =========================================================
     * FORKLIFT MAST
     * =========================================================
     */

    // Main mast
    graphics.fillStyle(BLACK, 1);

    graphics.fillRoundedRect(
        15,
        -175,
        19,
        170,
        5
    );

    // Mast highlight
    graphics.fillStyle(METAL, 1);

    graphics.fillRect(
        20,
        -165,
        5,
        150
    );

    // Inner mast
    graphics.fillStyle(DARK, 1);

    graphics.fillRect(
        34,
        -150,
        7,
        135
    );

    /*
     * =========================================================
     * FORKS
     * =========================================================
     */

    graphics.fillStyle(METAL, 1);

    // Top fork
    graphics.beginPath();

    graphics.moveTo(25, -15);
    graphics.lineTo(-55, -15);
    graphics.lineTo(-60, -8);
    graphics.lineTo(25, -8);

    graphics.closePath();
    graphics.fillPath();

    // Bottom fork
    graphics.beginPath();

    graphics.moveTo(25, 0);
    graphics.lineTo(-55, 0);
    graphics.lineTo(-60, 7);
    graphics.lineTo(25, 7);

    graphics.closePath();
    graphics.fillPath();

    /*
     * =========================================================
     * WHEELS
     * =========================================================
     */

    function drawWheel(
        wheelX: number,
        wheelY: number,
        radius: number
    ) {
        // Tire
        graphics.fillStyle(DARK, 1);

        graphics.fillCircle(
            wheelX,
            wheelY,
            radius
        );

        // Inner tire
        graphics.fillStyle(0x292929, 1);

        graphics.fillCircle(
            wheelX - 2,
            wheelY - 2,
            radius - 3
        );

        // Hub
        graphics.fillStyle(0x555555, 1);

        graphics.fillCircle(
            wheelX,
            wheelY,
            radius * 0.35
        );

        // Hub highlight
        graphics.fillStyle(0x777777, 1);

        graphics.fillCircle(
            wheelX - 2,
            wheelY - 2,
            radius * 0.15
        );
    }

    drawWheel(75, 15, 21);
    drawWheel(170, 15, 18);

    /*
     * =========================================================
     * LOAD / PALLET
     * =========================================================
     */

    function createLoad() {

        if (!carrying) {
            return;
        }

        pallet = scene.add.container(-70, -5);

        const box = scene.add.graphics();

        // Front of box
        box.fillStyle(0xc98b45, 1);

        box.fillRect(
            0,
            -65,
            82,
            58
        );

        // Top
        box.fillStyle(0xf2c36d, 1);

        box.beginPath();

        box.moveTo(0, -65);
        box.lineTo(18, -78);
        box.lineTo(100, -78);
        box.lineTo(82, -65);

        box.closePath();
        box.fillPath();

        // Right side
        box.fillStyle(0xa96b35, 1);

        box.beginPath();

        box.moveTo(82, -65);
        box.lineTo(100, -78);
        box.lineTo(100, -20);
        box.lineTo(82, -7);

        box.closePath();
        box.fillPath();

        // Tape
        box.fillStyle(0xdba65b, 1);

        box.fillRect(
            38,
            -65,
            9,
            58
        );

        // Horizontal seam
        box.lineStyle(
            2,
            0x8e5a2e,
            1
        );

        box.lineBetween(
            0,
            -35,
            82,
            -35
        );

        // Pallet
        box.fillStyle(0x75451f, 1);

        box.fillRect(
            -3,
            -7,
            90,
            8
        );

        box.fillStyle(0x4f2e19, 1);

        box.fillRect(
            5,
            1,
            10,
            9
        );

        box.fillRect(
            70,
            1,
            10,
            9
        );

        pallet.add(box);

        // Put pallet behind machine
        container.addAt(
            pallet,
            0
        );
    }

    /*
     * =========================================================
     * ADD MACHINE
     * =========================================================
     */

    container.add(graphics);

    createLoad();

    /*
     * =========================================================
     * PUBLIC CONTROLLER
     * =========================================================
     */

    return {

        container,

        setCarrying(value: boolean) {

            carrying = value;

            // Remove existing pallet
            if (pallet) {

                pallet.destroy();

                pallet = null;
            }

            // Create new pallet if required
            if (carrying) {
                createLoad();
            }
        },

        isCarrying() {
            return carrying;
        },

        moveTo(
            newX: number,
            newY: number,
            duration = 500
        ) {

            scene.tweens.add({

                targets: container,

                x: newX,
                y: newY,

                duration,

                ease: "Power2"
            });
        },

        destroy() {
            container.destroy(true);
        }
    };
}