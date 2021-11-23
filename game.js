var COLOURS = [
	['blue', 'orange', 'red', 'black', 'teal'],
	['teal', 'blue', 'orange', 'red', 'black'],
	['black', 'teal', 'blue', 'orange', 'red'],
	['red', 'black', 'teal', 'blue', 'orange'],
	['orange', 'red', 'black', 'teal', 'blue']
];

function Game(host) {
	this.id = [0, 0, 0, 0].map(() => { return ALPHANUMERIC[Math.floor(Math.random()*ALPHANUMERIC.length)] }).join('');
	this.players = [host];
	this.factories = [];
	this.middle = [];
	this.turn = 0;

	this.addPlayer = function(player) {
		this.players.push(player);
	}

	this.start = function() {
		this.broadcast({
			type: 'message',
			data: 'The game is about to begin!'
		});
		this.turn = Math.floor(Math.random() * this.players.length);
	}

	this.broadcast = function(message) {
		this.player.forEach(p => {
			p.send(message);
		});
	}

	this.next() = function() {
		this.turn++;
		this.turn = this.turn % this.players.length;
		this.players[this.turn].isTurn = true;
	}

	this.broadcast({
		type: 'lobby',
		data: {
			lobbyName: this.id,
			players: this.players.map(p => p.client.name)
		}
	})

	return this;
}

function Player(client) {
	this.game = null;
	this.client = client;
	this.isTurn = false;

	this.pattern = [
		{ colour: '', count: 0, capacity: 1 },
		{ colour: '', count: 0, capacity: 2 },
		{ colour: '', count: 0, capacity: 3 },
		{ colour: '', count: 0, capacity: 4 },
		{ colour: '', count: 0, capacity: 5 }
	];
	this.grid = [
		[null, null, null, null, null],
		[null, null, null, null, null],
		[null, null, null, null, null],
		[null, null, null, null, null],
		[null, null, null, null, null]
	];
	this.floor = [];
	this.score = 0;

	this.setClient = function (client) {
		this.client = client;
		this.client.player = this;
	};

	this.setGame = function (game) {
		this.game = game;
	}

	this.chat = function(message) {
		this.game.chat(this.client.name + ': ' + message);
	}

	this.command = function(data) {
		if (isturn) {
			this.pick(data.colour, data.zone, data.destination);
			this.isTurn = false;
			this.game.next();
		}
	}

	this.send = function(message) {
		this.connection.send(JSON.stringify(message))
	}

	this.validatePlacement = function(colour, y) {
		if (pattern[y].count > 1) {
			if(pattern[y].colour != colour) {
				return false;
			}
		}
		
		if (pattern[y].count == pattern[y].capacity) {
			return false;
		}
		
		var x = COLOURS[y].indexOf(colour);
		if (grid[y][x]) {
			return false;
		}
		return true;
	}

	this.placeInPattern = function(colour, count, y) {
		var overflow = count;
		
		if (y >= 0) {
			pattern[y].count += count;
			overflow = Math.max(0, pattern[y].count - pattern[y].capacity);
			pattern[y].count -= overflow;
			pattern[y].colour = colour;
		}
		
		for(var i = 0; i < overflow; i++) {
			floor.push({ colour: colour });
		}
	}

	this.pick = function(colour, zone, destination) {
		// destination -1 means the floor
		if (destination >= 0 && !validatePlacement, colour, destination) {
			return;
		}
		
		var picked = [];
		if (zone == -1) {
			// picking from the middle
			picked = middle.filter(t => t.colour == colour);
			middle = middle.filter(t => t.colour != colour);
		} else {
			picked = factories[zone].filter(t => t.colour == colour);
			middle.push(...factories[zone].filter(t => t.colour != colour));
			
			factories[zone] = [];
		}
		
		placeInPattern(colour, picked.length, destination);
	}

	this.build = function() {
		for (var p = 0; p < pattern.length; p++) {
			if (pattern[p].count == pattern[p].capacity) {
				var index = grid[p].indexOf(pattern[p].colour);
				grid[p][index] = pattern[p].colour;
				playerScore += scorePlacement(index, p);
			}
		}

		return this;
	}

	this.scorePlacement = function(x, y) {
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

	this.calculateBonuses = function() {
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
};

module.exports = {
    Game,
	Player
}