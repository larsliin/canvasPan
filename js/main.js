/*
    https://stackoverflow.com/a/60235061
*/
const settings = { outerMargX: 100, outerMargY: 200, innerMargX: 150, innerMargY: 150, gutterX: 100, gutterY: 200, headlineMargin: 60, maxZoom: 1, minZoom: .05, scaleInit: .5 };
const ctx = canvas.getContext("2d");
const mouse = { x: 0, y: 0, oldX: 0, oldY: 0, button: false };
let boardWidth = 0;
let boardHeight = 1000;
let data;
let blockData;
let scale = settings.scaleInit;
let panEnable = false;
let zoomEnable = false;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// load json data
fetch("data/data2.json")
    .then(response => response.json())
    .then(json => {
        data = json;
        loadImages();
    });

// load images
function loadImages() {
    let c = 0;
    blockData = data.blocks;

    for (i = 0; i < blockData.length; i++) {
        const dataObj = blockData[i].blockGroup;

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
                    blockData[indexArr[0]].blockGroup[indexArr[1]].img = e;                    
                });

                if (c === blockData.length - 1) {
                    buildEventListeners();
                }

                render();

                requestAnimationFrame(drawCanvas);

                c++;
            })
            .catch(err => console.error(err));
    }
}

function wrapText(context, text, x, y, line_width, line_height) {
    var line = '';
    var paragraphs = text.split('\n');
    for (var i = 0; i < paragraphs.length; i++) {
        var words = paragraphs[i].split(' ');
        for (var n = 0; n < words.length; n++) {
            var testLine = line + words[n] + ' ';
            var metrics = context.measureText(testLine);
            var testWidth = metrics.width;
            if (testWidth > line_width && n > 0) {
                context.fillText(line, x, y);
                line = words[n] + ' ';
                y += line_height;
            }
            else {
                line = testLine;
            }
        }
        context.fillText(line, x, y);
        y += line_height;
        line = '';
    }
}

// render images
function drawImages() {
    let yPos = settings.outerMargY + settings.innerMargY;
    const imgBgHeight = 200;
    renderGrid();

    for (i = 0; i < blockData.length; i++) {
        let xPos = 0;
        let maxHeight = 0;
        const headline = blockData[i].blockGroupHeadline;
        const obj = blockData[i].blockGroup;

        // render block row headlines
        ctx.fillStyle = '#555';
        ctx.font = "75px Arial Black";
        ctx.fillText(headline, settings.outerMargX + settings.innerMargX, yPos);
        yPos = yPos + settings.headlineMargin;

        // render block row images
        for (j = 0; j < obj.length; j++) {
            img = new Image();
            img = obj[j].img;

            if (typeof img !== 'undefined') {
                // apply drop shadow effect to image background
                const imagePosX = xPos + (settings.outerMargX + settings.innerMargX);

                ctx.shadowBlur = 18 * scale;
                ctx.shadowColor = '#aaa';

                // draw image background
                ctx.fillStyle = '#fafafa';
                ctx.fillRect(imagePosX + 50, yPos + 100, img.width - 100, img.height + imgBgHeight - 100);
                ctx.shadowBlur = 0;

                // render block details headline
                const textMaxWidth = img.width - 200;
                const textLineHeight = 24;
                const textBodyPosX = imagePosX + 100;
                ctx.fillStyle = '#666';
                ctx.font = "30px Arial Black";
                wrapText(ctx, obj[j].client, textBodyPosX, yPos + img.height + 70, textMaxWidth, textLineHeight);

                // render block details body
                const textBodyPosY = yPos + img.height + 100;
                ctx.fillStyle = '#333';
                ctx.font = "20px Arial";
                wrapText(ctx, obj[j].blockdescription, textBodyPosX, textBodyPosY, textMaxWidth, textLineHeight);

                // draw image
                ctx.shadowBlur = 50 * scale;
                ctx.shadowOffsetY = 0;
                ctx.shadowColor = '#999';
                ctx.drawImage(img, imagePosX, yPos);
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;
                maxHeight = Math.max(maxHeight, (img.height + imgBgHeight));

                xPos = xPos + settings.gutterX + img.width;

                // update board width value
                boardWidth = Math.max(boardWidth, xPos - settings.gutterX + (settings.innerMargX * 2));
            }
        }
        yPos = yPos + maxHeight + settings.gutterY;
        boardHeight = Math.max(boardHeight, yPos - settings.gutterY - settings.outerMargY + settings.innerMargY);
    }
}

