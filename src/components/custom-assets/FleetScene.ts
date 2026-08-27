import Phaser from "phaser";
import { createAMR, type AMRController } from "./AMR";

export default class FleetScene extends Phaser.Scene {
  private amr!: AMRController;

  constructor() {
    super("FleetScene");
  }

  create() {
    /*
     * Background
     */

    this.cameras.main.setBackgroundColor("#a8cfc0");

    /*
     * Grid
     */

    const grid = this.add.graphics();

    grid.lineStyle(1, 0x7fae9e, 0.5);

    const width = this.scale.width;
    const height = this.scale.height;

    for (let x = 0; x < width; x += 50) {
      grid.lineBetween(x, 0, x, height);
    }

    for (let y = 0; y < height; y += 50) {
      grid.lineBetween(0, y, width, y);
    }

    /*
     * Create AMR
     *
     * true = carrying
     * false = empty
     */

    this.amr = createAMR(this, 350, 350, true);

    /*
     * Example movement
     */

    this.time.delayedCall(1500, () => {
      this.amr.moveTo(650, 350, 2000);
    });

    /*
     * Example:
     * drop the pallet after reaching destination
     */

    this.time.delayedCall(4000, () => {
      this.amr.setCarrying(false);
    });
  }
}
