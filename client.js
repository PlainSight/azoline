var webaddress = 'ws://localhost:7799';
//var webaddress = 'wss://plainsightindustries.com/azolinesocket';
var resourceaddress = 'http://localhost:8080/';
//var resourceaddress = 'https://plainsightindustries.com/azul/';
let socket = new WebSocket(webaddress);

socket.onopen = function() {
    sendMessage({
        type: 'connection',
        data: localStorage.getItem('azoline0.1')
    });
};

socket.onmessage = function(event) {
    processMessage(event.data);
};

var chatlog = [];
var lobbyName = '';
var serverOffset = 0;

function serverTime() {
    return Date.now() + serverOffset;
}

socket.onclose = function(event) {
    if (event.wasClean) {
        console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
    } else {
        console.log('[close] Connection died');
    }
    chatlog.push({ message: 'Connection died. Please refresh the page to reconnect.', age: Date.now() });
};

socket.onerror = function(error) {
    console.log(`[error] ${error.message}`);
};

function sendMessage(message) {
    socket.send(JSON.stringify(message));
}

function processMessage(m) {
    var message = JSON.parse(m);
    switch (message.type) {
        case 'text':
            chatlog.push({ message: message.data, age: Date.now() });
            updateDisplay(1);
            break;
        case 'cookie':
            localStorage.setItem('azoline0.1', message.data.cookie);
            serverOffset = message.data.serverTime - Date.now();
            break;
        case 'nameplease':
            showNamebox = true;
            updateDisplay(1);
            break;
        case 'codeplease':
            joinCode = '';
            showJoinUI = true;
            updateDisplay(1);
            break;
        case 'lobby':
            lobbyName = message.data;
            updateDisplay(1);
            break;
        case 'host':
            showHostUI = true;
            updateDisplay(1);
            break;
        case 'turn':
            this.boards.forEach(b => {
                b.turn = (b.id == message.data.id);
                if (b.turn) {
                    b.timerEnd = message.data.timerEnd;
                }
            });
            updateDisplay(1);
            break;
        case 'factories':
            if (message.data.count != factories.length) {
                factories = [];
                for(var i = 0; i < message.data.count; i++) {
                    factories.push({});
                };
            }
            updateDisplay(1);
            break;
        case 'tiles': 
            var newTiles = [];
            for (var i = 0; i < message.data.tiles.length; i++) {
                var tileUpdate = message.data.tiles[i];
                var existingTile = tiles.filter(t => t.id == tileUpdate.id)[0];

                var delay = 0;
                var transitionTime = 750 + (Math.random() * 750);
                var newPosition = null;
                // calculate position
                switch (tileUpdate.position.type) {
                    case 'factory':
                        newPosition = factories[tileUpdate.position.factoryid];
                        break;
                    case 'middle':
                        newPosition = middle;
                        break;
                    case 'lid':
                        newPosition = lid;
                        break;
                    case 'bag':
                        newPosition = bag;
                        break;
                    case 'pattern':
                        var board = boards.filter(b => b.id == tileUpdate.position.playerId)[0];
                        if (tileUpdate.position.subposition == 'pattern') {
                            newPosition = board.pattern[tileUpdate.position.y][tileUpdate.position.x];
                        } else {
                            newPosition = board.floor[tileUpdate.position.x];
                        }
                        break;
                    case 'grid':
                        var board = boards.filter(b => b.id == tileUpdate.position.playerId)[0];
                        newPosition = board.grid[tileUpdate.position.y][tileUpdate.position.x];
                        delay = tileUpdate.position.y * 500;
                        transitionTime = 750;
                        break;
                }

                var newTile = {
                    id: tileUpdate.id,
                    colour: tileUpdate.colour,
                    position: newPosition
                }
                if (!existingTile) {
                    newTiles.push(newTile);
                } else {
                    if (newTile.position != existingTile.position || existingTile.position == middle) {
                        if (existingTile.position == middle) {
                            if (newTile.position != middle) {
                                delete middleClaims[existingTile.id];
                            }
                            newTile.oldposition = { display: existingTile.display };
                        } else {
                            newTile.oldposition = existingTile.position;
                        }
                        newTile.startTime = (Date.now() + delay);
                        newTile.transitionTime = transitionTime;
                        newTile.r1 = Math.random();
                        newTile.r2 = Math.random();
                        newTiles.push(newTile);
                    } else {
                        newTiles.push(existingTile);
                    }
                }
            }
            tiles = newTiles;
            round = message.data.round;
            updateDisplay(1, Date.now() + 2800);
            break;
        case 'playerlist':
            boards = message.data.players.map(p => NewBoard(p.id, p.name, p.score));
            updateDisplay(1);
            break;
        case 'playerid':
            playerId = message.data;
            updateDisplay(1);
            break;
    }
}


var canvas = document.getElementById('canvas');
var gl = canvas.getContext('webgl');
var canvasDimensions = canvas.getBoundingClientRect();


var vsSource = `
    attribute vec3 aVertexPosition;
    attribute vec2 aTexcoord;
    attribute vec3 aRecolor;

    uniform vec3 uResolution;

    varying vec2 vTexcoord;
    varying vec3 vRecolor;
    
    void main() {
        vec3 zeroToOne = aVertexPosition / uResolution;
        vec3 zeroToTwo = zeroToOne * 2.0;
        vec3 clipSpace = zeroToTwo - 1.0;

        gl_Position = vec4(clipSpace, 1);

        vTexcoord = aTexcoord;
        vRecolor = aRecolor;
    }`;