function renderGrid() {
    let x = settings.outerMargX;
    let y = settings.outerMargY;
    let color = '#eee';
    let color2 = '#ddd';
    const dist = 20;

    for (j = 0; x <= boardWidth; j++) {
        x = x + dist;

        ctx.beginPath();
        ctx.moveTo(x, settings.outerMargY);
        ctx.lineTo(x, boardHeight + settings.outerMargY);
        ctx.strokeStyle = j % 5 === 0 ? color2 : color;
        ctx.stroke();
    }

    for (j = 0; y <= boardHeight; j++) {
        y = y + dist;
        ctx.beginPath();
        ctx.moveTo(settings.outerMargX, y);
        ctx.lineTo(boardWidth + settings.outerMargX, y);
        ctx.strokeStyle = j % 5 === 0 ? color2 : color;
        ctx.stroke();
    }
}

// zoom / pan api
const view = (() => {
    const matrix = [1, 0, 0, 1, 0, 0]; // current view transform
    var m = matrix; // alias
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

            pos.x = at.x - (at.x - pos.x) * amount;
            pos.y = at.y - (at.y - pos.y) * amount;
            dirty = true;
        },
        reset() {
            if (dirty) { this.update() }
            scale = settings.scaleInit;
            pos.x = 0;
            pos.y = 0;
            dirty = true;
        },
        drawBoard() {
            //var radgrad = ctx.createRadialGradient(500, 500, 0, 100, 100, 5000);
            //radgrad.addColorStop(0, '#ffffff');            
            //radgrad.addColorStop(1, '#efefef');

            ctx.shadowBlur = 30 * scale;
            ctx.shadowColor = '#999999';
            ctx.fillStyle = '#ffffff';
            //ctx.fillStyle = radgrad;
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
    if (mouse.button && panEnable) { // pan
        view.pan({ x: mouse.x - mouse.oldX, y: mouse.y - mouse.oldY });
        document.getElementById('canvas').style.cursor = 'grabbing';
    } else {
        if (panEnable) {
            document.getElementById('canvas').style.cursor = 'grab';
        }
    }
}

function mouseWheelEvent(event) {
    var x = event.offsetX;
    var y = event.offsetY;

    if (zoomEnable) {
        if (event.deltaY < 0) {
            if (scale > settings.maxZoom) {
                event.preventDefault();
                return false;
            }

            view.scaleAt({ x, y }, 1.1)
        } else {

            if (scale < settings.minZoom) {
                event.preventDefault();
                return false;
            }
            view.scaleAt({ x, y }, 1 / 1.1)
        }
    }
    event.preventDefault();
}

function onWindowResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    render();

    requestAnimationFrame(drawCanvas);
}

function onKeyDown(e) {
    if (e.keyCode === 32 && !panEnable) {
        panEnable = true;
        document.getElementById('canvas').style.cursor = 'grab';
    }
    if (e.keyCode === 17 && !zoomEnable) {
        zoomEnable = true;
    }
}

function onKeyUp(e) {
    panEnable = false;
    zoomEnable = false;
    document.getElementById('canvas').style.cursor = 'default';
}

function onResetClick(e) {
    view.reset();
}

function buildEventListeners() {
    window.addEventListener('keydown', onKeyDown, { passive: true });
    window.addEventListener('keyup', onKeyUp, { passive: true });
    window.addEventListener('resize', onWindowResize, { passive: true });
    canvas.addEventListener('mousemove', mouseEvent, { passive: true });
    canvas.addEventListener('mousedown', mouseEvent, { passive: true });
    canvas.addEventListener('mouseup', mouseEvent, { passive: true });
    canvas.addEventListener('mouseout', mouseEvent, { passive: true });
    canvas.addEventListener('wheel', mouseWheelEvent, { passive: false });
    document.getElementById('inp_btn_reset').addEventListener('click', onResetClick);
}

view.context = ctx;