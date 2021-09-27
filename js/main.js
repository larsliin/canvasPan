/*
    https://stackoverflow.com/a/60235061
*/
const settings = { outerMargX: 20, outerMargY: 20, innerMargX: 100, innerMargY: 100, gutterX: 100, gutterY: 100, maxZoom: 5, minZoom: .5 };
const ctx = canvas.getContext("2d");
const mouse = { x: 0, y: 0, oldX: 0, oldY: 0, button: false };
let boardWidth = 0;
let boardHeight = 1000;
let data;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// load json data
fetch("data/data.json")
    .then(response => response.json())
    .then(json => {
        data = json;
        loadImages();
    });

// load images
function loadImages() {
    let c = 0;
    for (i = 0; i < data.length; i++) {
        const dataObj = data[i];
        const assetsLoaded = dataObj.map((obj, index) =>
            new Promise(resolve => {
                const img = new Image();
                img.onerror = e => reject(`${url} failed to load`);
                img.onload = e => resolve(img);
                img.src = obj.src;
                img.data = `${i},${index}`;
            })
        );
        Promise
            .all(assetsLoaded)
            .then(images => {
                images.forEach((e) => {
                    const indexArr = e.data.split(',');

                    // push img into data obj for reference
                    data[indexArr[0]][indexArr[1]].img = e;
                });

                if (c === data.length - 1) {
                    buildEventListeners();
                }

                render();

                requestAnimationFrame(drawCanvas);

                c++;
            })
            .catch(err => console.error(err));
    }
}


// render images
function drawImages() {
    let yPos = 0;
    for (i = 0; i < data.length; i++) {
        let xPos = 0;
        let maxHeight = 0;
        const obj = data[i];

        for (j = 0; j < obj.length; j++) {
            img = new Image();
            img = obj[j].img;

            if (typeof img !== 'undefined') {
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#999999';
                ctx.drawImage(img, xPos + (settings.outerMargX + settings.innerMargX), yPos + (settings.outerMargY + settings.innerMargY));
                ctx.shadowBlur = 0;

                maxHeight = Math.max(maxHeight, img.height);

                xPos = xPos + settings.gutterX + img.width;


                boardWidth = Math.max(boardWidth, xPos - settings.gutterX + (settings.innerMargX * 2));
            }
        }
        yPos = yPos + maxHeight + settings.gutterY;
        boardHeight = Math.max(boardHeight, yPos - settings.gutterY + (settings.innerMargY * 2));
    }
}

// zoom / pan api
const view = (() => {
    const matrix = [1, 0, 0, 1, 0, 0]; // current view transform
    var m = matrix; // alias 
    var scale = 1; // current scale
    var ctx; // reference to the 2D context
    const pos = { x: 0, y: 0 }; // current position of origin
    var dirty = true;
    const API = {
        set context(_ctx) {
            ctx = _ctx;
            dirty = true
        },
        apply() {
            if (dirty) { this.update() }
            ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5])
        },
        get scale() { return scale },
        get position() { return pos },
        isDirty() { return dirty },
        update() {
            dirty = false;
            m[3] = m[0] = scale;
            m[2] = m[1] = 0;
            m[4] = pos.x;
            m[5] = pos.y;
        },
        pan(amount) {
            if (dirty) { this.update() }
            pos.x += amount.x;
            pos.y += amount.y;
            dirty = true;
        },
        scaleAt(at, amount) { // at in screen coords
            if (dirty) { this.update() }
            scale *= amount;
            console.log(scale);

            pos.x = at.x - (at.x - pos.x) * amount;
            pos.y = at.y - (at.y - pos.y) * amount;
            dirty = true;
        },
        drawBoard() {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#999999';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(settings.outerMargX, settings.outerMargY, boardWidth, boardHeight);
            ctx.shadowBlur = 0;
        },
    };
    return API;
})();

// render canvas
function drawCanvas() {
    if (view.isDirty()) {
        render();
    }
    requestAnimationFrame(drawCanvas);
}

function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    view.apply();

    view.drawBoard();

    drawImages();
}

function mouseEvent(event) {
    if (event.type === "mousedown") { mouse.button = true }
    if (event.type === "mouseup" || event.type === "mouseout") { mouse.button = false }
    mouse.oldX = mouse.x;
    mouse.oldY = mouse.y;
    mouse.x = event.offsetX;
    mouse.y = event.offsetY
    if (mouse.button) { // pan
        view.pan({ x: mouse.x - mouse.oldX, y: mouse.y - mouse.oldY });
        document.getElementById('canvas').style.cursor = 'grabbing';
    } else {
        document.getElementById('canvas').style.cursor = 'grab';
    }
}

function mouseWheelEvent(event) {
    var x = event.offsetX;
    var y = event.offsetY;
    if (event.deltaY < 0) { view.scaleAt({ x, y }, 1.1) } else { view.scaleAt({ x, y }, 1 / 1.1) }
    event.preventDefault();
}

function onWindowResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    render();

    requestAnimationFrame(drawCanvas);
}

function buildEventListeners() {
    window.addEventListener("resize", onWindowResize, { passive: true });
    canvas.addEventListener("mousemove", mouseEvent, { passive: true });
    canvas.addEventListener("mousedown", mouseEvent, { passive: true });
    canvas.addEventListener("mouseup", mouseEvent, { passive: true });
    canvas.addEventListener("mouseout", mouseEvent, { passive: true });
    canvas.addEventListener("wheel", mouseWheelEvent, { passive: false });
}

view.context = ctx;