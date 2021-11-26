var COLOURS = [
	['blue', 'orange', 'red', 'black', 'teal'],
	['teal', 'blue', 'orange', 'red', 'black'],
	['black', 'teal', 'blue', 'orange', 'red'],
	['red', 'black', 'teal', 'blue', 'orange'],
	['orange', 'red', 'black', 'teal', 'blue']
];

var GRIDCOLOURS = [
	[2, 3, 4, 0, 1],
	[1, 2, 3, 4, 0],
	[0, 1, 2, 3, 4],
	[4, 0, 1, 2, 3],
	[3, 4, 0, 1, 2],
];

const ALPHANUMERIC = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function Game(code, host) {
	this.id = code;
	this.players = [host];
	host.isAdmin = true;
	host.game = this;
	this.tiles = [];
	this.bag = [];
	this.lid = [];
	this.factories = [];
	this.middle = [];
	this.turn = 0;
	this.started = false;

	this.addPlayer = function(player) {
		if (!this.started) {
			this.players.push(player);
			player.game = this;
	
			this.broadcastPlayerlist();
			player.sendId();
			player.sendLobbyId();
			return true;
		} else {
			return false;
		}
	}

	this.broadcastPlayerlist = function() {
		this.broadcast({
			type: 'playerlist',
			data: {
				players: this.players.map(p => {
					return {
						id: p.id,
						name: p.client.name,
						score: p.score
					};
				})
			} 
		});
	}

	this.getPlayer = function(id) {
		return this.players.filter(p => p.id)[0];
	}

	this.moveTile = function(tile, type, destination) {
		// remove tile from current
		switch(tile.position.type) {
			case 'lid':
				this.lid = this.lid.filter(t => t != tile);
				break;
			case 'bag':
				this.bag = this.bag.filter(t => t != tile);
				break;
			case 'pattern':
				if (tile.position.subposition == 'pattern') {
					player.pattern[tile.position.y][tile.position.x] = null;
				} else {
					player.floor[tile.position.x] = null;
				}
				break;
			case 'grid':
				break;
			case 'factory':
				this.factories[tile.position.factory] = this.factories[tile.position.factory].filter(t => t != tile);
			case 'middle':
				this.middle = this.middle.filter(t => t != tile);
				break;
		}

		// put tile in new
		tile.position.type = type;
		switch (type) {
			case 'lid':
				this.lid.push(tile);
				break;
			case 'bag':
				this.bag.push(tile);
				break;
			case 'pattern':
				var playerId = destination.playerId;
				var patternRow = destination.patternRow;
				var player = this.getPlayer(playerId);
				if(patternRow == -1) {
					player.floor.push(tile);
				} else {
					var placed = false;
					for(var pc = 0; pc < player.pattern[patternRow].length && !placed; pc++) {
						if (player.pattern[patternRow][pc] == null) {
							player.pattern[patternRow][pc] = tile;
							tile.position.subposition = 'pattern';
							tile.position.playerId = playerId;
							tile.position.x = pc;
							tile.position.y = patternRow;
							placed = true;
						}
					}
					if (!placed) {
						for(var f = 0; f < player.floor.length && !placed; f++) {
							if (player.floor[f] == null) {
								player.floor[f] = tile;
								tile.position.subposition = 'floor';
								tile.position.playerId = playerId;
								tile.position.x = f;
								placed = true;
							}
						}
					}
					if (!placed) {
						// put back in lid
						this.lid.push(tile);
						tile.position.type = 'lid';
					}
				}
				break;
			case 'grid':
				var playerId = destination.playerId;
				var patternRow = destination.patternRow;
				var player = this.getPlayer(playerId);
				tile.position.playerId = playerId;
				tile.position.y = patternRow;
				tile.position.x = GRIDCOLOURS[patternRow][tile.colour];
				player.grid[tile.position.y][tile.position.x] = tile;
				break;
			case 'factory':
				this.factories[destination.factory].push(tile);
				tile.position.factory = this.factories[destination.factory];
			case 'middle':
				this.middle.push(tile);
				break;

		}
	}

	this.roundStart = function() {
		this.bag = this.bag.sort((a, b) => Math.random()-0.5);

		for(var i = 0; i < (this.factories.length * 4) && this.bag.length > 0; i++) {
			this.moveTile(this.bag[i], 'factory', { factory: Math.floor(i/4) });
		}

		this.broadcastTiles();

		this.turn = Math.floor(Math.random() * this.players.length);
	}

	this.start = function() {
		this.started = true;
		this.broadcast({
			type: 'text',
			data: 'The game is beginning!'
		});
		
		var factoryCount = 1 + (this.players.length * 2);
		for(var i = 0; i < factoryCount; i++) {
			this.factories.push([]);
		}
		this.broadcastFactories();

		var numberOftiles = 100;
		if (this.players.length == 5) {
			numberOftiles += 25;
		}
		for(var i = 0; i < numberOftiles; i++) {
			this.tiles.push({
				id: 100+i,
				colour: i % 5,
				position:  {
					type: 'bag'
				}
			})
		}
		this.tiles.push({
			id: 99,
			colour: 5,
			position: {
				type: 'middle'
			}
		});
		this.broadcastTiles();

		for(var i = 0; i < this.tiles.length; i++) {
			if(this.tiles[i].colour != 5) {
				this.bag.push(this.tiles[i])
			}
		}

		this.roundStart();

		this.chat('It\'s ' + this.players[this.turn].client.name + '\'s turn!');
		this.broadcast({
			type: 'turn',
			data: this.players[this.turn].id
		});
	}

	this.chat = function(m) {
		this.broadcast({
			type: 'text',
			data: m
		});
	}

	this.broadcast = function(message) {
		this.players.forEach(p => {
			p.send(message);
		});
	}

	this.broadcastFactories = function() {
		this.broadcast({
			type: 'factories',
			data: {
				count: this.factories.length
			}
		})
	}

	this.broadcastTiles = function() {
		function serializePosition(position) {
			var ret = {
				type: position.type
			}
			switch (position) {
				case 'factory':
					ret.factoryid = factories.indexOf(position.factory);			
					break;
				default:
					break;
			}
			return ret;
		}

		this.broadcast({
			type: 'tiles',
			data: {
				tiles: this.tiles.map(t => { 
					console.log(t.position);
					return {
						id: t.id,
						colour: t.colour,
						position: serializePosition(t.position)
					}
				})
			}
		})
	}

	this.broadcaststate = function(player) {
		this.broadcastPlayerlist();
	}

	this.next = function() {
		this.turn++;
		this.turn = this.turn % this.players.length;
		this.players[this.turn].isTurn = true;
	}

	this.broadcastPlayerlist();
	host.sendId();
	host.sendHost();
	host.sendLobbyId();

	return this;
}