var fsSource = `
    precision mediump float;

    varying vec2 vTexcoord;
    varying vec3 vRecolor;

    uniform sampler2D uTexture;

    void main() {
        vec4 color = texture2D(uTexture, vTexcoord);
        if (color.r == 0.0 && color.g == 0.0 && color.b == 0.0) {
            color.r = vRecolor.r;
            color.g = vRecolor.g;
            color.b = vRecolor.b;
        }

        if (color.a < 0.01) {
            discard;
        }

        gl_FragColor = color;
    }
`;

function initShaderProgram(gl, vs, fs) {
    var vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vs);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(vertexShader));
    }
    var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fs);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(fragmentShader));
    }
    var shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    }
    return shaderProgram;
}

var shaderProgram = initShaderProgram(gl, vsSource, fsSource);

var programInfo = {
    program: shaderProgram,
    attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        texturePosition: gl.getAttribLocation(shaderProgram, 'aTexcoord'),
        recolorData: gl.getAttribLocation(shaderProgram, 'aRecolor')
    },
    uniformLocations: {
        resolution: gl.getUniformLocation(shaderProgram, 'uResolution')
    }
}

function loadTexture(src, d, noblur)  {
    var texture = gl.createTexture();
     
    // Asynchronously load an image
    var image = new Image();
    image.src = resourceaddress+src;
    image.crossOrigin = 'anonymous';
    image.addEventListener('load', function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,  gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, noblur ? gl.NEAREST : gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, noblur ? gl.NEAREST : gl.LINEAR);
    });

    return { 
        texture: texture,
        image: image,
        dim: d
    };
}

var positionBuffer = gl.createBuffer();
var texturePositionBuffer = gl.createBuffer();
var colourBuffer = gl.createBuffer();

function drawScene(gl, programInfo, calls) {
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0.36, 0.64, 1.0, 1.0);
    gl.clearDepth(1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);
    gl.uniform3f(programInfo.uniformLocations.resolution, gl.canvas.width, gl.canvas.height, 1);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for (var k in calls) {
        var drawCalls = calls[k];

        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        var positions = [];
        function calculatePosition(x, y, w, h, z, angle) {
            y = canvas.height - y;
            z = z || 0.5;

            var sine = Math.sin(angle);
            var cosine = Math.cos(angle);
            // offset vectors
            var w2 = -w/2; var h2 = h/2;
            var v0 = {
                x: cosine*w2 + sine*h2, y: cosine*h2 - sine*w2
            };
            w2 = w/2; h2 = h/2;
            var v1 = {
                x: cosine*w2 + sine*h2, y: cosine*h2 - sine*w2
            }
            w2 = w/2; h2 = -h/2;
            var v2 = {
                x: cosine*w2 + sine*h2, y: cosine*h2 - sine*w2
            }
            w2 = -w/2; h2 = -h/2;
            var v3 = {
                x: cosine*w2 + sine*h2, y: cosine*h2 - sine*w2
            }

            positions.push(
                x+v0.x, y+v0.y, z,
                x+v1.x, y+v1.y, z,
                x+v2.x, y+v2.y, z,

                x+v0.x, y+v0.y, z,
                x+v3.x, y+v3.y, z,
                x+v2.x, y+v2.y, z
            );
        }
        drawCalls.forEach(dc => {
            calculatePosition(dc[4], dc[5], dc[6], dc[7], dc[8], dc[9]);
        });
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    
        // bind the texture
        gl.bindTexture(gl.TEXTURE_2D, graphics[k].texture);
    
        gl.enableVertexAttribArray(programInfo.attribLocations.texturePosition);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, texturePositionBuffer);
        var textureData = new Array(drawCalls.length * 12);
        for(var index = 0; index < drawCalls.length; index++) {
            var dc = drawCalls[index];
            var x = dc[0];
            var y = dc[1];
            var w = dc[2];
            var h = dc[3];
            var image = graphics[k].image;
            var i = index * 12;
            var width = image.width;
            var height = image.height;
            var sx = x / width;
            var sy = y / height;
            var ex = (x+w) / width;
            var ey = (y+h) / height;
            textureData[i] = sx;
            textureData[i+1] = sy;

            textureData[i+2] = ex;
            textureData[i+3] = sy;

            textureData[i+4] = ex;
            textureData[i+5] = ey;

            textureData[i+6] = sx;
            textureData[i+7] = sy;

            textureData[i+8] = sx;
            textureData[i+9] = ey;

            textureData[i+10] = ex;
            textureData[i+11] = ey;
        }
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(textureData),
            gl.STATIC_DRAW);
        gl.vertexAttribPointer(programInfo.attribLocations.texturePosition, 2, gl.FLOAT, false, 0, 0);
    
        gl.enableVertexAttribArray(programInfo.attribLocations.recolorData);
        gl.bindBuffer(gl.ARRAY_BUFFER, colourBuffer);
        var colors = [];
        drawCalls.forEach(dc => {
            var r = 0;
            var g = 0;
            var b = 0;
            switch (dc[10]) {
                case 'red':
                    r = 1;
                    break;
                case 'green':
                    g = 1;
                    break;
                case 'playerturn':
                    r = 0;
                    g = 1;
                    b = 0;
                    break;
                case 'grey':
                    r = 0.5;
                    g = 0.5;
                    b = 0.5;
                    break;
            }
            colors.push(r, g, b);
            colors.push(r, g, b);
            colors.push(r, g, b);
            colors.push(r, g, b);
            colors.push(r, g, b);
            colors.push(r, g, b);
        });
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array(colors),
            gl.STATIC_DRAW);
        gl.vertexAttribPointer(programInfo.attribLocations.recolorData, 3, gl.FLOAT, false, 0, 0);

        var count = textureData.length / 2;
        gl.drawArrays(gl.TRIANGLES, 0, count);
    }
}

var audioCtx = new window.AudioContext();

var soundOn = false;

