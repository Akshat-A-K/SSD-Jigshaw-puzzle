(() => {
    let file_input = document.getElementById('imgFile');
    let start_btn = document.getElementById('startBtn');
    let reset_btn = document.getElementById('resetBtn');
    let download_btn = document.getElementById('downloadBtn');
    let diff_select = document.getElementById('difficulty');
    let board_inner = document.getElementById('boardInner');
    let status_el = document.getElementById('status');
    let progress_el = document.getElementById('progress');
    let info_el = document.getElementById('info');

    let img = new Image();
    let pieces = [];
    let placed_count = 0;
    let rows = 0, cols = 0;
    let piece_w = 0, piece_h = 0;
    let puzzle_w = 0, puzzle_h = 0;
    let image_loaded = false;
    let image_size = { w: 0, h: 0 };
    let z_index = 10;

    let compute_grid = n => {
        let approx = Math.round(Math.sqrt(n));
        let best = { r: approx, c: Math.ceil(n / approx) };
        for (let r = 1; r <= Math.ceil(Math.sqrt(n)) * 2; r++) {
            let c = Math.ceil(n / r);
            if (r * c >= n && Math.abs(r - c) < Math.abs(best.r - best.c)) best = { r, c };
        }
        return best;
    };

    let load_image = (file, cb) => {
        let reader = new FileReader();
        reader.onload = e => {
            img = new Image();
            img.onload = () => {
                image_loaded = true;
                image_size = { w: img.naturalWidth, h: img.naturalHeight };
                cb();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    let prepare_puzzle = () => {
        clear_board();
        if (!image_loaded) {
            Swal.fire("Please upload an image first!");
            return;
        }

        let count = Number(diff_select.value) || 20;
        let grid = compute_grid(count);
        rows = grid.r;
        cols = grid.c;

        let max_w = 800, max_h = 500;
        let scale = Math.min(max_w / img.naturalWidth, max_h / img.naturalHeight, 1);
        puzzle_w = Math.round(img.naturalWidth * scale);
        puzzle_h = Math.round(img.naturalHeight * scale);

        board_inner.style.width = puzzle_w + 'px';
        board_inner.style.height = puzzle_h + 'px';

        piece_w = puzzle_w / cols;
        piece_h = puzzle_h / rows;

        pieces = [];
        placed_count = 0;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let sx = c * (img.naturalWidth / cols);
                let sy = r * (img.naturalHeight / rows);
                let sw = img.naturalWidth / cols;
                let sh = img.naturalHeight / rows;

                let canvas = document.createElement('canvas');
                canvas.width = Math.ceil(piece_w);
                canvas.height = Math.ceil(piece_h);
                let ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(
                    img,
                    Math.floor(sx), Math.floor(sy),
                    Math.ceil(sw) + 1, Math.ceil(sh) + 1,
                    -0.5, -0.5,
                    canvas.width + 1, canvas.height + 1
                );

                let el = document.createElement('img');
                el.className = 'piece';
                el.src = canvas.toDataURL();
                el.style.width = canvas.width + 'px';
                el.style.height = canvas.height + 'px';

                let target_x = Math.round(c * piece_w);
                let target_y = Math.round(r * piece_h);

                pieces.push({ el, target_x, target_y, placed: false });
            }
        }

        board_inner.innerHTML = '';
        pieces.forEach((p, i) => {
            board_inner.appendChild(p.el);
            p.el.style.left = Math.random() * (puzzle_w - piece_w) + 'px';
            p.el.style.top = Math.random() * (puzzle_h - piece_h) + 'px';
            p.el.style.position = 'absolute';
            p.el.style.zIndex = z_index++;
            enable_drag(p);
        });

        update_progress();
        info_el.textContent = `Image: ${image_size.w}×${image_size.h} • Grid: ${rows}×${cols} (${pieces.length} pieces)`;
    };

    let clear_board = () => {
        pieces.forEach(p => { if (p.el && p.el.parentNode) p.el.remove(); });
        pieces = [];
        board_inner.innerHTML = '';
        progress_el.style.width = '0%';
        status_el.textContent = 'Pieces: 0 • Placed: 0';
        info_el.textContent = 'No image loaded';
        placed_count = 0;
    };

    let enable_drag = piece_obj => {
        let el = piece_obj.el;
        let offset_x = 0, offset_y = 0, dragging = false;

        let down = e => {
            if (piece_obj.placed) return;
            dragging = true;
            el.setPointerCapture(e.pointerId);
            el.style.cursor = 'grabbing';
            let rect = el.getBoundingClientRect();
            offset_x = e.clientX - rect.left;
            offset_y = e.clientY - rect.top;
            el.style.zIndex = z_index++;
        };

        let move = e => {
            if (!dragging) return;
            let rect = board_inner.getBoundingClientRect();
            let x = e.clientX - rect.left - offset_x;
            let y = e.clientY - rect.top - offset_y;
            x = Math.max(0, Math.min(x, board_inner.clientWidth - el.clientWidth));
            y = Math.max(0, Math.min(y, board_inner.clientHeight - el.clientHeight));
            el.style.left = x + 'px';
            el.style.top = y + 'px';
        };

        let up = e => {
            if (!dragging) return;
            dragging = false;
            el.releasePointerCapture(e.pointerId);
            el.style.cursor = 'grab';

            let left = parseInt(el.style.left || 0);
            let top = parseInt(el.style.top || 0);
            let dx = left - piece_obj.target_x, dy = top - piece_obj.target_y;
            let snap = Math.max(piece_w, piece_h) * 0.35;

            if (Math.hypot(dx, dy) < snap) {
                el.style.left = piece_obj.target_x + 'px';
                el.style.top = piece_obj.target_y + 'px';
                piece_obj.placed = true;
                el.classList.add('placed');
                el.style.pointerEvents = 'none';
                placed_count++;
                update_progress();
                if (placed_count === pieces.length) {
                    board_inner.innerHTML = '';
                    let solved = document.createElement('img');
                    solved.src = img.src;
                    solved.style.width = puzzle_w + 'px';
                    solved.style.height = puzzle_h + 'px';
                    solved.style.display = 'block';
                    board_inner.appendChild(solved);
                    Swal.fire("🎉 Puzzle complete!", "Great job!", "success");
                }
            }
        };

        el.addEventListener('pointerdown', down);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    let update_progress = () => {
        let pct = pieces.length ? Math.round((placed_count / pieces.length) * 100) : 0;
        progress_el.style.width = pct + '%';
        status_el.textContent = `Pieces: ${pieces.length} • Placed: ${placed_count}`;
    };

    start_btn.addEventListener('click', () => {
        if (!image_loaded) {
            Swal.fire("Please choose an image file first!");
            return;
        }
        prepare_puzzle();
    });

    reset_btn.addEventListener('click', () => {
        if (!image_loaded) {
            Swal.fire("No image to reset!");
            return;
        }
        prepare_puzzle();
    });

    download_btn.addEventListener('click', () => {
        if (!image_loaded) {
            Swal.fire("Load an image first!");
            return;
        }
        let a = document.createElement('a');
        a.href = img.src;
        a.download = 'puzzle-image.png';
        a.click();
    });

    file_input.addEventListener('change', e => {
        let file = e.target.files && e.target.files[0];
        if (!file) return;
        load_image(file, () => {
            info_el.textContent = 'Image loaded. Click Start to create puzzle.';
        });
    });

    board_inner.addEventListener('dragstart', e => e.preventDefault());
})();

let dark_btn = document.getElementById("darkModeToggle");
dark_btn.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  dark_btn.textContent = document.body.classList.contains("dark-mode")
    ? "Light Mode"
    : "Dark Mode";
});

function trackUserEvents() {
  console.log("Page viewed:", window.location.href);
  document.addEventListener("click", (event) => {
    event.preventDefault();
    const element = event.target;
    const details = {
      tag: element.tagName,
      id: element.id || null,
      class: element.className || null,
      text: element.innerText ? element.innerText.slice(0, 50) : null,
      timestamp: new Date().toISOString(),
    };
    console.log("Click event:", details);
  });
}

trackUserEvents();
