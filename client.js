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
        case 'action':
            message.data;
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
        if (color.r < 0.01 && color.g > 0.99 && color.b > 0.99) {
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

function loadTexture(src, d) {
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
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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

    gl.clearColor(1.0, 1.0, 1.0, 1.0);
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
            var dx = x + w;
            var dy = y - h;
            z = z || 0.5;
            positions.push(
                x, y, z,
                dx, y, z,
                dx, dy, z,
                x, y, z,
                x, dy, z,
                dx, dy, z
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
                default:
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

function render() {
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

    drawSprite('tiles', 0, 0, 30, 30, 80, 80, 0.5, 5);

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

var graphics = [{ n : 'tiles.png', d: 80 }, { n: 'cursors.png', d: 16 }, { n: 'font.png', d: 9 }].reduce((a, c) => {
    var name = c.n.split('.')[0];
    a[name] = loadTexture(c.n, c.d);
    return a;
}, {});

var showChatbox = false;
var chat = '';

var ZTILE = 0.5;
var ZUNITHIGHLIGHT = 0.45;
var ZUNIT = 0.4;
var ZUIBACK = 0.35;
var ZUIMIDDLE = 0.3;
var ZUIFRONT = 0.25;

function renderText(x, y, text, drawCursor, maxWidth, callback) {
    text += ' ';
    var position = 0;
    var line = 0;
    for(var i = 0; i < text.length; i++) {
        var charCode = text.charCodeAt(i);
        if(charCode == 10) {
            line++;
            position = 0;
            continue;
        }
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
        if (!!maxWidth && valid && ((position*7) > maxWidth) && text[i+1] != ' ') {
            // dashes
            if (text[i-1] != ' ') {
                spriteX = 3;
                spriteY = 5;
                callback('font9', spriteX, spriteY, x+(position*7), y+(line*9), ZUIFRONT);
            }
            i--;
            line++;
            position = 0;
            continue;
        }
        if (valid) {
            callback('font9', spriteX, spriteY, x+(position*7), y+(line*9), ZUIFRONT);
        }
        position++;
    }
    if (drawCursor) {
        callback('font9', 4, 5, x+((position-1)*7), y+(line*9), ZUIFRONT);
    }
}


function updateCursorPosition(e) {
    cursorX += (e.movementX / 3);
    cursorY += (e.movementY / 3);
    var onVerticalEdge = false;
    var onHorizontalEdge = false;
    if (cursorX < 0) { cursorX = 0; onVerticalEdge = true; }
    if (cursorY < 0) { cursorY = 0; onHorizontalEdge = true; }
    if (cursorX > canvas.width-4) { cursorX = canvas.width-4; onVerticalEdge = true; }
    if (cursorY > canvas.height-8) { cursorY = canvas.height-8; onHorizontalEdge = true; }
    if ((e.shiftKey && ((e.buttons & 1) == 1)) || ((e.buttons & 4) == 4)) {
        if (!onVerticalEdge) {
            cameraX -= (e.movementX / 3);
        }
        if (!onHorizontalEdge) {
            cameraY -= (e.movementY / 3);
        }
    }
}
function mouseDown(e) {
    if (e.button == 0) {
        //select
        selectionStart = { x: cursorX, y: cursorY };
        actionLocation = null;
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

function bezier(x0, y0, x1, y1, p) {
	// project a point no more than len(x0x1, y0y1) from the middle of vec(x0x1, y0y1) at 90 degrees.
	
	var xm = (x0 + x1) / 2;
	var ym = (y0 + y1) / 2;
	
	var dx = y1 - y0;
	var dy = x0 - x1;
	
	var swing = 0.8;
	
	var mul = (swing*2*Math.random()) - swing;
	
	var midx = xm + (mul * dx);
	var midy = ym + (mul * dy);
	
	// select a random point near the destination
	
	var dist = 30;
	var angle = Math.random() * 2 * Math.PI;
	
	var nearDestx = x1 + (Math.sin(angle) * dist);
	var nearDesty = y1 + (Math.cos(angle) * dist);
	
	return [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1].map(p => beziern([{ x: x0, y: y0 }, { x: midx, y: midy }, { x: nearDestx, y: nearDesty }, { x: x1, y: y1 }], p)).map(v => v.x +' ' + v.y).reduce((a, c) => a+'\n'+c);
}