async function loadAudio(src, val) {
    const response = await fetch(resourceaddress+src);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    val.sound = audioBuffer;
}

var sounds = [
    'clack.ogg',
    'clack2.ogg'
].reduce((a, c) => {
    var val = {};
    a[c] = val;
    loadAudio(c, val);
    return a;
}, {});

function playTrack(name) {
    if (!soundOn) {
        return;
    }
    const trackSource = audioCtx.createBufferSource();
    if (sounds[name].sound) {
        trackSource.buffer = sounds[name].sound;
        trackSource.connect(audioCtx.destination);
        trackSource.start();
    }
}

var lastTimestamp = 0;
var playerId = '';
var turn = false;

var COLOURS = [
    [2, 3, 4, 0, 1],
    [1, 2, 3, 4, 0],
    [0, 1, 2, 3, 4],
    [4, 0, 1, 2, 3],
    [3, 4, 0, 1, 2]
];

var COLORMAP = [
    'black', 'teal', 'blue', 'orange', 'red'
];

function NewBoard(id, name, score) {
    return {
        id: id,
        name: name,
        score: score || 0,
        pattern: [
            [{}],
            [{},{}],
            [{},{},{}],
            [{},{},{},{}],
            [{},{},{},{},{}]
        ],
        grid: [
            [{},{},{},{},{}],
            [{},{},{},{},{}],
            [{},{},{},{},{}],
            [{},{},{},{},{}],
            [{},{},{},{},{}]
        ],
        floor: [{},{},{},{},{},{},{}]
    }
}

var factories = [];
var boards = [];
var tiles = [];
var round = 0;
var middle = {};
var middleClaims = {};
var lid = {};
var bag = {};
var framesToAnimate = 0;
var animateUntil = Date.now();
var stoppedRendering = false;

function updateDisplay(x, optionalTime) {
    framesToAnimate += x;
    if (optionalTime) {
        animateUntil = optionalTime;
    }
    if (stoppedRendering) {
        stoppedRendering = false;
        window.requestAnimationFrame(render);
    }
}

