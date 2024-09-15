import { Scene } from "phaser";

const up = (i: number) => {
  return i < 16 ? -1 : i - 16;
};
const down = (i: number) => {
  return i > 239 ? -1 : i + 16;
};
const left = (i: number) => {
  return i % 16 === 0 ? -1 : i - 1;
};
const right = (i: number) => {
  return i % 16 === 15 ? -1 : i + 1;
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

    this.load.image("item", "item.png");

    this.load.audio("click", ["click.mp3"]);
  }

  create() {
    // create a backing data array of 256 elements, where each has an orientation property
    const data = new Array(256)
      .fill(0)
      .map((_) => ({ orientation: Math.floor(Math.random() * 4) }));

    let hasTriggered = false;

    const gfx = new Array(256).fill(null);
    const rotations = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

    const tick = 350;
    let score = 0;
    let bestScore = 0;

    // add a score element at the bottom left of the grid
    const scoreboard = this.add
      .text(12, 12 + 512 + 12, `Score: ${score}`, {
        fontSize: "32px",
        color: "#000",
      })
      .setOrigin(0);
    const bestScoreboard = this.add
      .text(12, 12 + 512 + 12 + 32, `Best: ${bestScore}`, {
        fontSize: "32px",
        color: "#000",
      })
      .setOrigin(0);

    // add a button to reset the game
    this.add
      .text(512 + 12, 12 + 512 + 12, "Reset", {
        fontSize: "32px",
        color: "#000",
      })
      .setOrigin(1, 0)
      .setInteractive()
      .on("pointerdown", () => {
        if (hasTriggered) {
          return;
        }
        hasTriggered = true;
        score = 0;
        scoreboard.setText(`Score: ${score}`);
        for (let i = 0; i < 256; i++) {
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

    // add a 16x16 grid of sprites, each 32 pixels in size
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        // read the orientation for this element
        const orientation = data[j * 16 + i].orientation;
        const item = this.add
          .image(12 + 16 + i * 32, 12 + 16 + j * 32, "item")
          .setRotation(rotations[orientation]);
        gfx[j * 16 + i] = item;

        // when the item is tapped, then rotate it 90 degrees and update orientation
        item.setInteractive().on("pointerdown", async () => {
          if (hasTriggered) {
            return;
          }
          hasTriggered = true;
          score = 0;

          let next = [j * 16 + i];
          const timer = this.time.addEvent({
            startAt: 0,
            delay: tick,
            callback: () => {
              if (next.length === 0) {
                timer.remove();
                hasTriggered = false;
                // flash the scoreboard
                this.tweens.add({
                  targets: scoreboard,
                  duration: 300,
                  alpha: 0,
                  yoyo: true,
                  repeat: 3,
                  onComplete: () => {
                    scoreboard.setAlpha(1);
                  },
                });
                if (score > bestScore) {
                  bestScore = score;
                  bestScoreboard.setText(`Best: ${bestScore}`);
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
                // colour tween
                this.tweens.addCounter({
                  from: 0xaa,
                  to: 0xff,
                  duration: tick * 3,
                  onUpdate: (tween) => {
                    const value = Math.floor(tween.getValue());
                    gfx[index].setTint(
                      Phaser.Display.Color.GetColor(value, value, value)
                    );
                  },
                  onComplete: () => {
                    gfx[index].clearTint();
                  },
                });
                // generate a short audio clip to play
                this.sound.play("click", { volume: 0.5 });
                score++;
                scoreboard.setText(`Score: ${score}`);
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
