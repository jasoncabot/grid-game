import WebFontFile from "../WebFontFile";

import { GameObjects, Scene } from "phaser";

const rows = 16;
const columns = 16;
const itemWidth = 64;
const itemHeight = 64;

const up = (i: number) => {
  return i < columns ? -1 : i - columns;
};
const down = (i: number) => {
  return i > columns * rows - 1 - columns ? -1 : i + columns;
};
const left = (i: number) => {
  return i % rows === 0 ? -1 : i - 1;
};
const right = (i: number) => {
  return i % rows === rows - 1 ? -1 : i + 1;
};
const findTouchingByOrientation = [
  // 0 = ┘
  [
    { fn: left, o: [1, 2] },
    { fn: up, o: [2, 3] },
  ],
  // 1 = └
  [
    { fn: up, o: [2, 3] },
    { fn: right, o: [0, 3] },
  ],
  // 2 = ┌
  [
    { fn: right, o: [0, 3] },
    { fn: down, o: [0, 1] },
  ],
  // 3 = ┐
  [
    { fn: down, o: [0, 1] },
    { fn: left, o: [1, 2] },
  ],
];

const findNextRotationIndexes = (
  previouslyRotated: Set<number>,
  data: { orientation: number }[]
) => {
  let next: Set<number> = new Set();
  for (const index of previouslyRotated) {
    const selectedOrientation = data[index].orientation;
    for (const { fn, o } of findTouchingByOrientation[selectedOrientation]) {
      const nextIndex = fn(index);
      if (nextIndex > -1) {
        const touchingOrientation = data[nextIndex].orientation;
        if (o.includes(touchingOrientation)) {
          next.add(nextIndex);
        }
      }
    }
  }

  return next;
};

export class Game extends Scene {
  constructor() {
    super("Game");
  }

  preload() {
    this.load.setPath("assets");
    this.load.addFile(new WebFontFile(this.load, "IBM Plex Mono"));

    this.load.image("item", "item.png");

    this.load.audio("click", ["click.mp3"]);
  }