function render(timestamp) {
    var now = Date.now();
    var delta = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    var fractionOfSecond = (timestamp % 1000) / 1000;

    var calls = {};

    function draw(sheet, sx, sy, sw, sh, dx, dy, dw, dh, angle, z, color) {
        calls[sheet] = calls[sheet] || [];
        calls[sheet].push([sx, sy, sw, sh, dx, dy, dw, dh, z, angle, color]);
    }

    function drawSprite(sheet, fx, fy, dx, dy, w, h, angle, z, color) {
        var dim = graphics[sheet].dim
        var sx = fx*dim;
        var sy = fy*dim;
        draw(sheet, sx, sy, dim, dim, dx, dy, w, h, angle, z, color);
    }

    function drawText(x, y, w, maxWidth, text, z, drawCursor, highlight) {
        var position = 0;
        var line = 0;
        for(var i = 0; i < text.length; i++) {
            if (text[i] == '\n') {
                position = 0;
                line++;
                continue;
            }
            if (w*position > maxWidth) {
                position = 0;
                line++;
            }
            var charCode = text.charCodeAt(i);
            var spriteX;
            var spriteY;
            var valid = false;
            //a-z = 97-122
            if (charCode >= 97 && charCode <= 122) {
                var azIndex = charCode-97;
                spriteX = azIndex % 16;
                spriteY = 2+Math.floor(azIndex / 16);
                valid = true;
            }
            //A-Z = 65-90
            if (charCode >= 65 && charCode <= 90) {
                var azIndex = charCode-65;
                spriteX = azIndex % 16;
                spriteY = Math.floor(azIndex / 16);
                valid = true;
            }
            //0-9 = 48-57
            if (charCode >= 48 && charCode <= 57) {
                var azIndex = charCode-48;
                spriteX = azIndex;
                spriteY = 4;
                valid = true;
            }
            if (charCode == 45) {
                spriteX = 3;
                spriteY = 5;
                valid = true;
            }
            if (charCode == 47) {
                spriteX = 1;
                spriteY = 5;
                valid = true;
            }
            if (charCode == 58) {
                spriteX = 2;
                spriteY = 5;
                valid = true;
            }
            if (valid) {
                drawSprite('font2', spriteX, spriteY, x+(position*w), y+(line*w), w, w, 0, z || 0.35, highlight || 'black');
            }
            position++;
        }
        if (drawCursor) {
            drawSprite('font2', 4, 5, x+((position)*w), y+(line*w), w, w, 0, z || 0.35);
        }
    }

    function drawPrompt(x, y, width, height, elements) {
        var unit = height / (2*(1+elements.length));
        var tilesWide = Math.ceil(width/unit);
        
        drawSprite('ui', 0, 0, x, y, unit, unit, 0, 0.2);
        for(var c = 1; c < tilesWide; c++) {
            drawSprite('ui', 1, 0, x+(c*unit), y, unit, unit, 0, 0.2);
        }
        drawSprite('ui', 2, 0, x+(tilesWide*unit), y, unit, unit, 0, 0.2);

        elements.forEach((e, i) => {
            var yval1 = y + (((2*i)+1)*unit);
            var yval2 = y + (((2*i)+2)*unit);

            var text = e.text;
            var type = e.type;
            var cb = e.cb;
            var textunit = width / text.length;

            drawSprite('ui', 0, 1, x, yval1, unit, unit, 0, 0.2);
            for(var c = 1; c < tilesWide; c++) {
                drawSprite('ui', 1, 1, x+(c*unit), yval1, unit, unit, 0, 0.2);
            }
            drawSprite('ui', 2, 1, x+(tilesWide*unit), yval1, unit, unit, 0, 0.2);

            // draw text here
            drawText(x+unit, yval1, textunit, width, text, 0.15, false);

            if (type == 'text') {
                drawSprite('ui', 0, 2, x, yval2, unit, unit, 0, 0.2);
                for(var c = 1; c < tilesWide; c++) {
                    drawSprite('ui', 1, 2, x+(c*unit), yval2, unit, unit, 0, 0.2);
                }
                drawSprite('ui', 2, 2, x+(tilesWide*unit), yval2, unit, unit, 0, 0.2);

                // draw input here
                drawText(x+unit, yval2, textunit, width, cb(), 0.15, fractionOfSecond < 0.5);
                if (framesToAnimate < 1) {
                    framesToAnimate++;
                }
            }

            if (type == 'button') {
                drawSprite('ui', 0, 3, x, yval2, unit, unit, 0, 0.2);
                for(var c = 1; c < tilesWide; c++) {
                    drawSprite('ui', 1, 3, x+(c*unit), yval2, unit, unit, 0, 0.2);
                }
                drawSprite('ui', 2, 3, x+(tilesWide*unit), yval2, unit, unit, 0, 0.2);

                drawText(x+unit, yval2, textunit, width, e.buttonText, 0.15);

                cb(x, yval2, tilesWide*unit, unit, unit);
            }
        });


        var yvalBottom = y+ (((elements.length*2)+1)*unit);

        drawSprite('ui', 0, 4, x, yvalBottom, unit, unit, 0, 0.2);
        for(var c = 1; c < tilesWide; c++) {
            drawSprite('ui', 1, 4, x+(c*unit), yvalBottom, unit, unit, 0, 0.2);
        }
        drawSprite('ui', 2, 4, x+(tilesWide*unit), yvalBottom, unit, unit, 0, 0.2);
    }

    function computeTilePositions(tiles) {
        function extractDisplayValue(position, id) {
            if (position.display.claim) {
                var claimed = position.display.claim(id);
                return claimed;
            } else {
                return position.display;
            }
        }

        tiles.forEach(t => {
            if (t.position.display != null) {
                if (t.oldposition && t.oldposition.display && t.startTime && t.r1 && t.r2) {
                    // lerp between origin and destination
                    var lerp = Math.max(Math.min(1, (now - t.startTime) / t.transitionTime), 0);
    
                    var from = extractDisplayValue(t.oldposition, t.id);
                    var to = extractDisplayValue(t.position, t.id);

                    if (lerp == 1 || (from.x == to.x && from.y == to.y)) {
                        if (lerp == 1) {
                            if (t.position != middle && t.position != lid && t.position && bag) {
                                if (Math.random() < 0.5) {
                                    playTrack('clack.ogg');
                                } else {
                                    playTrack('clack2.ogg');
                                }
                            }
                        }

                        t.oldposition = null;
                        t.startTime = null;
                        t.r1 = null;
                        t.r2 = null;
    
                        t.display = to;
                    } else {
                        var xy = bezier({ from: from, to: to, r1: t.r1, r2: t.r2 }, lerp);
        
                        var size = (from.w * (1-lerp)) + (to.w * (lerp));
        
                        var angle = ((1 - lerp) * ((from.a || 0) % (Math.PI/2))) + (lerp * ((to.a || 0) % (Math.PI/2)));

                        t.display = { x: xy.x, y: xy.y, a: angle + lerp*Math.PI*Math.floor(t.r1*6), w: size, moving: true }
                    }
                } else {
                    if (t.position) {
                        t.display = extractDisplayValue(t.position, t.id);
                    }
                }
            }
        });
    }

    function computeBoardPositions(left, top, width, height, board) {
        var widthDiff = 0;
        if (height*1.6 < width) {
            widthDiff = width - 1.6*height;
            width = 1.6*height;
        }
        left += (widthDiff/1.6); // if we need to shrink the width we must shuffle in

        // calculate pattern positions
        var unit = width/10;
        top += (unit/2);
        left += (unit/2);

        for (var y = 0; y < 5; y++) {
            for (var x = 0; x < y+1; x++) {
                board.pattern[y][x].display = { x: left + (4-x)*unit, y: top + y*unit, w: unit*0.8 };
            }
        }

        // calculate grid positions
        for (var y = 0; y < 5; y++) {
            for (var x = 0; x < 5; x++) {
                board.grid[y][x].display = { x: left + ((5+x)*unit), y: top + y*unit, w: unit*0.8 };
            }
        }

        // calculate floor positions
        for (var x = 0; x < 7; x++) {
            board.floor[x].display = { x: left + (x*unit), y: top + 5*unit, w: unit*0.8 };
        }

        // calculate text positions
        // score
        // name
        board.display = {
            name: {
                x: left,
                y: top,
                w: unit*0.5
            },
            score: {
                x: left + width - 3*unit,
                y: top + unit*5,
                w: unit*0.8
            },
            timer: {
                x: left,
                y: top + unit,
                w: unit*0.5
            }
        }

    }

    function computeLidAndBagPositions() {
        lid.display = { x: -100, y: -100, w: canvas.width/50 };
        bag.display = { x: canvas.width + 100, y: -100, w: canvas.width/50 };
    }

    function computeFactoryPositions(left, top, width, height, factories) {
        var widthDiff = 0;
        if (height < width) {
            widthDiff = width - height;
            width = height;
        }
        left += (widthDiff/2);
        // determine factory size
        var numberOfFactories = factories.length;
        var angleBetween = Math.PI*2/numberOfFactories;

        var maxRadiusOfFactory = 0.7*(width*Math.PI) / (Math.pow(2*numberOfFactories, 0.9) + (2*Math.PI));
        var distanceFromCenter = (width/2) - maxRadiusOfFactory;
        var center = { x: left+(width/2), y: top+(width/2), w: Math.max(distanceFromCenter-maxRadiusOfFactory, 1) };

        // generate mid tiles display

        middle.display = { x: center.x, y: center.y, w: center.w, claimable: [] };

        var unit = maxRadiusOfFactory/2;

        for(var i = 0; i < 50; i++) {
            if (i < 3) {
                var angle = (2 * Math.PI * i) / 3 ;
                var distance = unit/1.4;

                middle.display.claimable.push({
                    x: center.x+(Math.sin(angle)*distance),
                    y: center.y+(Math.cos(angle)*distance),
                    w: unit,
                    a: round+0.5+i
                });
            } else {
                if (i < 9) {
                    var angle = (2 * Math.PI * (i-3)) / 6;
                    var distance = 2*unit;
    
                    middle.display.claimable.push({
                        x: center.x+(Math.sin(angle)*distance),
                        y: center.y+(Math.cos(angle)*distance),
                        w: unit,
                        a: round+0.5+i
                    });
                } else {
                    var angle = (2 * Math.PI * (i-9)) / 12;
                    var distance = 3*unit;
    
                    middle.display.claimable.push({
                        x: center.x+(Math.sin(angle)*distance),
                        y: center.y+(Math.cos(angle)*distance),
                        w: unit,
                        a: round+0.5+i
                    });
                }
            }
        }

        middle.display.claim = function(id) {
            var needsClaim = !middleClaims[id];
            if (!needsClaim) {
                var claimIndex = middleClaims[id];
                if (claimIndex > 1.5 * Object.keys(middleClaims).length && claimIndex > 5) {
                    // delete existing claim and find new one
                    delete middleClaims[id];
                    needsClaim = true;
                }
            } 
            if (needsClaim) {
                // find the lowest unclaimed value
                var claimedValues = Object.values(middleClaims);
                for(var i = 1; i < 50; i++) {
                    if (!claimedValues.includes(i)) {
                        middleClaims[id] = i;
                        break;
                    }
                }
            }
            return this.claimable[middleClaims[id]-1];
        }

        var factoryAngle = 0;
        for(var f = 0; f < numberOfFactories; f++) {
            var fx = center.x + (Math.sin(factoryAngle) * distanceFromCenter);
            var fy = center.y + (Math.cos(factoryAngle) * distanceFromCenter);

            factories[f].display = { x: fx, y: fy, w: 1.8*maxRadiusOfFactory, a: 1+f, claimable: [] };

            var tileAngle = 0;
            for (var t = 0; t < 4; t++) {
                var tx = fx + (Math.sin(tileAngle) * maxRadiusOfFactory * 0.5);
                var ty = fy + (Math.cos(tileAngle) * maxRadiusOfFactory * 0.5);
                var sizeOfTile = maxRadiusOfFactory / 2;

                factories[f].display.claimable.push({
                    x: tx,
                    y: ty,
                    w: sizeOfTile,
                    a: 1+round+t+f
                });

                tileAngle += Math.PI*0.5;
            }

            factories[f].display.claim = function() {
                return this.claimable.shift();
            }

            factoryAngle += angleBetween;
        }

    }

    // calculate display based on canvas resolution;

    var playerCount = boards.length;
    var playerTileSize = canvas.width * 0.08;

    if (canvas.width < canvas.height) {
        // vert layout
        // X X
        // X X (optional)
        //  F
        //  B
        var oppositionBoardWidth = canvas.width/2;
        var oppositionBoardHeight = playerCount > 3 ? canvas.height / 6 : canvas.height / 4;
        var remainingHeight = canvas.height - (oppositionBoardHeight * (playerCount > 3 ? 2 : 1));
        var factoryHeight = remainingHeight * 0.6;
        var factoryWidth = canvas.width;
        var playerBoardHeight = remainingHeight * 0.4;
        var playerBoardWidth = canvas.width;

        computeFactoryPositions(0, canvas.height - remainingHeight, factoryWidth, factoryHeight, factories);

        if (boards.length && playerId != '') {
            var playerPosition = boards.findIndex(b => b.id == playerId);
            var numberOfOpponents = boards.length - 1;
            var leftSideCount = Math.ceil(numberOfOpponents/2);
            computeBoardPositions(0, canvas.height - playerBoardHeight, playerBoardWidth, playerBoardHeight, boards[playerPosition]);
            playerTileSize = boards[playerPosition].display.score.w;

            var iter = 0;
            for(var bi = (playerPosition+1) % boards.length; bi != playerPosition; bi = ((bi+1) % boards.length)) {
                var xpos = 0;
                var ypos = 0;
                if (iter >= leftSideCount) {
                    // right
                    xpos = 1;
                    ypos = iter - leftSideCount;
                } else {
                    // left
                    ypos = leftSideCount - (1+iter);
                }
                computeBoardPositions(xpos*oppositionBoardWidth, ypos*oppositionBoardHeight, oppositionBoardWidth, oppositionBoardHeight, boards[bi]);
                iter++;
            }
        }
        
    } else {
        // hori layout
        // X F X
        // X F X
        //   B
        var oppositionBoardWidth = canvas.width / 4;
        var oppositionBoardHeight = playerCount > 3 ? canvas.height / 4 : canvas.height / 2;
        var factoryHeight = canvas.height * 0.6;
        var factoryWidth = canvas.width / 2;
        var playerBoardHeight = canvas.height*0.4;
        var playerBoardWidth = canvas.width;

        computeFactoryPositions(oppositionBoardWidth, 0, factoryWidth, factoryHeight, factories);

        if (boards.length && playerId != '') {
            var playerPosition = boards.findIndex(b => b.id == playerId);
            var numberOfOpponents = boards.length - 1;
            var leftSideCount = Math.ceil(numberOfOpponents/2);
            computeBoardPositions(0, canvas.height - playerBoardHeight, playerBoardWidth, playerBoardHeight, boards[playerPosition]);
            playerTileSize = boards[playerPosition].display.score.w;

            var iter = 0;
            for(var bi = (playerPosition+1) % boards.length; bi != playerPosition; bi = ((bi+1) % boards.length)) {
                var xpos = 0;
                var ypos = 0;
                if (iter >= leftSideCount) {
                    // right
                    xpos = 1;
                    ypos = iter - leftSideCount;
                } else {
                    // left
                    ypos = leftSideCount - (1+iter);
                }
                computeBoardPositions(xpos*(oppositionBoardWidth+factoryWidth), ypos*oppositionBoardHeight, oppositionBoardWidth, oppositionBoardHeight, boards[bi]);
                iter++;
            }
        }
    }

    computeLidAndBagPositions();

    computeTilePositions(tiles);

    factories.forEach(f => {
        drawSprite('factory', 0, 0, f.display.x, f.display.y, f.display.w, f.display.w, f.display.a, 0.6);
    });

    if (boards.length && playerId != '') {
        boards.forEach(b => {
            b.pattern.forEach(pr => pr.forEach(pc => {
                drawSprite('highlight', 0, 0, pc.display.x, pc.display.y, pc.display.w, pc.display.w, 0, 0.5, 'grey');
            }));
            b.grid.forEach((gr, gri) => gr.forEach((gc, gci) => {
                drawSprite('places', COLOURS[gri][gci], 0, gc.display.x, gc.display.y, gc.display.w, gc.display.w, 0, 0.5);
            }));
            b.floor.forEach((f, fi) => {
                drawSprite('highlight', 0, 0, f.display.x, f.display.y, f.display.w, f.display.w, 0, 0.55, 'red');
                if (b.id == playerId) {
                    var text = '-3';
                    if (fi < 4) {
                        text = '-2';
                        if (fi < 2) {
                            text = '-1';
                        }
                    }
                    drawText(f.display.x - (f.display.w/6), f.display.y, f.display.w/3, f.display.w, text, 0.55, false, 'red');
                }
            });
            // name
            drawText(b.display.name.x, b.display.name.y, b.display.name.w, b.display.name.w*8, b.name, 0.3, false, b.turn ? 'playerturn' : null);
            // score
            drawText(b.display.score.x, b.display.score.y, b.display.score.w, b.display.name.w*8, ''+b.score, 0.3, false);
            if (b.turn && b.timerEnd > Date.now()) {
                // timer
                drawText(b.display.timer.x, b.display.timer.y, b.display.timer.w, b.display.timer.w*8, ''+Math.ceil((b.timerEnd - serverTime()) / 1000), 0.3, false);
            }
        });
    }


    // process cursorPosition
    var highlightedPosition = null;
    var highlightedColour = null;
    tiles.forEach(t => {
        if (t.display && (factories.includes(t.position) || t.position == middle) && t.colour != 5) {
            if (tileClicked) {
                highlightedPosition = tileClicked.position;
                highlightedColour = tileClicked.colour;
            } else {
                if (Math.hypot(t.display.x - cursorX, t.display.y - cursorY) < (t.display.w*0.7)) {
                    highlightedPosition = t.position;
                    highlightedColour = t.colour;
                }
            }
        }
    });

    var playerBoard = boards.filter(b => b.id == playerId)[0];
    if (tileClicked) {
        playerBoard.pattern.forEach(p => {
            if (p.filter(pt => {
                return Math.hypot(pt.display.x - cursorX, pt.display.y - cursorY) < (pt.display.w*0.7);
            }).length > 0) {
                p.forEach(pt => {
                    drawSprite('highlight', 0, 0, pt.display.x, pt.display.y, pt.display.w, pt.display.w, 0, 0.45, 'green');
                });
            }
        });

        if(playerBoard.floor.filter(f => {
            return Math.hypot(f.display.x - cursorX, f.display.y - cursorY) < (f.display.w*0.7);
            }).length > 0) 
            {
                playerBoard.floor.forEach(f => {
                    drawSprite('highlight', 0, 0, f.display.x, f.display.y, f.display.w, f.display.w, 0, 0.45, 'green');
                });
        }
    }


    // process most recent click
    var click = clicks.pop();
    clicks = [];
    if(click) {
        // check where click is

        var sentCommand = false;
        if (tileClicked) {
            // check for destination click, if so then send command otherwise
            var playerBoard = boards.filter(b => b.id == playerId)[0];
            playerBoard.pattern.forEach((p, pi) => {
                p.forEach(pt => {
                    if(!sentCommand && Math.hypot(pt.display.x - click.x, pt.display.y - click.y) < (pt.display.w*0.7)) {
                        // send a command
                        // determine factory
                        var factory = -1;
                        for(var i = 0; i < factories.length; i++) {
                            if (factories[i] == tileClicked.position) {
                                factory = i;
                            }
                        }

                        sendMessage({
                            type: 'command',
                            data: {
                                colour: COLORMAP[tileClicked.colour],
                                zone: factory,
                                destination: pi
                            }
                        });
                        sentCommand = true;
                        tileClicked = null;
                    }
                })
            });

            if (!sentCommand) {
                // check if floor row
                if(playerBoard.floor.filter(f => {
                    return Math.hypot(f.display.x - click.x, f.display.y - click.y) < (f.display.w*0.7);
                    }).length > 0) {
                        // send a command
                        // determine factory
                        var factory = -1;
                        for(var i = 0; i < factories.length; i++) {
                            if (factories[i] == tileClicked.position) {
                                factory = i;
                            }
                        }

                        sendMessage({
                            type: 'command',
                            data: {
                                colour: COLORMAP[tileClicked.colour],
                                zone: factory,
                                destination: -1
                            }
                        });
                        sentCommand = true;
                        tileClicked = null;
                    }
            }
        }

        if (!sentCommand) {
            tileClicked = null;
            tiles.forEach(t => {
                if ((factories.includes(t.position) || t.position == middle) && t.colour != 5) {
                    if(Math.hypot(t.display.x - click.x, t.display.y - click.y) < (t.display.w*0.7)) {
                        tileClicked = t;
                    }
                }
            });
        }
    }

    tiles.forEach(t => {
        if (t.display) {
            drawSprite('tiles', t.colour, 0, t.display.x, t.display.y, t.display.w, t.display.w, t.display.a || 0, !!t.display.moving ? 0.49 : 0.5);

            if (t.position == highlightedPosition && t.colour == highlightedColour) {
                drawSprite('highlight', 0, 0, t.display.x, t.display.y, t.display.w, t.display.w, t.display.a || 0, 0.45, 'green');
            }
        }
    });

    // draw chat
    chatlog = chatlog.filter(c => c.age > (Date.now() - 15000));

    var top = canvas.height/2;
    var unit = canvas.height/20;
    var j = 0;
    var allText = chatlog.filter((cl, i) => i >= Math.max(0, chatlog.length - 8)).reduce((a, c) => {
        return a + '\n' + c.message;
    }, '');

    drawText(unit, top + unit, unit*0.5, canvas.width/2, allText, 0.3);

    if (showChatbox) {
        drawText(unit, top + (9*unit), unit*0.8, canvas.width/2, ':' + chat, 0.3, fractionOfSecond < 0.5);
        if (framesToAnimate < 1) {
            framesToAnimate++;
        }
    }

    if (showNamebox) {
        drawPrompt(canvas.width/4, canvas.height/3, canvas.width/2, canvas.height/3, [{
            text: 'Please enter your name',
            type: 'text',
            cb: () => {
                return playerName;
            }
        }]);
    }

    if (showJoinUI) {
        drawPrompt(canvas.width/4, canvas.height/3, canvas.width/2, canvas.height/3, [{
            text: 'Please enter a game code',
            type: 'text',
            cb: () => {
                return joinCode;
            }
        }]);
    }

    if (showHostUI && !showMenuUI) {
        drawPrompt(canvas.width/4, canvas.height/3, canvas.width/2, canvas.height/3, [{
            text: 'Click to start',
            type: 'button',
            buttonText: 'Start',
            cb: (x, y, w, h, u) => {
                x -= u/2;
                y -= u/2;
                if (click && click.x > x && click.x < (x+w) && click.y > y && click.y < (y+h)) {
                    sendMessage({
                        type: 'start'
                    });
                    showHostUI = false;
                }
            }
        }]);
    }

    if (showMenuUI) {
        drawPrompt(canvas.width/4, canvas.height/8, canvas.width/2, 3*canvas.height/4, [
            {
                text: 'Leave the game?',
                type: 'button',
                buttonText: 'Leave',
                cb: (x, y, w, h, u) => {
                    x -= u/2;
                    y -= u/2;
                    if (click && click.x > x && click.x < (x+w) && click.y > y && click.y < (y+h)) {
                        sendMessage({
                            type: 'leave'
                        });
                        showMenuUI = false;
                        showHostUI = false;
                    }
                }
            },
            {
                text: 'Audio         ',
                type: 'button',
                buttonText: soundOn ? 'Mute' : 'Unmute',
                cb: (x, y, w, h, u) => {
                    x -= u/2;
                    y -= u/2;
                    if (click && click.x > x && click.x < (x+w) && click.y > y && click.y < (y+h)) {
                        soundOn = !soundOn;
                    }
                }
            },
            {
                text: 'Close the menu ',
                type: 'button',
                buttonText: 'Close',
                cb: (x, y, w, h, u) => {
                    x -= u/2;
                    y -= u/2;
                    if (click && click.x > x && click.x < (x+w) && click.y > y && click.y < (y+h)) {
                        showMenuUI = false;
                    }
                }
            }
        ])
    }

    if (lobbyName) {
        // put in top right
        drawText(canvas.width - (lobbyName.length * 11), 11, 11, lobbyName.length*11, lobbyName, 0.2);

        // put menu somewhere
        var x = canvas.width - playerTileSize;
        var y = canvas.height - playerTileSize;
        drawSprite('ui', 0, 5, x, y, playerTileSize, playerTileSize, 0, 0.2);
        if(click && Math.hypot(x - click.x, y - click.y) < (playerTileSize*0.7)) {
            showMenuUI = !showMenuUI;
        }
    }

    drawScene(gl, programInfo, calls);

    if(framesToAnimate > 0 || animateUntil > now) {
        if (framesToAnimate > 0) {
            framesToAnimate--;
        }
        window.requestAnimationFrame(render);
    } else {
        stoppedRendering = true;
    }
}

