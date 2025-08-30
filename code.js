window.onload = function() {
  // ================== CONFIG ==================
  const COLORS = {
    bg: "#2d3317ff",
    playerFill: "#e74c3c",
    playerStroke: "#000000",
    swordHitbox: "rgba(0,0,0,0.25)"
  };
  const SHOW_SWORD_HITBOX = false; // set true to visualize sword hitbox

  // ================== GENERAL FUNCTIONS ==================

  // Returns a random integer between min and max (inclusive)

  function ranNum(min, max) {
  let seed = Math.random();
  seed = Math.floor(seed * (max - (min - 1))) + min;
  return seed;
  }


  // ================== SETUP ==================
  const canvas = document.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = document.documentElement.clientWidth;
  canvas.height = document.documentElement.clientHeight;

  // ================== CAMERA ==================
  const camera = {
    x: 0,
    y: 0,
    update() {
      this.x = player.x;
      this.y = player.y;
    }
  };

  // ================== PLAYER ==================
  const player = {
    x: 0,
    y: 0,
    radius: 22,
    drawX: canvas.width / 2,
    drawY: canvas.height / 2,
    draw() {
      ctx.beginPath();
      ctx.arc(this.drawX, this.drawY, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.playerFill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.playerStroke;
      ctx.stroke();
    }
  };

  // ================== OBJECT LIST ==================
  class OBJECTLIST {
  constructor(x, y, width, height, backUpImage) {
    // Array stuff
    this.isList = true;
    this.arrayLength = 0;
    this.array = {};
    this.patchCount = 0;

    // Global properties
    this.isSolid = false;
    this.id = "";

    // Blueprint properties
    this.typeBP = 1;   // 1 = rect, 2 = image, 3 = gif
    this.renderBP = 1;
    this.toMoveXBP = x;
    this.toMoveYBP = y;
    this.xBP = x;
    this.yBP = y;
    this.screenXBP = this.xBP - camera.x + canvas.width / 2;
    this.screenYBP = this.yBP - camera.y + canvas.height / 2;
    this.widthBP = width;
    this.heightBP = height;
    this.speedBP = 0;
    this.colorBP = "black";

    // image stuff
    this.imageHolder = new Image(this.widthBP, this.heightBP);
    this.imgSrcBP = backUpImage || "";
    this.framesBP = 0;
    this.currentFrame = 0;

    // Saving last position
    this.lastPosXBP = 0;
    this.lastPosYBP = 0;

    // For maintainMax
    this.increment = 0;

    this.timeOut = 5;
  }

randomizeBlueprintXY(distance) {
  // Spawn around the player in WORLD space, within a square of size (2*distance)
  this.xBP = player.x + ranNum(-distance, distance);
  this.yBP = player.y + ranNum(-distance, distance);
}

  createObjectAtObject(obj) {
    if (this.timeOut >= 5) {
      this.xBP = obj.x;
      this.yBP = obj.y;
      this.createObjects(1, false);
      this.timeOut = 0;
    }
    this.timeOut++;
  }

  maintainMax(max) {
    if (this.arrayLength <= this.increment) {
      this.increment = 0;
    }
    if (this.arrayLength > max) {
      for (let i = 0; i < this.arrayLength - max; i++) {
        this.removeObject(this.increment);
        this.increment++;
      }
    }
  }

  createObjects(amt, randomStartingLoc, distance) {
    let startingArrayLength = this.arrayLength;
    for (let i = this.arrayLength; i < startingArrayLength + amt; i++) {
      if (randomStartingLoc) {
        this.randomizeBlueprintXY(distance);
      }
      this.array[i] = {
        type: this.typeBP,
        render: this.renderBP,
        frames: this.framesBP,
        imgSrc: this.imgSrcBP,
        color: this.colorBP,
        toMoveX: this.toMoveXBP,
        toMoveY: this.toMoveYBP,
        x: this.xBP,
        y: this.yBP,
        lastPosX: this.xBP,
        lastPosY: this.yBP,
        screenX: this.xBP - camera.x + canvas.width / 2,
        screenY: this.yBP - camera.y + canvas.height / 2,
        width: this.widthBP,
        height: this.heightBP,
      };
      this.arrayLength++;
    }
  }

  removeObject(index) {
    // Clear old render (optional external clearobj)
    // clearobj(this.array[index]);

    // Copy last object into this index
    this.array[index]["type"] = this.array[this.arrayLength - 1]["type"];
    this.array[index]["render"] = this.array[this.arrayLength - 1]["render"];
    this.array[index]["frames"] = this.array[this.arrayLength - 1]["frames"];
    this.array[index]["currentFrame"] = this.array[this.arrayLength - 1]["currentFrame"];
    this.array[index]["imgSrc"] = this.array[this.arrayLength - 1]["imgSrc"];
    this.array[index]["color"] = this.array[this.arrayLength - 1]["color"];
    this.array[index]["toMoveX"] = this.array[this.arrayLength - 1]["toMoveX"];
    this.array[index]["toMoveY"] = this.array[this.arrayLength - 1]["toMoveY"];
    this.array[index]["x"] = this.array[this.arrayLength - 1]["x"];
    this.array[index]["y"] = this.array[this.arrayLength - 1]["y"];
    this.array[index]["lastPosX"] = this.array[this.arrayLength - 1]["lastPosX"];
    this.array[index]["lastPosY"] = this.array[this.arrayLength - 1]["lastPosY"];
    this.array[index]["screenX"] = this.array[this.arrayLength - 1]["screenX"];
    this.array[index]["screenY"] = this.array[this.arrayLength - 1]["screenY"];
    this.array[index]["width"] = this.array[this.arrayLength - 1]["width"];
    this.array[index]["height"] = this.array[this.arrayLength - 1]["height"];

    // Delete the last object
    delete this.array[this.arrayLength - 1];
    this.arrayLength--;
  }

  renderObjects() {
    for (let i = 0; i < this.arrayLength; i++) {
      const obj = this.array[i];

      obj.lastPosX = obj.x;
      obj.lastPosY = obj.y;

      // ✅ Fixed: WORLD → SCREEN coords
      obj.screenX = obj.lastPosX - camera.x + canvas.width / 2;
      obj.screenY = obj.lastPosY - camera.y + canvas.height / 2;

      if (obj.render === 1) {
        ctx.fillStyle = obj.color;
        ctx.fillRect(obj.screenX, obj.screenY, obj.width, obj.height);
      } else if (obj.render === 2) {
        this.imageHolder.src = obj.imgSrc;
        ctx.drawImage(this.imageHolder, obj.screenX, obj.screenY, obj.width, obj.height);
      } else if (obj.render === 3) {
        if (obj.currentFrame > obj.frames - 1) obj.currentFrame = 0;
        obj.currentFrame++;
        this.imageHolder.src = obj.imgSrc.replace(
          ".png",
          obj.currentFrame.toString() + ".png"
        );
        ctx.drawImage(this.imageHolder, obj.screenX, obj.screenY, obj.width, obj.height);
      }
    }
  }
}

  

  // ================== ACTORS ==================
  
    const dummies = new OBJECTLIST(0,0,200,200);
    dummies.id = "dummies";
    dummies.imgSrcBP = "dummy.png"
    dummies.renderBP = 2;
    dummies.createObjects(500,true,5000);

  // ================== SPRITES ==================;

  const swordImg = new Image();
  swordImg.src = "sword.png";

  // ================== SWORD ==================
  const sword = {
    x: 0, y: 0, width: 50, height: 100,
    increment: 0, counterX: 0, startingAngle: 0, j: 0,
    isSwinging: false, swingFinished: true,

    startSwing() {
      if (this.swingFinished) {
        this.isSwinging = true;
        this.swingFinished = false;
        this.increment = 0;
        this.counterX = 0;
        this.j = 0;
      }
    },

    swingRender() {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const swordOffsetX = 60;
      const swordOffsetY = 48;
      const speed = 3;

      for (let i = 0; i < speed; i++) {
        this.x = player.x + 100 + this.counterX;
        this.y = player.y - swordOffsetY - 150;

        if (SHOW_SWORD_HITBOX) {
          const sx = this.x - camera.x + canvas.width / 2;
          const sy = this.y - camera.y + canvas.height / 2;
          ctx.fillStyle = COLORS.swordHitbox;
          ctx.fillRect(sx, sy, this.width, this.height);
        }

        if (this.increment > 130) {
          this.counterX += 2.5;
          this.j += 1;
          if (this.j > this.startingAngle) {
            this.isSwinging = false;
            this.swingFinished = true;
            return;
          }
        } else {
          this.j = -this.increment;
          this.increment++;
          this.counterX -= 2;
        }

        if (swordImg.complete) {
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(this.startingAngle * Math.PI / 180);
          ctx.rotate(this.j * Math.PI / 180);
          ctx.drawImage(swordImg, -swordOffsetX, -swordOffsetY);
          ctx.restore();
        }
      }
    }
  };

  // ================== COLLISION ==================
  function collisionDetection(obj1, obj2List) {
    const hit = (a, b) =>
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y;

    for (let i = 0; i < obj2List.arrayLength; i++) {
      if (hit(obj1, obj2List.array[i])) return [true, i];
    }
    return [false];
  }

  // ================== INPUT ==================
  const keysPressed = {};
  document.onkeydown = (e) => {
    keysPressed[e.key] = true;
    if (e.key === " ") sword.startSwing();
  };
  document.onkeyup = (e) => { keysPressed[e.key] = false; };

  // ================== COORDS HUD ==================
  function updateCords() {
    const pc = document.getElementById("playerCords");
    const cc = document.getElementById("cameraCords");
    const bc = document.getElementById("bobCords");
    document.getElementById("kills").innerHTML = "DUMMIES DESTORYED: " + dummyKills;
    if (pc) pc.innerText = `PLAYER x: ${player.x}, y: ${player.y}`;
    if (cc) cc.innerText = `CAMERA x: ${camera.x}, y: ${camera.y}`;
    if (bc && dummies.arrayLength > 0) {
      bc.innerText = `CRATE[0] x: ${dummies.array[0].x}, y: ${dummies.array[0].y}`;
    }
  }
  // ================== GAME VARIABLES ==================
  let dummyKills = 0;
  // ================== GAME LOOP ==================
  function gameLoop() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (keysPressed["w"]) player.y -= 5;
    if (keysPressed["a"]) player.x -= 5;
    if (keysPressed["s"]) player.y += 5;
    if (keysPressed["d"]) player.x += 5;

    camera.update();

    dummies.renderObjects();
    player.draw();

    if (sword.isSwinging) {
      sword.swingRender();
      const hit = collisionDetection(sword, dummies);
      if (hit[0]) {
        dummies.removeObject(hit[1]);
        dummyKills++;
        console.log("Crate destroyed!");
      }
    }

    updateCords(); // << update HUD each frame

    requestAnimationFrame(gameLoop);
  }
  gameLoop();

  // ================== RESIZE ==================
  window.addEventListener("resize", () => {
    canvas.width = document.documentElement.clientWidth;
    canvas.height = document.documentElement.clientHeight;
    player.drawX = canvas.width / 2;
    player.drawY = canvas.height / 2;
  });
};