function Player(client) {
	this.id = [0, 0, 0, 0, 0, 0, 0, 0].map(() => { return ALPHANUMERIC[Math.floor(Math.random()*ALPHANUMERIC.length)] }).join('');
	this.game = null;
	this.client = client;
	this.isTurn = false;
	client.player = this;

	this.pattern = [
		[null],
		[null, null],
		[null, null, null],
		[null, null, null, null],
		[null, null, null, null, null]
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
		if (this.isTurn) {
			if(this.pick(data.colour, data.zone, data.destination)) {
				this.isTurn = false;
				this.game.next();
			}
		}
	}

	this.startGame = function() {
		if (this.isAdmin) {
			this.game.start();
		}
	}

	this.state = function() {
		this.game.broadcaststate(this);
		this.sendId();
		this.sendLobbyId();
	}

	this.sendLobbyId = function() {
		this.client.send({
			type: 'lobby',
			data: this.game.id
		});
	}

	this.sendId = function() {
		this.client.send({
			type: 'playerid',
			data: this.id
		})
	}

	this.sendHost = function() {
		this.client.send({
			type: 'host'
		})
	}

	this.send = function(message) {
		this.client.send(message)
	}

	this.validatePlacement = function(colour, y) {
		if (this.pattern[y].filter(p => p == null).length > 1) {
			if(pattern[y][0].colour != colour) {
				return false;
			}
		}
		
		if (pattern[y].filter(p => p == null).length == 0) {
			return false;
		}
		
		var x = GRIDCOLOURS[y].indexOf(colour);
		if (grid[y][x]) {
			return false;
		}
		return true;
	}

	this.placeInPattern = function(picked, y) {
		for(var i = 0; i < pattern[y].length; i++) {
			this.game.moveTile(t, 'pattern', { playerId: this.id, patternRow: y });
		}
	}

	this.pick = function(colour, zone, destination) {
		// destination -1 means the floor
		if (destination >= 0 && !this.validatePlacement(colour, destination)) {
			return;
		}
		
		var picked = [];
		if (zone == -1) {
			// picking from the middle
			picked = middle.filter(t => t.colour == colour);
		} else {
			picked = factories[zone].filter(t => t.colour == colour);
			var unpicked = factories[zone].filter(t => t.colour != colour);

			unpicked.forEach(t => {
				this.game.moveTile(t, 'middle')
			});
		}
		
		this.placeInPattern(picked, destination);
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