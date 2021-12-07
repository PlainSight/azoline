var COLOURS = [
	['blue', 'orange', 'red', 'black', 'teal'],
	['teal', 'blue', 'orange', 'red', 'black'],
	['black', 'teal', 'blue', 'orange', 'red'],
	['red', 'black', 'teal', 'blue', 'orange'],
	['orange', 'red', 'black', 'teal', 'blue']
];

var NAMETOCOLOURID = {
	'black': 0, 
	'teal': 1,
	'blue': 2,
	'orange': 3,
	'red': 4
}

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
	this.finished = false;

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
		return this.players.filter(p => p.id == id)[0];
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
				var player = this.getPlayer(tile.position.playerId);
				if (tile.position.subposition == 'pattern') {
					player.pattern[tile.position.y][tile.position.x] = null;
				} else {
					player.floor[tile.position.x] = null;
				}
				break;
			case 'grid':
				break;
			case 'factory':
				var factoryIndex = tile.position.factoryid;
				this.factories[factoryIndex] = this.factories[factoryIndex].filter(t => t != tile);
				break;
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
					var placed = false;
					for(var f = 0; f < player.floor.length && !placed; f++) {
						if (player.floor[f] == null) {
							player.floor[f] = tile;
							tile.position.subposition = 'floor';
							tile.position.playerId = playerId;
							tile.position.x = f;
							placed = true;
						}
					}
					if (!placed) {
						// put back in lid
						this.lid.push(tile);
						tile.position.type = 'lid';
					}
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
				tile.position.x = GRIDCOLOURS[patternRow].indexOf(tile.colour);
				player.grid[tile.position.y][tile.position.x] = tile;
				break;
			case 'factory':
				this.factories[destination.factory].push(tile);
				tile.position.factoryid = destination.factory;
				break;
			case 'middle':
				this.middle.push(tile);
				break;

		}
	}

	this.gameStart = function() {
		this.populateFactories();
		this.broadcastTiles();
		this.turn = Math.floor(Math.random() * this.players.length);
		this.players[this.turn].isTurn = true;
	}

	this.populateFactories = function() {
		this.bag = this.bag.sort((a, b) => Math.random()-0.5);

		for(var i = 0; i < (this.factories.length * 4) ; i++) {
			if (this.bag.length == 0) {
				this.replenishBag();
			}
			if (this.bag.length == 0) {
				return;
			}
			this.moveTile(this.bag.pop(), 'factory', { factory: Math.floor(i/4) });
		}
	}

	this.replenishBag = function() {
		this.bag = this.lid;
		this.bag = this.bag.sort((a, b) => Math.random()-0.5);
		this.lid = [];
	}

	this.start = function() {
		this.started = true;
		this.broadcast({
			type: 'text',
			data: 'The game is beginning!'
		});

		this.players.sort((a, b) => Math.random()-0.5);

		this.broadcastPlayerlist();
		
		var factoryCount = Math.max(1 + (this.players.length * 2), 5);
		for(var i = 0; i < factoryCount; i++) {
			this.factories.push([]);
		}
		this.broadcastFactories();

		var numberOftiles = 100;
		if (this.players.length > 4) {
			numberOftiles += (this.players.length-4)*25;
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
			} else {
				this.middle.push(this.tiles[i]);
			}
		}

		this.gameStart();

		this.chat('It\'s ' + this.players[this.turn].client.name + '\'s turn!');
		this.broadcastTurn();
	}

	this.broadcastTurn = function() {
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
			switch (position.type) {
				case 'factory':
					ret.factoryid = position.factoryid;			
					break;
				case 'pattern':
					ret.subposition = position.subposition;
					ret.playerId = position.playerId;
					ret.x = position.x;
					ret.y = position.y;
					break;
				case 'grid':
					ret.playerId = position.playerId;
					ret.x = position.x;
					ret.y = position.y;
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
		this.broadcastFactories();
		this.broadcastTiles();
		this.broadcastTurn();
	}

	this.next = function() {
		// check if the round is ending.
		if (this.factories.filter(f => f.length > 0).length > 0 || this.middle.length > 0) {
			// keep playing
			this.turn++;
			this.turn = this.turn % this.players.length;
			this.players[this.turn].isTurn = true;
			this.broadcastTurn();
			this.broadcastTiles();
		} else {
			this.broadcastTiles();

			setTimeout(() => {
				// new round
				var roundResults = this.players.map(p => {
					return {
						res: p.build(),
						player: p
					};
				});

				var gameEnding = roundResults.filter(rr => rr.res.endingGame).length > 0;

				var nextPlayer = roundResults.filter(rr => rr.res.startsNext == true)[0].player;
				this.turn = this.players.indexOf(nextPlayer);

				if (!gameEnding) {
					this.populateFactories();
					this.broadcastPlayerlist();
					this.players[this.turn].isTurn = true;
					this.broadcastTurn();
					this.broadcastTiles();
				} else {
					this.players.forEach(p => {
						var bonus = p.calculateBonuses();
						this.chat(p.client.name + ' SCORES ' + bonus + ' BONUS POINTS!');
					});
					var bestScore = Math.max(...this.players.map(p => p.score));
					var bestPlayer = this.players.filter(p => p.score == bestScore)[0];
					this.broadcastPlayerlist();
					this.broadcastTiles();
					this.chat(bestPlayer.client.name + ' WINS WITH ' + bestScore + ' POINTS!');
					this.chat('The game will end in 60 seconds');

					setTimeout(() => {
						this.finished = true;
					}, 60000);
				}
			}, 2000);
			
		}
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
	this.startsNext = false;
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
	this.floor = [null, null, null, null, null, null, null];
	this.score = 0;

	this.setClient = function (client) {
		this.client = client;
		this.client.player = this;
	};

	this.setGame = function (game) {
		this.game = game;
	}

	this.chat = function(message) {
		console.log('chat', this.client.name + ': ' + message);
		this.game.chat(this.client.name + ': ' + message);
	}

	this.command = function(data) {
		console.log('command', this.client.name, data, this.isTurn);
		if (this.isTurn) {
			var colour = NAMETOCOLOURID[data.colour];
			if(this.pick(colour, data.zone, data.destination)) {
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
		if (!this.game.started && this.isAdmin) {
			this.sendHost();
		}
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
		if (this.pattern[y].filter(p => p != null).length > 0) {
			if(this.pattern[y][0].colour != colour) {
				return false;
			}
		}
		
		if (this.pattern[y].filter(p => p == null).length == 0) {
			return false;
		}
		
		var x = GRIDCOLOURS[y].indexOf(colour);
		if (this.grid[y][x]) {
			return false;
		}
		return true;
	}

	this.placeInPattern = function(picked, y) {
		picked.forEach(t => {
			if (t.colour == 5) {
				this.startsNext = true;
			}
			if (y > -1 && t.colour != 5) {
				this.game.moveTile(t, 'pattern', { playerId: this.id, patternRow: y });
			} else {
				this.game.moveTile(t, 'pattern', { playerId: this.id, patternRow: -1 });
			}
		});
	}

	this.pick = function(colour, zone, destination) {
		// destination -1 means the floor
		if (destination >= 0 && !this.validatePlacement(colour, destination)) {
			return false;
		}
		
		var picked = [];
		if (zone == -1) {
			// picking from the middle
			picked = this.game.middle.filter(t => t.colour == colour || t.colour == 5);
			if (picked.length == 0) {
				return false;
			}
		} else {
			picked = this.game.factories[zone].filter(t => t.colour == colour);
			if (picked.length == 0) {
				return false;
			}
			var unpicked = this.game.factories[zone].filter(t => t.colour != colour);

			unpicked.forEach(t => {
				this.game.moveTile(t, 'middle')
			});
		}
		
		this.placeInPattern(picked, destination);

		return true;
	}

	this.build = function() {
		var ret = {
			startsNext: false,
			endingGame: false
		};
		for (var p = 0; p < this.pattern.length; p++) {
			if (this.pattern[p].filter(t => t == null).length == 0) {
				var colour = this.pattern[p][0].colour;
				this.game.moveTile(this.pattern[p][0], 'grid', { playerId: this.id, patternRow: p })
				var x = GRIDCOLOURS[p].indexOf(colour);
				this.score += this.scorePlacement(x, p);

				for (var i = 1; i < this.pattern[p].length; i++) {
					this.game.moveTile(this.pattern[p][i], 'lid');
				}
			}
		}
		// scan horizontal rows of grid
		for(var p = 0; p < 5; p++) {
			if (this.grid[p].filter(g => g != null).length == 5) {
				ret.endingGame = true;
			}
		}

		for(var r = 0; r < this.floor.length && this.floor[r]; r++) {
			if (r < 2) {
				this.score -= 1;
			} else {
				if (r < 5) {
					this.score -= 2;
				} else {
					if (r < 7) {
						this.score -= 3;
					}
				}
			}
			var tile = this.floor[r];
			if (tile.colour != 5) {
				this.game.moveTile(tile, 'lid');
			} 
			// else {
			// 	ret.startsNext = true;
			// 	this.game.moveTile(tile, 'middle');
			// }
		}
		ret.startsNext = this.startsNext;
		this.startsNext = false;
		return ret;
	}

	this.scorePlacement = function(x, y) {
		var ymin = 0;
		for (var yy = y; yy >= 0 && this.grid[yy][x]; yy--) {
			ymin = yy;
		}
		var ymax = 0;
		for (var yy = y; yy < 5 && this.grid[yy][x]; yy++) {
			ymax = yy;
		}
		var xmin = 0;
		for (var xx = x; xx > 0 && this.grid[y][xx]; xx--) {
			xmin = xx;
		}
		var xmax = 0;
		for (var xx = x; xx < 5 && this.grid[y][xx]; xx++) {
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
				if(!this.grid[y][x]) {
					continue outer;
				}
			}
			bonus += 2;
		}
		
		// columns +7
	outer:	for(var x = 0; x < 5; x++) {
			for(var y = 0; y < 5; y++) {
				if(!this.grid[y][x]) {
					continue outer;
				}
			}
			bonus += 7;
		}
		
		// sets = +10
		outer:	for(var x = 0; x < 5; x++) {
			for(var y = 0; y < 5; y++) {
				if(!this.grid[y][(x+y)%5]) {
					continue outer;
				}
			}
			bonus += 10;
		}
		
		this.score += bonus;
		return bonus;
	}
};

module.exports = {
    Game,
	Player
}