canvas.width = Math.floor(canvasDimensions.width);
canvas.height = Math.floor(canvasDimensions.height);

window.addEventListener('resize', (e) => {
    var canvasDimensions = canvas.getBoundingClientRect();
    canvas.width = Math.floor(canvasDimensions.width);
    canvas.height = Math.floor(canvasDimensions.height);
    updateDisplay(1);
});

var cursorX = 256;
var cursorY = 256;
var clicks = [];

var tileClicked = null;

var graphics = [
    { n : 'tiles.png', d: 88 },
    { n : 'places.png', d: 88 },
    { n: 'factory.png', d: 200 },
    { n: 'highlight.png', d: 88, noblur: true },
    { n: 'font2.png', d: 10, noblur: true },
    { n: 'ui.png', d: 32, noblur: true }
].reduce((a, c) => {
    var name = c.n.split('.')[0];
    a[name] = loadTexture(c.n, c.d, c.noblur);
    return a;
}, {});

var showChatbox = false;
var showNamebox = false;
var showJoinUI = false;
var showHostUI = false;
var showMenuUI = false;
var chat = '';
var playerName = '';
var joinCode = '';

function updateCursorPosition(e) {
    cursorX = e.x;
    cursorY = e.y;
    updateDisplay(1);
}

function triggerAudio() {
    if (audioCtx.state == 'suspended') {
        audioCtx.resume();
    }
}

