import { Game as MainGame } from "./scenes/Game";
import { AUTO, Game, Scale, Types } from "phaser";

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Types.Core.GameConfig = {
  type: AUTO,
  width: 1048,
  height: 1200,
  parent: "game-container",
  backgroundColor: "#ddf7ff",
  scale: {
    mode: Scale.FIT,
    autoCenter: Scale.CENTER_HORIZONTALLY,
  },
  render: {
    preserveDrawingBuffer: true,
  },
  scene: [MainGame],
};

const shareButton = document.getElementById("share-button");
if (shareButton) {
  shareButton.addEventListener("click", async () => {
    const bestScore = localStorage.getItem("bestScore");
    const url = window.location.href;
    navigator.clipboard.writeText(url);

    try {
      if (!navigator.share) return;

      // if you've completed it
      let text = `I got ${bestScore} in chain reaction! `;
      if (bestScore === "0") {
        text = "I'm playing chain reaction! ";
      }

      // generate a png of the board
      const canvas = document.querySelector("canvas");
      const dataUrl = canvas?.toDataURL("image/png");
      const blob = await (await fetch(dataUrl || "")).blob();

      const file = new File([blob], "chain-reaction.png", {
        type: "image/png",
        lastModified: new Date().getTime(),
      });

      await navigator.share({
        title: "Chain Reaction",
        text: text,
        files: [file],
        url: document.URL,
      });
    } catch (error) {
      console.warn(error);
    }
  });
}

export default new Game(config);
