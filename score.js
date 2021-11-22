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