function mouseDown(e) {
    if (e.button == 0) {
        //select
        clicks.push({ x: e.x, y: e.y });
    }
    triggerAudio();
    updateDisplay(2);
}

function touchDown(e) {
    if (showNamebox) {
        playerName = prompt('Enter your name');
        sendMessage({
            type: 'name',
            data: playerName
        });
        showNamebox = false;
        showJoinUI = true;
    } else {
        if (showJoinUI) {
            joinCode = prompt('Enter game code');
            sendMessage({
                type: 'join',
                data: joinCode
            });
            tiles = [];
            boards = [];
            factories = [];
            joinCode = '';
            showJoinUI = false;
        }
    }
    triggerAudio();
    updateDisplay(2);
}

function keyDown(e) {
    if (e.key == 'Enter' && !showNamebox && !showJoinUI) {
        showChatbox = !showChatbox;
        if (chat) {
            sendMessage({
                type: 'chat',
                data: chat
            });
            chat = '';
        }
    }
    if (e.key == 'Enter' && showNamebox && playerName != '') {
        sendMessage({
            type: 'name',
            data: playerName
        });
        showNamebox = false;
        showJoinUI = true;
    }
    if (e.key == 'Enter' && showJoinUI && joinCode != '') {
        sendMessage({
            type: 'join',
            data: joinCode
        });
        tiles = [];
        boards = [];
        factories = [];
        joinCode = '';
        showJoinUI = false;
    }
    if (showChatbox) {
        if (e.key == 'Backspace') {
            chat = chat.substring(0, chat.length - 1);
        }
        //num0a-z = 97-122
        //A-Z = 65-90
        //0-9 = 48-57
        if((e.keyCode >= 96 && e.keyCode <= 122) || (e.keyCode >= 65 && e.keyCode <= 90) || (e.keyCode >= 48 && e.keyCode <= 57) || e.key == '/' || e.key == ' ') {
            chat += e.key;
        }
    }
    if (showNamebox) {
        if (e.key == 'Backspace') {
            playerName = playerName.substring(0, playerName.length - 1);
        }
        //num0a-z = 97-122
        //A-Z = 65-90
        //0-9 = 48-57
        if((e.keyCode >= 96 && e.keyCode <= 122) || (e.keyCode >= 65 && e.keyCode <= 90) || (e.keyCode >= 48 && e.keyCode <= 57) || e.key == '/' || e.key == ' ') {
            playerName += e.key;
        }
    }
    if (showJoinUI) {
        if (e.key == 'Backspace') {
            joinCode = joinCode.substring(0, joinCode.length - 1);
        }
        //num0a-z = 97-122
        //A-Z = 65-90
        //0-9 = 48-57
        if((e.keyCode >= 96 && e.keyCode <= 122) || (e.keyCode >= 65 && e.keyCode <= 90) || (e.keyCode >= 48 && e.keyCode <= 57) || e.key == '/' || e.key == ' ') {
            joinCode += e.key;
        }
    }
    updateDisplay(1);
    return false;
}

