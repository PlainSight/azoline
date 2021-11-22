// use bezier curves to move tiles

var colours = [
	['blue', 'orange', 'red', 'black', 'teal'],
	['teal', 'blue', 'orange', 'red', 'black'],
	['black', 'teal', 'blue', 'orange', 'red'],
	['red', 'black', 'teal', 'blue', 'orange'],
	['orange', 'red', 'black', 'teal', 'blue']
];

function validatePlacement(colour, y) {
	var x = colours[y].indexOf(colour);
	if (grid[y][x]) {
		return false;
	}
	return true;
}

var grid = [
[null, null, null, null, null],
[null, null, null, null, null],
[null, null, null, null, null],
[null, null, null, null, null],
[null, null, null, null, null]
];

function scorePlacement(x, y) {
	var ymin = 0;

	for (var yy = y; yy >= 0 && grid[yy][x]; yy--) {
		ymin = yy;
	}

	var ymax = 0;

	for (var yy = y; yy < 5 && grid[yy][x]; yy++) {
		ymax = yy;
	}

	var xmin = 0;

	for (var xx = x; xx > 0 && grid[y][xx]; xx--) {
		xmin = xx;
	}

	var xmax = 0;

	for (var xx = x; xx < 5 && grid[y][xx]; xx++) {
		xmax = xx;
	}

	var score = 0;

	if (xmax - xmin > 0) {
		score += 1 + (xmax - xmin);
	}

	if (ymax - ymin > 0) {
		score += 1 + (ymax - ymin);
	}

	if (score == 0) {
		score = 1;
	}

	return score;
}

function calculateBonuses() {
	var bonus = 0;
	
	// rows +2
outer:	for(var y = 0; y < 5; y++) {
		for(var x = 0; x < 5; x++) {
			if(!grid[y][x]) {
				continue outer;
			}
		}
		bonus += 2;
	}
	
	// columns +7
outer:	for(var x = 0; x < 5; x++) {
		for(var y = 0; y < 5; y++) {
			if(!grid[y][x]) {
				continue outer;
			}
		}
		bonus += 7;
	}
	
	// sets = +10
	outer:	for(var x = 0; x < 5; x++) {
		for(var y = 0; y < 5; y++) {
			if(!grid[y][(x+y)%5]) {
				continue outer;
			}
		}
		bonus += 10;
	}
	
	return bonus;
}


function bezier(x0, y0, x1, y1) {
	// project a point no more than len(x0x1, y0y1) from the middle of vec(x0x1, y0y1) at 90 degrees.
	
	var xm = (x0 + x1) / 2;
	var ym = (y0 + y1) / 2;
	
	var dx = y1 - y0;
	var dy = x0 - x1;
	
	var swing = 0.8;
	
	var mul = (swing*2*Math.random()) - swing;
	
	var x = xm + (mul * dx);
	var y = ym + (mul * dy);
	
	var v0x0 = x0;
	var v0x1 = x;
	var v0y0 = y0;
	var v0y1 = y;
	
	var v1x0 = x;
	var v1x1 = x1;
	var v1y0 = y;
	var v1y1 = y1;
	
	function lerp(x0, y0, x1, y1, p) {
		return {
			x: (x0*p)+(x1*(1-p)),
			y: (y0*p)+(y1*(1-p))
		}
	}
	
	var step = 0.1;
	
	var steps = [];
	
	for (var p = 0; p <= 1; p += step) {
		var v0 = lerp(v0x0, v0y0, v0x1, v0y1, p);
		var v1 = lerp(v1x0, v1y0, v1x1, v1y1, p);
		var xy = lerp(v0.x, v0.y, v1.x, v1.y, p);
		steps.push(xy);
	}
	
	return steps;
	console.log(steps);
}
