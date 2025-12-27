
      /* ================= STATE ================= */
      const board = document.getElementById("board");
      const startOverlay = document.getElementById("startOverlay");
      const timeEl = document.getElementById("time");
      const movesEl = document.getElementById("moves");
      const message = document.getElementById("message");
      const swapSound = document.getElementById("swapSound");
      const winSound = document.getElementById("winSound");
      const resetBtn = document.getElementById("resetBtn");
      const pauseBtn = document.getElementById("pauseBtn");
      const sizeButtons = document.querySelectorAll(
        "#sideControls button[data-size]"
      );

      let SIZE = 3;
      let tiles = [];
      const currentImage = "./Argoman_Logo.png";
      let paused = false;
      let moves = 0;
      let startTime = 0;
      let timer = null;
      let zCounter = 1;
      let allowExit = false;

      /* ================= FULLSCREEN START ================= */
      startOverlay.addEventListener(
        "pointerdown",
        async () => {
          startOverlay.classList.add("hidden");
          if (!document.fullscreenElement) {
            try {
              await document.documentElement.requestFullscreen();
            } catch (e) {}
          }
        },
        { once: true }
      );

      /* ================= GAME ================= */
      function startGame() {
        clearInterval(timer);
        board.innerHTML = "";
        tiles = [];
        moves = 0;
        zCounter = 1;
        paused = false;
        pauseBtn.textContent = "Pause";
        movesEl.textContent = "0";
        message.classList.remove("show");

        const boardSize = Math.min(window.innerWidth, window.innerHeight) * 0.9;
        const tileSize = boardSize / SIZE;

        board.style.width = boardSize + "px";
        board.style.height = boardSize + "px";

        for (let i = 0; i < SIZE * SIZE; i++) {
          const tile = document.createElement("div");
          tile.className = "tile";
          tile.dataset.correct = i;
          tile.dataset.locked = "false";

          const col = i % SIZE;
          const row = Math.floor(i / SIZE);

          tile.style.width = tileSize + "px";
          tile.style.height = tileSize + "px";
          tile.style.left = col * tileSize + "px";
          tile.style.top = row * tileSize + "px";
          tile.style.backgroundImage = `url(${currentImage})`;
          tile.style.backgroundSize = `${boardSize}px ${boardSize}px`;
          tile.style.backgroundPosition = `-${col * tileSize}px -${
            row * tileSize
          }px`;

          enablePaperPhysics(tile, tileSize);
          tiles.push(tile);
          board.appendChild(tile);
        }

        setTimeout(shuffleTiles, 5000);
        startTimer();
      }

      function shuffleTiles() {
        tiles.forEach((tile) => {
          tile.style.left =
            Math.random() * (board.clientWidth - tile.clientWidth) + "px";
          tile.style.top =
            Math.random() * (board.clientHeight - tile.clientHeight) + "px";
          tile.style.zIndex = zCounter++;
        });
      }

      function startTimer() {
        startTime = performance.now();
        timer = setInterval(() => {
          if (!paused) {
            timeEl.textContent = (
              (performance.now() - startTime) /
              1000
            ).toFixed(1);
          }
        }, 100);
      }

      /* ================= PAPER PHYSICS ================= */
      function enablePaperPhysics(tile, tileSize) {
        let offsetX = 0,
          offsetY = 0;

        tile.addEventListener("pointerdown", (e) => {
          if (paused || tile.dataset.locked === "true") return;
          tile.setPointerCapture(e.pointerId);
          tile.classList.add("dragging");
          tile.style.zIndex = zCounter++;
          offsetX = e.clientX - tile.offsetLeft;
          offsetY = e.clientY - tile.offsetTop;
        });

        tile.addEventListener("pointermove", (e) => {
          if (!tile.classList.contains("dragging")) return;
          tile.style.left = e.clientX - offsetX + "px";
          tile.style.top = e.clientY - offsetY + "px";
        });

        tile.addEventListener("pointerup", (e) => {
          if (!tile.classList.contains("dragging")) return;
          tile.releasePointerCapture(e.pointerId);
          tile.classList.remove("dragging");
          handleDrop(tile, tileSize);
        });
      }

      function handleDrop(tile, tileSize) {
        const rect = tile.getBoundingClientRect();
        const boardRect = board.getBoundingClientRect();
        const col = Math.round((rect.left - boardRect.left) / tileSize);
        const row = Math.round((rect.top - boardRect.top) / tileSize);
        const targetIndex = row * SIZE + col;

        moves++;
        movesEl.textContent = moves;

        if (targetIndex === +tile.dataset.correct) {
          tile.style.left = col * tileSize + "px";
          tile.style.top = row * tileSize + "px";
          tile.classList.add("locked");
          tile.dataset.locked = "true";
          tile.style.zIndex = 0;
        }

        if (tiles.every((t) => t.dataset.locked === "true")) finishGame();
      }

      function finishGame() {
        clearInterval(timer);
        paused = true;
        message.classList.add("show");
      }

      /* ================= UI ================= */
      resetBtn.addEventListener("click", startGame);

      pauseBtn.addEventListener("click", () => {
        paused = !paused;
        pauseBtn.textContent = paused ? "Resume" : "Pause";
        if (!paused)
          startTime = performance.now() - parseFloat(timeEl.textContent) * 1000;
      });

      sizeButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          SIZE = Number(btn.dataset.size);
          sizeButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          startGame();
        });
      });

      /* ================= FULLSCREEN LOCK ================= */
      document.addEventListener("touchstart", (e) => {
        if (e.touches.length >= 3) allowExit = true;
      });

      document.addEventListener("touchend", (e) => {
        if (e.touches.length === 0) allowExit = false;
      });

      document.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement && !allowExit) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      });

      /* ================= START ================= */
      const img = new Image();
      img.onload = startGame;
      img.src = currentImage;