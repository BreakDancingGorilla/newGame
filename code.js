      window.onload = function () {
        // ================== CONFIG ==================
        const COLORS = {
          bg: "#2d3317ff",
          playerFill: "#e74c3c",
          playerStroke: "#000000",
          swordHitbox: "rgba(0,0,0,0.25)",
          objectsHitBox: "rgba(238, 19, 19, 0.5)",
        };
        const SHOW_SWORD_HITBOX = true; // visualize sword hitbox if true

        // ================== IMAGE CACHE ==================
        const imageCache = new Map();
        function getImage(src) {
          let img = imageCache.get(src);
          if (!img) {
            img = new Image();
            img.src = src; // load just once
            imageCache.set(src, img);
          }
          return img;
        }

        // ================== GENERAL FUNCTIONS ==================
        function ranNum(min, max) {
          // inclusive integer
          return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        // Frame-time tracker (delta time)
        const deltaTime = {
          lastUpdate: Date.now(),
          currentUpdate: Date.now(),
          time: 0.016,
          update: function () {
            this.currentUpdate = Date.now();
            if (!this.lastUpdate) this.lastUpdate = this.currentUpdate;
            this.time = (this.currentUpdate - this.lastUpdate) / 1000;
            if (!isFinite(this.time) || this.time < 0) this.time = 0.016;
            this.lastUpdate = this.currentUpdate;
          },
        };

        // === Collision helpers for the player (not used externally, but kept for completeness) ===
        function playerAABBBox(p) {
          return {
            x: p.x - p.radius,
            y: p.y - p.radius,
            width: p.radius * 2,
            height: p.radius * 2,
          };
        }

        // ================== SETUP ==================
        const canvas = document.querySelector("canvas");
        const ctx = canvas.getContext("2d", { alpha: false });
        canvas.width = document.documentElement.clientWidth;
        canvas.height = document.documentElement.clientHeight;

        // ================== CAMERA ==================
        const camera = {
          x: 0,
          y: 0,
          update() {
            this.x = player.x;
            this.y = player.y;
          },
        };

        // ================== PLAYER ==================
        const player = {
          x: 0,
          y: 0,
          velocityX: 0,
          velocityY: 0,
          radius: 22,
          drawX: canvas.width / 2,
          drawY: canvas.height / 2,
          speed: 1000,

          draw() {
            ctx.beginPath();
            ctx.arc(this.drawX, this.drawY, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = COLORS.playerFill;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = COLORS.playerStroke;
            ctx.stroke();
          },

          // Build the player's AABB at an arbitrary (x, y)
          _aabbAt(x, y) {
            return {
              x: x - this.radius,
              y: y - this.radius,
              width: this.radius * 2,
              height: this.radius * 2,
            };
          },

          // Test a rect against *all* actor lists; stop on first collision
          _collides(rect) {
            for (let li = 0; li < actors.length; li++) {
              const list = actors[li];
              const res = collisionDetection(rect, list);
              if (res[0]) return true;
            }
            return false;
          },

          move() {
            // collect input → velocities (frame-rate independent)
            if (keysPressed["w"]) this.velocityY -= this.speed * deltaTime.time;
            if (keysPressed["a"]) this.velocityX -= this.speed * deltaTime.time;
            if (keysPressed["s"]) this.velocityY += this.speed * deltaTime.time;
            if (keysPressed["d"]) this.velocityX += this.speed * deltaTime.time;

            // normalize diagonal
            if (this.velocityX !== 0 && this.velocityY !== 0) {
              const k = 0.70710678;
              this.velocityX *= k;
              this.velocityY *= k;
            }

            // per-axis resolution using collisionDetection

            // Try X
            if (this.velocityX !== 0) {
              const nextX = this.x + this.velocityX;
              const probeRectX = this._aabbAt(nextX, this.y);
              if (!this._collides(probeRectX)) {
                this.x = nextX; // free to move on X
              }
            }

            // Try Y
            if (this.velocityY !== 0) {
              const nextY = this.y + this.velocityY;
              const probeRectY = this._aabbAt(this.x, nextY);
              if (!this._collides(probeRectY)) {
                this.y = nextY; // free to move on Y
              }
            }

            // reset input accumulators
            this.velocityX = 0;
            this.velocityY = 0;
          },
        };

        // ================== ACTORS ==================
        var actors = [];
        // ================== OBJECT LIST HELPERS ==================
        // --- SPAWN-ONLY: full-rectangle overlap (ignores hitboxes) ---
function rectsOverlap(r1, r2) {
  return (
    r1.x < r2.x + r2.width &&
    r1.x + r1.width > r2.x &&
    r1.y < r2.y + r2.height &&
    r1.y + r1.height > r2.y
  );
}

// Check candidate rect against the *visual bounds* of all existing objects
// Optional padding increases spacing between spawns.
function boundsOverlapWithAny(rect, actors, padding = 0) {
  for (let li = 0; li < actors.length; li++) {
    const list = actors[li];
    if (!list || !Array.isArray(list.array) || list.array.length === 0) continue;

    for (let i = 0; i < list.array.length; i++) {
      const obj = list.array[i];
      const other = {
        x: obj.x - padding,
        y: obj.y - padding,
        width: obj.width + padding * 2,
        height: obj.height + padding * 2,
      };
      if (rectsOverlap(rect, other)) return true;
    }
  }
  return false;
}

        // ================== OBJECT LIST (ARRAY-BASED) ==================
        class OBJECTLIST {
          constructor(x, y, width, height, backUpImage) {
            this.isList = true;
            this.array = [];
            this.arrayLength = 0;

            this.isSolid = false;
            this.id = "";

            // Blueprint
            this.typeBP = 1;
            this.renderBP = 1;
            this.toMoveXBP = x;
            this.toMoveYBP = y;
            this.xBP = x;
            this.yBP = y;
            this.screenXBP = this.xBP - camera.x + canvas.width / 2;
            this.screenYBP = this.yBP - camera.y + canvas.height / 2;
            this.widthBP = width;
            this.heightBP = height;
            this.colorBP = "black";
            this.hitBoxesBP = []; // [{x,y,width,height}] OFFSETS from (x,y)
            this.showHitBoxes = true;

            /// NPC Stuff
            this.speed = player.speed;
            this.behavior = "neutral"; /// PASSIVE, NEUTRAL, AGGRESSIVE
            this.maxStamina = 100;
            this.maxHunger = 100;

            this.imgSrcBP = backUpImage || "";

            // Spritesheet
            this.framesBP = 0;
            this.frameWidthBP = width;
            this.frameHeightBP = height;
            this.frameDelayBP = 4;

            // misc
            this.timeOut = 0;

            this.addToActorList();
          }

          addToActorList() {
            actors[actors.length] = this;
          }

          randomPointNear(distance, index) {
  const base = this.array[index];
  const baseX = base ? base.x : player.x;
  const baseY = base ? base.y : player.y;

  for (let attempts = 0; attempts < 100; attempts++) {
    const rect = {
      x: baseX + ranNum(-distance, distance),
      y: baseY + ranNum(-distance, distance),
      width: this.widthBP,
      height: this.heightBP,
    };
    if (!boundsOverlapWithAny(rect, actors, 4)) {
      return rect; // world coords
    }
  }
  // Fallback near player
  return {
    x: player.x + ranNum(-distance, distance),
    y: player.y + ranNum(-distance, distance),
    width: this.widthBP,
    height: this.heightBP,
  };
}


          randomizeBlueprintXY(distance) {
  let attempts = 0;
  let padding = 4; // tweak if you want extra spacing between objects

  while (true) {
    // Candidate position near the player (WORLD coords)
    this.xBP = player.x + ranNum(-distance, distance);
    this.yBP = player.y + ranNum(-distance, distance);

    const testRect = {
      x: this.xBP,
      y: this.yBP,
      width: this.widthBP,
      height: this.heightBP,
    };

    // Use bounds-based check (NOT hitboxes) so visuals don't overlap
    if (!boundsOverlapWithAny(testRect, actors, padding)) break;

    attempts++;
    if (attempts >= 60) {         // widen search if crowded
      distance = Math.floor(distance * 1.5);
      attempts = 0;
      // (optional) increase padding slowly to enforce more space
      if (padding < 16) padding += 2;
    }
  }
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

          updateNPC() {
            for (let i = 0; i < this.array.length; i++) {
              if (this.array[i].state === "roaming") {
                
              }
            }
          }

          maintainMax(max) {
            if (this.arrayLength > max) {
              for (let i = 0; i < this.arrayLength - max; i++) {
                this.removeObject(0);
              }
            }
          }

          createObjects(amt, randomStartingLoc, distance = 0) {
            for (let k = 0; k < amt; k++) {
              if (randomStartingLoc && distance > 0) {
                this.randomizeBlueprintXY(distance);
              }
              const obj = {
                type: this.typeBP,
                render: this.renderBP,
                imgSrc: this.imgSrcBP,
                color: this.colorBP,

                /// NPC Stuff
                velocityX: 0,
                velocityY: 0,
                state: "roaming", /// Attacking, roaming, eating, fleeing
                stamina: this.maxStamina,
                hunger: this.maxHunger,

                // world position
                toMoveX: this.toMoveXBP,
                toMoveY: this.toMoveYBP,
                x: this.xBP,
                y: this.yBP,
                lastPosX: this.xBP,
                lastPosY: this.yBP,
                rotate: 0,

                // screen position (computed each frame)
                screenX: this.xBP - camera.x + canvas.width / 2,
                screenY: this.yBP - camera.y + canvas.height / 2,

                // draw size
                width: this.widthBP,
                height: this.heightBP,

                // Spritesheet runtime
                frameWidth: this.frameWidthBP,
                frameHeight: this.frameHeightBP,
                frameDelay: this.frameDelayBP,
                _frameTick: 0,
                frameIndex: 0,
                frameCount: this.framesBP || 0,
                sheetCols: 0,
                sheetRows: 0,

                // Hitboxes as OFFSETS from world (x,y)
                hitBoxes: [],
              };

              // Copy blueprints as offsets (no mutation, no screen coords)
              for (let i = 0; i < this.hitBoxesBP.length; i++) {
                const bp = this.hitBoxesBP[i];
                obj.hitBoxes.push({
                  ox: bp.x,
                  oy: bp.y,
                  width: bp.width,
                  height: bp.height,
                });
              }

              // Push and set travelPoint relative to its own index
              this.array.push(obj);
              const idx = this.array.length - 1;
              const tp = this.randomPointNear(500, Math.max(0, idx));
              obj.travelPoint = { x: tp.x, y: tp.y };
            }
            this.arrayLength = this.array.length;
          }

          removeObject(index) {
            if (index < 0 || index >= this.array.length) return;
            const lastIndex = this.array.length - 1;
            if (index !== lastIndex) {
              this.array[index] = this.array[lastIndex];
            }
            this.array.pop();
            this.arrayLength = this.array.length;
          }

          renderObjects() {
            const n = this.array.length;
            for (let i = 0; i < n; i++) {
              const obj = this.array[i];

              obj.lastPosX = obj.x;
              obj.lastPosY = obj.y;

              // WORLD → SCREEN
              obj.screenX = obj.lastPosX - camera.x + canvas.width / 2;
              obj.screenY = obj.lastPosY - camera.y + canvas.height / 2;

              if (obj.render === 1) {
                ctx.fillStyle = obj.color;
                ctx.fillRect(obj.screenX, obj.screenY, obj.width, obj.height);
              } else if (obj.render === 2) {
                const img = getImage(obj.imgSrc);
                if (img.complete && img.naturalWidth) {
                  ctx.drawImage(img, obj.screenX, obj.screenY, obj.width, obj.height);
                } else {
                  // fallback rectangle when image not ready
                  ctx.fillStyle = obj.color || "#444";
                  ctx.fillRect(obj.screenX, obj.screenY, obj.width, obj.height);
                }
              } else if (obj.render === 3) {
                const img = getImage(obj.imgSrc);
                if (img.complete && img.naturalWidth && img.naturalHeight) {
                  if (!obj.sheetCols || !obj.sheetRows) {
                    obj.sheetCols = Math.max(1, Math.floor(img.naturalWidth / obj.frameWidth));
                    obj.sheetRows = Math.max(1, Math.floor(img.naturalHeight / obj.frameHeight));
                    const totalFrames = obj.sheetCols * obj.sheetRows;
                    obj.frameCount = obj.frameCount > 0 ? Math.min(obj.frameCount, totalFrames) : totalFrames;
                    obj.frameIndex = obj.frameIndex % obj.frameCount;
                  }

                  obj._frameTick++;
                  if (obj._frameTick >= obj.frameDelay) {
                    obj._frameTick = 0;
                    obj.frameIndex = (obj.frameIndex + 1) % obj.frameCount;
                  }

                  const col = obj.frameIndex % obj.sheetCols;
                  const row = Math.floor(obj.frameIndex / obj.sheetCols);
                  const sx = col * obj.frameWidth;
                  const sy = row * obj.frameHeight;
                  const sw = obj.frameWidth;
                  const sh = obj.frameHeight;

                  ctx.drawImage(img, sx, sy, sw, sh, obj.screenX, obj.screenY, obj.width, obj.height);
                } else {
                  ctx.fillStyle = obj.color || "#444";
                  ctx.fillRect(obj.screenX, obj.screenY, obj.width, obj.height);
                }
              }

              // Draw hitboxes per object (world → screen each frame)
              if (this.showHitBoxes && obj.hitBoxes && obj.hitBoxes.length > 0) {
                for (let h = 0; h < obj.hitBoxes.length; h++) {
                  const hb = obj.hitBoxes[h];
                  const sx = (obj.x + hb.ox) - camera.x + canvas.width / 2;
                  const sy = (obj.y + hb.oy) - camera.y + canvas.height / 2;
                  ctx.fillStyle = COLORS.objectsHitBox;
                  ctx.fillRect(sx, sy, hb.width, hb.height);
                }
              }
            }
          }
        }

        // ================== SPRITES ==================
        const swordImg = getImage("sword.png");

        // ================== SWORD ==================
        const sword = {
          x: 0,
          y: 0,
          width: 50,
          height: 100,
          increment: 0,
          counterX: 0,
          startingAngle: 0,
          j: 0,
          isSwinging: false,
          swingFinished: true,

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

            const speed = 3; // number of micro-steps per frame
            for (let i = 0; i < speed; i++) {
              // WORLD-space hitbox for sword
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

              if (swordImg.complete && swordImg.naturalWidth) {
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate((this.startingAngle * Math.PI) / 180);
                ctx.rotate((this.j * Math.PI) / 180);
                ctx.drawImage(swordImg, -swordOffsetX, -swordOffsetY);
                ctx.restore();
              }
            }
          },
        };

        // ================== COLLISION (RECT vs LIST) ==================
        function collisionDetection(a, b) {
          const hit = (r1, r2) =>
            r1.x < r2.x + r2.width &&
            r1.x + r1.width > r2.x &&
            r1.y < r2.y + r2.height &&
            r1.y + r1.height > r2.y;

          const isList = (x) =>
            Array.isArray(x) || (x && Array.isArray(x.array) && typeof x.arrayLength === "number");

          const getLen = (lst) => (Array.isArray(lst) ? lst.length : lst.arrayLength);
          const getAt = (lst, i) => (Array.isArray(lst) ? lst[i] : lst.array[i]);

          // iterate hitboxes only
          function* rectsFor(obj) {
            if (obj && obj.hitBoxes && obj.hitBoxes.length) {
              for (let h = 0; h < obj.hitBoxes.length; h++) {
                const hb = obj.hitBoxes[h];
                yield {
                  rect: { x: obj.x + hb.ox, y: obj.y + hb.oy, width: hb.width, height: hb.height },
                  hbIndex: h,
                };
              }
            }
          }

          // rect vs list
          if (!isList(a) && isList(b)) {
            const rect = a;
            const lenB = getLen(b);
            for (let j = 0; j < lenB; j++) {
              const objB = getAt(b, j);
              for (const { rect: hbRectB, hbIndex: hbIdxB } of rectsFor(objB)) {
                if (hit(rect, hbRectB)) return [true, j, hbIdxB];
              }
            }
            return [false];
          }

          // list vs list
          if (isList(a) && isList(b)) {
            const lenA = getLen(a);
            const lenB = getLen(b);
            const sameList = a === b;

            for (let i = 0; i < lenA; i++) {
              const objA = getAt(a, i);
              const jStart = sameList ? i + 1 : 0;

              for (let j = jStart; j < lenB; j++) {
                const objB = getAt(b, j);
                for (const { rect: rectA, hbIndex: hbIdxA } of rectsFor(objA)) {
                  for (const { rect: rectB, hbIndex: hbIdxB } of rectsFor(objB)) {
                    if (hit(rectA, rectB)) return [true, i, hbIdxA, j, hbIdxB];
                  }
                }
              }
            }
            return [false];
          }

          // rect vs single-object-with-hitboxes
          if (!isList(a) && !isList(b)) {
            for (const { rect: rectB, hbIndex: hbIdxB } of rectsFor(b)) {
              if (hit(a, rectB)) return [true, 0, hbIdxB];
            }
            return [false];
          }
        }

        // ================== INPUT ==================
        const keysPressed = {};
        document.addEventListener("keydown", (e) => {
          // prevent scrolling on space / arrows / WASD
          if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(e.key)) {
            e.preventDefault();
          }
          keysPressed[e.key] = true;
          if (e.key === " ") sword.startSwing();
        }, { passive: false });

        document.addEventListener("keyup", (e) => {
          keysPressed[e.key] = false;
        });

        // ================== COORDS HUD (THROTTLED) ==================
        let lastHudUpdate = 0;
        function updateCords(now) {
          if (now - lastHudUpdate < 100) return;
          lastHudUpdate = now;

          const pc = document.getElementById("playerCords");
          const cc = document.getElementById("cameraCords");
          const bc = document.getElementById("bobCords");
          const killsEl = document.getElementById("kills");
          if (killsEl) killsEl.textContent = "DUMMIES DESTROYED: " + dummyKills;
          if (pc) pc.textContent = `PLAYER x: ${Math.round(player.x)}, y: ${Math.round(player.y)}`;
          if (cc) cc.textContent = `CAMERA x: ${Math.round(camera.x)}, y: ${Math.round(camera.y)}`;
          if (bc && dummies.arrayLength > 0) {
            bc.textContent = `CRATE[0] x: ${Math.round(dummies.array[0].x)}, y: ${Math.round(dummies.array[0].y)}`;
          }
        }

        // ================== GAME VARIABLES ==================
        let dummyKills = 0;

        // ================== CREATE ACTORS ==================

        


        const mice = new OBJECTLIST(0, 0, 50, 100);
        mice.hitBoxesBP.push({ x: 0, y: 0, width: 50, height: 100 });
        mice.id = "mice";
        mice.imgSrcBP = "mouse.png";
        mice.renderBP = 2;
        mice.speedBP = 250;
        mice.createObjects(10, true, 500);

        const dummies = new OBJECTLIST(0, 0, 200, 200);
        dummies.hitBoxesBP.push({ x: 60, y: 0, width: 89, height: 45 });
        dummies.hitBoxesBP.push({ x: 0, y: 45, width: 200, height: 50 });
        dummies.hitBoxesBP.push({ x: 35, y: 95, width: 135, height: 50 });
        dummies.hitBoxesBP.push({ x: 65, y: 145, width: 70, height: 55 });
        dummies.id = "dummies";
        dummies.imgSrcBP = "dummy.png";
        dummies.renderBP = 2;
        dummies.createObjects(500, true, 5000);

        // ================== GAME LOOP ==================
        function gameLoop(now = 0) {
          deltaTime.update();

          ctx.fillStyle = COLORS.bg;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          player.move();
          camera.update();

          mice.renderObjects();
          dummies.renderObjects();
          player.draw();

          if (sword.isSwinging) {
            sword.swingRender();
            const hit = collisionDetection(sword, dummies);
            if (hit[0]) {
              dummies.removeObject(hit[1]);
              dummyKills++;
            }
          }

          updateCords(now);
          requestAnimationFrame(gameLoop);
        }
        requestAnimationFrame(gameLoop);

        // ================== RESIZE ==================
        window.addEventListener("resize", () => {
          canvas.width = document.documentElement.clientWidth;
          canvas.height = document.documentElement.clientHeight;
          player.drawX = canvas.width / 2;
          player.drawY = canvas.height / 2;
        });
      };