document.addEventListener('pointermove', updateCursorPosition, false);
document.addEventListener('pointerdown', mouseDown, false);
document.addEventListener('touchstart', touchDown, false);
document.addEventListener('keydown', keyDown, false);

function beziern(arr, p) {
	var points = arr;
	
	function lerp(xy0, xy1, p) {
		return {
			x: (xy0.x*(1-p))+(xy1.x*p),
			y: (xy0.y*(1-p))+(xy1.y*p)
		}
	}

	while(points.length > 1) {
		var newPoints = [];
		for(var i = 0; i < points.length-1; i++) {
			newPoints.push(lerp(points[i], points[i+1], p));
		}
		points = newPoints;
	}

	
	return points[0];
}

function bezier(transition, p) {
	// project a point no more than len(x0x1, y0y1) from the middle of vec(x0x1, y0y1) at 90 degrees.
	
    var x0 = transition.from.x;
    var y0 = transition.from.y;
    var x1 = transition.to.x;
    var y1 = transition.to.y;

    var xm = (x0 + x1) / 2;
    var ym = (y0 + y1) / 2;
    
    var dx = y1 - y0;
    var dy = x0 - x1;
    
    var swing = 0.8;
    
    var mul = (swing*2*transition.r1) - swing;
    
    var midx = xm + (mul * dx);
    var midy = ym + (mul * dy);
    
    // select a random point near the destination
    
    var dist = 30;
    var angle = transition.r2 * 2 * Math.PI;
    
    var nearDestx = x1 + (Math.sin(angle) * dist);
    var nearDesty = y1 + (Math.cos(angle) * dist);

	return beziern([
         { x: x0, y: y0 },
         { x: midx, y: midy },
         { x: nearDestx, y: nearDesty },
         { x: x1, y: y1 }], 
         p);
}

setInterval(() => {
    sendMessage({
        type: 'ping'
    });
}, 20000);

setInterval(() => {
    updateDisplay(1);
}, 1000);