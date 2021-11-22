

// place piece

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

