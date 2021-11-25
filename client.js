let socket = new WebSocket("ws://localhost:7777");

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
            message.data.forEach(m => {
                chatlog.push({ message: m, age: Date.now() });
            });
            break;
        case 'cookie':
            localStorage.setItem('azoline0.1', message.data.cookie);
            break;
        case 'lobby':
            lobbyName = message.data.lobbyName;
            break;
        case 'state':
            message.data;
            break;
        case 'start':
            playerId = message.data.playerId;
            boards = message.data.players.map(p => NewBoard(p.id, p.name, p.score));
            factories = message.data.factories;
            tiles = message.data.tiles.map(t => {
                return {
                    position: factories[t.factoryid],
                    colour: t.colour
                };
            });
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
        if (color.r > 0.24 && color.r < 0.26 && color.g > 0.24 && color.g < 0.26 && color.b > 0.24 && color.b < 0.26) {
            if (vRecolor.r == 0.0 && vRecolor.g == 0.0 && vRecolor.b == 0.0) {
                discard;
            }
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
};

function loadTexture(src, d, noblur)  {
    var texture = gl.createTexture();
     
    // Asynchronously load an image
    var image = new Image();
    image.src = 'http://localhost:8080/'+src;
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
        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
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

var lastTimestamp = 0;
var playerId = 2;

var COLOURS = [
    [2, 3, 4, 0, 1],
    [1, 2, 3, 4, 0],
    [0, 1, 2, 3, 4],
    [4, 0, 1, 2, 3],
    [3, 4, 0, 1, 2]
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

var factories = [{},{},{},{},{},{},{}];
var boards = [NewBoard(1, 'doug'),NewBoard(2, 'fred'),NewBoard(3, 'nancy'),NewBoard(4, 'ponce'),NewBoard(5, 'lily')];
var tiles = [{ colour: 2, position: factories[0] }, { colour: 4, position: factories[0] }, { colour: 2, position: factories[0] }, { colour: 3, position: factories[0] }];
var middle = {};

function render(timestamp) {
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

    function drawText(x, y, w, text, drawCursor) {
        var position = 0;
        for(var i = 0; i < text.length; i++) {
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
                drawSprite('font', spriteX, spriteY, x+(position*w), y, w, w, 0, 0.35);
            }
            position++;
        }
        if (drawCursor) {
            drawSprite('font', 4, 5, x+((position)*w), y, w, w, 0, 0.35);
        }
    }

    function computeTilePositions(tiles) {
        tiles.forEach(t => {
            if (t.transition) {
                // lerp between origin and destination
                var lerp = Math.max(1, (tile.startTime - timestamp) / 1000);

                var xy = bezier(tile.transition);

                var size = (tile.transition.from.w * (1-p)) + (tile.transition.to.w * (p));

                tile.display = { x: xy.x, y: xy.y, a: p*Math.PI*4, w: size }

                if (lerp == 1) {
                    tile.transition = null;
                }
            } else {
                if (t.position.display.tiles) {
                    t.display = t.position.display.tiles.pop();
                } else {
                    t.display = tile.position.display;
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
                w: unit*0.8
            },
            score: {
                x: left + width - 3*unit,
                y: top + unit*5,
                w: unit*0.8
            }
        }

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

        var maxRadiusOfFactory = (width*Math.PI) / ((2*numberOfFactories) + (2*Math.PI));
        var distanceFromCenter = (width/2) - maxRadiusOfFactory;
        var center = { x: left+(width/2), y: top+(width/2) };

        var factoryAngle = 0;
        for(var f = 0; f < numberOfFactories; f++) {
            var fx = center.x + (Math.sin(factoryAngle) * distanceFromCenter);
            var fy = center.y + (Math.cos(factoryAngle) * distanceFromCenter);

            factories[f].display = { x: fx, y: fy, w: 1.8*maxRadiusOfFactory, tiles: [] };

            var tileAngle = 0;
            for (var t = 0; t < 4; t++) {
                var tx = fx + (Math.sin(tileAngle) * maxRadiusOfFactory * 0.5);
                var ty = fy + (Math.cos(tileAngle) * maxRadiusOfFactory * 0.5);
                var sizeOfTile = maxRadiusOfFactory / 2;

                factories[f].display.tiles.push({
                    x: tx,
                    y: ty,
                    w: sizeOfTile
                });

                tileAngle += Math.PI*0.5;
            }

            factoryAngle += angleBetween;
        }

    }

    // calculate display based on canvas resolution;

    var playerCount = boards.length;

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

        var oppositionCount = 0;
        boards.forEach(b => {
            if (b.id == playerId) {
                computeBoardPositions(0, canvas.height - playerBoardHeight, playerBoardWidth, playerBoardHeight, b);
            } else {
                var xpos = oppositionCount % 2;
                var ypos = Math.floor(oppositionCount / 2);
                computeBoardPositions(xpos*oppositionBoardWidth, ypos*oppositionBoardHeight, oppositionBoardWidth, oppositionBoardHeight, b);

                oppositionCount++;
            }
        });

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

        var oppositionCount = 0;
        boards.forEach(b => {
            if (b.id == playerId) {
                computeBoardPositions(0, canvas.height - playerBoardHeight, playerBoardWidth, playerBoardHeight, b);
            } else {
                var xpos = oppositionCount % 2;
                var ypos = Math.floor(oppositionCount / 2);
                computeBoardPositions(xpos*(oppositionBoardWidth+factoryWidth), ypos*oppositionBoardHeight, oppositionBoardWidth, oppositionBoardHeight, b);

                oppositionCount++;
            }
        });
    }

    computeTilePositions(tiles);

    factories.forEach(f => {
        drawSprite('factory', 0, 0, f.display.x, f.display.y, f.display.w, f.display.w, 0, 0.6);
    });

    boards.forEach(b => {
        b.pattern.forEach(pr => pr.forEach(pc => {
            drawSprite('highlight', 0, 0, pc.display.x, pc.display.y, pc.display.w, pc.display.w, 0, 0.5, 'grey');
        }));
        b.grid.forEach((gr, gri) => gr.forEach((gc, gci) => {
            drawSprite('places', COLOURS[gri][gci], 0, gc.display.x, gc.display.y, gc.display.w, gc.display.w, 0, 0.5);
        }));
        b.floor.forEach((f, fi) => {
            drawSprite('highlight', 0, 0, f.display.x, f.display.y, f.display.w, f.display.w, 0, 0.55, 'red');
        });
        // draw text
        drawText(b.display.name.x, b.display.name.y, b.display.name.w, b.name, false);
        drawText(b.display.score.x, b.display.score.y, b.display.score.w, ''+b.score, false);
    });


    // process cursorPosition
    var highlightedPosition = null;
    var highlightedColour = null;
    tiles.forEach(t => {
        if (Math.hypot(t.display.x - cursorX, t.display.y - cursorY) < (t.display.w*0.7)) {
            highlightedPosition = t.position;
            highlightedColour = t.colour;
        }
    })

    // process most recent click
    var click = clicks.pop();
    clicks = [];
    if(click) {
        //tiles.forEach(t => )
    }

    tiles.forEach(t => {
        drawSprite('tiles', t.colour, 0, t.display.x, t.display.y, t.display.w, t.display.w, 0, 0.5);

        if (t.position == highlightedPosition && t.colour == highlightedColour) {
            drawSprite('highlight', 0, 0, t.display.x, t.display.y, t.display.w, t.display.w, 0, 0.45, 'green');
        }
    });

    // draw chat
    chatlog = chatlog.filter(c => c.age > (Date.now() - 15000));

    chatlog = [
        { message: 'a', age: Date.now() },
        { message: 'b', age: Date.now() },
        { message: 'c', age: Date.now() },
        { message: 'd', age: Date.now() },
        { message: 'e', age: Date.now() },
        { message: 'f', age: Date.now() },
        { message: 'g', age: Date.now() },
        { message: 'h', age: Date.now() },
        { message: 'i', age: Date.now() },
        { message: 'j', age: Date.now() },
        { message: 'k', age: Date.now() },
        { message: 'l', age: Date.now() },
        { message: 'm', age: Date.now() },
        { message: 'n', age: Date.now() },
];

    var top = canvas.height/2;
    var unit = canvas.height/20;
    var j = 0;
    for (var i = Math.max(0, chatlog.length - 8); i < chatlog.length; i++) {
        drawText(unit, top + unit + (j*unit), unit*0.8, chatlog[i].message);
        j++;
    }

    if (showChatbox) {
        console.log(fractionOfSecond);
        drawText(unit, top + (9*unit), unit*0.8, ':' + chat, fractionOfSecond < 0.5);
    }

    drawScene(gl, programInfo, calls);
    window.requestAnimationFrame(render);
}

canvas.width = Math.floor(canvasDimensions.width);
canvas.height = Math.floor(canvasDimensions.height);

window.addEventListener('resize', (e) => {
    var canvasDimensions = canvas.getBoundingClientRect();
    canvas.width = Math.floor(canvasDimensions.width);
    canvas.height = Math.floor(canvasDimensions.height);
});

var cursorX = 256;
var cursorY = 256;
var clicks = [];


var graphics = [
    { n : 'tiles.png', d: 88 },
    { n : 'places.png', d: 88 },
    { n: 'factory.png', d: 200 },
    { n: 'highlight.png', d: 88, noblur: true },
    { n: 'font.png', d: 11, noblur: true }
].reduce((a, c) => {
    var name = c.n.split('.')[0];
    a[name] = loadTexture(c.n, c.d, c.noblur);
    return a;
}, {});

var showChatbox = false;
var chat = '';

function updateCursorPosition(e) {
    cursorX = e.x;
    cursorY = e.y;
}

function mouseDown(e) {
    if (e.button == 0) {
        //select
        clicks.push({ x: cursorX, y: cursorY });
    }
}

function keyDown(e) {
    if(e.keyCode >= 48 && e.keyCode <= 57) {
        var controlGroup = e.keyCode-48;
        if (e.ctrlKey) {
            controlGroups[controlGroup] = selection;
        } else {
            selection = controlGroups[controlGroup] || [];
        }
    }
    if (e.key == 'Enter') {
        showChatbox = !showChatbox;
        if (chat) {
            if (chat.startsWith('/name ')) {
                var parts = chat.split(' ');
                if (parts.length == 2) {
                    sendMessage({
                        type: 'name',
                        data: parts[1].trim()
                    });
                }
            } else {
                sendMessage({
                    type: 'chat',
                    data: chat
                });
            }
            chat = '';
        }
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
    return false;
}

document.addEventListener('mousemove', updateCursorPosition, false);
document.addEventListener('mousedown', mouseDown, false);
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
    var y0 = transition.to.y;
    var x1 = transition.from.x;
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

	 beziern([
         { x: x0, y: y0 },
         { x: midx, y: midy },
         { x: nearDestx, y: nearDesty },
         { x: x1, y: y1 }], 
         p);
}