  create() {
    // create a backing data array of 256 elements, where each has an orientation property
    const data = new Array(columns * rows)
      .fill(0)
      .map((_) => ({ orientation: Math.floor(Math.random() * 4) }));

    let hasTriggered = false;

    const gfx: Phaser.GameObjects.Sprite[] = new Array(columns * rows).fill(
      null
    );
    const rotations = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

    const tick = 350;
    let score = 0;
    let bestScore = parseInt(localStorage.getItem("bestScore") || "0");

    // add a score element at the bottom left of the grid
    const scoreboard = this.add
      .text(12, 12 + rows * itemHeight + 12, `Score:\t${score}`, {
        fontSize: "24px",
        color: "#222",
        fontFamily: "'IBM Plex Mono'",
      })
      .setOrigin(0);
    const bestScoreboard = this.add
      .text(12, 12 + rows * itemHeight + 12 + 32, `Best:\t\t${bestScore}`, {
        fontSize: "24px",
        color: "#222",
        fontFamily: "'IBM Plex Mono'",
      })
      .setOrigin(0);

    // add a button to reset the game
    this.add
      .text(columns * itemWidth + 12, 12 + rows * itemHeight + 12, "Reset", {
        fontSize: "24px",
        color: "#222",
        fontFamily: "'IBM Plex Mono'",
      })
      .setOrigin(1, 0)
      .setInteractive()
      .on("pointerdown", () => {
        if (hasTriggered) {
          return;
        }
        hasTriggered = true;
        score = 0;
        scoreboard.setText(`Score:\t${score}`);
        for (let i = 0; i < data.length; i++) {
          const orientation = Math.floor(Math.random() * 4);
          data[i].orientation = orientation;
          this.tweens.add({
            targets: gfx[i],
            duration: tick,
            rotation: rotations[orientation],
            ease: Phaser.Math.Easing.Cubic.Out,
          });
        }
        hasTriggered = false;
      });

    const createItem = (i: number, j: number, orientation: number) => {
      const graphics = this.add.graphics();

      graphics.fillStyle(0xf8f8f8, 1);
      graphics.fillCircle(itemWidth / 2, itemWidth / 2, itemWidth / 2);

      graphics.lineStyle(itemWidth / 8, 0x88c6fe, 1);
      graphics.beginPath();
      graphics.arc(
        itemHeight,
        0,
        itemWidth / 2,
        Phaser.Math.DegToRad(-90),
        Phaser.Math.DegToRad(0),
        true
      );
      graphics.strokePath();
      graphics.closePath();

      graphics.generateTexture("itemTexture", itemWidth, itemHeight);

      const sprite = this.add
        .sprite(
          12 + itemWidth / 2 + i * itemWidth,
          12 + itemWidth / 2 + j * itemHeight,
          "itemTexture"
        )
        .setOrigin(0.5)
        .setRotation(rotations[orientation])
        .setInteractive();

      graphics.destroy();
      return sprite;
    };

    // add a grid of sprites, each some pixels in size
    for (let i = 0; i < columns; i++) {
      for (let j = 0; j < rows; j++) {
        // read the orientation for this element
        const orientation = data[j * columns + i].orientation;

        const item = createItem(i, j, orientation);
        gfx[j * columns + i] = item;

        // when the item is tapped, then rotate it 90 degrees and update orientation
        item.setInteractive().on("pointerdown", async () => {
          this.cameras.main.flash(0x000000, 100);
          if (hasTriggered) {
            return;
          }
          hasTriggered = true;
          score = 0;

          const flash = (obj: GameObjects.Text) => {
            this.tweens.add({
              targets: obj,
              duration: 300,
              alpha: 0,
              yoyo: true,
              repeat: 3,
              onComplete: () => {
                obj.setAlpha(1);
              },
            });
          };

          let next = [j * columns + i];
          const timer = this.time.addEvent({
            startAt: 0,
            delay: tick,
            callback: () => {
              if (next.length === 0) {
                timer.remove();
                hasTriggered = false;
                // flash the scoreboard
                flash(scoreboard);
                if (score > bestScore) {
                  bestScore = score;
                  bestScoreboard.setText(`Best:\t\t${bestScore}`);
                  flash(bestScoreboard);

                  // save the best score to local storage
                  localStorage.setItem("bestScore", bestScore.toString());
                }

                return;
              }

              const rotated = new Set<number>();
              for (const index of next) {
                const orientation = (data[index].orientation + 1) % 4;
                data[index].orientation = orientation;
                // rotation tween
                this.tweens.add({
                  targets: gfx[index],
                  duration: tick,
                  rotation: rotations[orientation],
                  ease: Phaser.Math.Easing.Cubic.Out,
                });

                const gradientLength = 120;
                const start = Phaser.Display.Color.HexStringToColor("#88c6fe");
                const end = Phaser.Display.Color.HexStringToColor("#ffffff");
                // colour tween
                this.tweens.addCounter({
                  from: 0,
                  to: gradientLength,
                  duration: tick * 4,
                  onUpdate: (tween) => {
                    const gradient =
                      Phaser.Display.Color.Interpolate.ColorWithColor(
                        start,
                        end,
                        gradientLength,
                        tween.getValue()
                      );

                    gfx[index].setTint(
                      Phaser.Display.Color.GetColor(
                        gradient.r,
                        gradient.g,
                        gradient.b
                      )
                    );
                  },
                  onComplete: () => {
                    gfx[index].clearTint();
                  },
                });
                // generate a short audio clip to play
                this.sound.play("click", {
                  volume: 0.5,
                  delay: Math.random() * (tick / 1000),
                });
                score++;
                scoreboard.setText(`Score:\t${score}`);
                rotated.add(index);
              }

              // set next to the indexes that were rotated
              next = Array.from(findNextRotationIndexes(rotated, data));
            },
            repeat: -1,
          });
        });
      }
    }
  }
}
