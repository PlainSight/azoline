var database = require('./database');

const NAMETOCOLOURID = {
	'black': 0, 
	'teal': 1,
	'blue': 2,
	'orange': 3,
	'red': 4
}

const GRIDCOLOURS = [
	[2, 3, 4, 0, 1],
	[1, 2, 3, 4, 0],
	[0, 1, 2, 3, 4],
	[4, 0, 1, 2, 3],
	[3, 4, 0, 1, 2],
];

const TURNTIME = 60000;

const ALPHANUMERIC = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function Game(code, host, replayDetails) {
	this.id = code;
	this.gameRecordId = 0;
	this.players = [host];
	host.isAdmin = true;
	host.game = this;
	this.tiles = [];
	this.bag = [];
	this.lid = [];
	this.factories = [];
	this.round = 0;
	this.middle = [];
	this.turn = 0;
	this.turnTime = TURNTIME;
	this.startTime = Date.now();
	this.started = false;
	this.finished = false;
	this.seed = Math.floor(Math.random() * 1000000000);
	this.replayMode = false;
	this.replayBroadcast = [];
	this.actions = [];

	let gameSelf = this;

	if (!!replayDetails) {
		this.players = replayDetails.players.map(p => {
			var p = new Player(null, p);
			p.game = gameSelf;
			return p;
		});
		host = this.players[0];
		host.isAdmin = true;
		this.seed = replayDetails.seed;
		this.replayMode = true;
		this.actions = replayDetails.actions;
		this.id = replayDetails.code;
	}

	this.addPlayer = function(player) {
		if (!this.started) {
			this.players.push(player);
			player.game = this;
	
			this.broadcastPlayerlist();
			return true;
		} else {
			return false;
		}
	}

	// replay only
	this.simulateGame = function() {
		this.start(10, false);

		this.actions.forEach(a => {
			var playerForAction = this.players.find(p => p.id == a.playerId);
			playerForAction.pick(a.command.colour, a.command.zone, a.command.destination);
			this.next();
		});

		return this.replayBroadcast;
	}

	this.random = (function () {
		var seed = gameSelf.seed;
		return function () {
			seed = seed & 0xffffffff;
			seed = (seed + 0x7ed55d16 + (seed << 12)) & 0xffffffff;
			seed = (seed ^ 0xc761c23c ^ (seed >>> 19)) & 0xffffffff;
			seed = (seed + 0x165667b1 + (seed << 5)) & 0xffffffff;
			seed = ((seed + 0xd3a2646c) ^ (seed << 9)) & 0xffffffff;
			seed = (seed + 0xfd7046c5 + (seed << 3)) & 0xffffffff;
			seed = (seed ^ 0xb55a4f09 ^ (seed >>> 16)) & 0xffffffff;
			return (seed & 0xfffffff) / 0x10000000;
		}
	})();

	this.leave = function(player) {
		player.client.send({ type: 'codeplease' });
		if (this.players.filter(p => !p.disconnected).length == 1) {
			this.finished = true;
		} else {
			if (player.isAdmin && !this.started) {
				// reassign admin
				var newAdmin = this.players.filter(p => p != player)[0];
				newAdmin.isAdmin = true;
				newAdmin.sendHost();
			}
		}
		player.client.player = null;
		player.client = null;
		player.disconnected = true;
	}

	this.broadcastPlayerlist = function() {
		this.broadcast((player) => {
			return {
				type: 'playerlist',
				data: {
					players: this.players.map(p => {
						return {
							id: p.id,
							name: p.name,
							score: p.score
						};
					}),
					playerId: player.id,
					gameId: player.game.id
				} 
			};
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

	this.shuffle = function(array) {
		let currentIndex = array.length, randomIndex;
	  
		// While there remain elements to shuffle.
		while (currentIndex != 0) {
			// Pick a remaining element.
			randomIndex = Math.floor(this.random() * currentIndex);
			currentIndex--;
		
			// And swap it with the current element.
			[array[currentIndex], array[randomIndex]] = [
			array[randomIndex], array[currentIndex]];
		}
	  
		return array;
	}

	this.populateFactories = function() {
		this.bag = this.shuffle(this.bag);

		var numberOne = this.lid.filter(t => t.colour == 5)[0];
		this.lid = this.lid.filter(t => t.colour != 5);

		if (numberOne) {
			this.moveTile(numberOne, 'middle');
		}

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
		this.bag = this.shuffle(this.bag);
		this.lid = [];
	}

	this.start = function(roundTime, shufflePlayers) {
		this.turnTime = roundTime;
		this.started = true;
		this.broadcast({
			type: 'text',
			data: 'The game is beginning!'
		});

		if (shufflePlayers) {
			this.players = this.shuffle(this.players);
		} else {
			this.shuffle(this.players.map(x => {}));
		}

		if (!this.replayMode) {
			database.CreateGameRecord(this.id, this.seed, this.players.map(p => { return { name: p.name, score: p.score, id: p.id };}), gameSelf);
		}

		this.broadcastPlayerlist();
		
		var factoryCount = 4;

		if (this.players.length > 1) {
			factoryCount = 1 + (this.players.length * 2);
		}

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

		this.populateFactories();
		this.broadcastTiles();
		this.startTurn(0);
	}

	this.startTurn = function(start) {
		if (start != undefined) {
			this.turn = start;
			this.chat(this.players[this.turn].name + ' starts!');
		} else {
			this.turn++;
			this.turn = this.turn % this.players.length;
		}
		this.players[this.turn].isTurn = true;
		if (!this.replayMode) {
			this.players[this.turn].startTimer();
		}
		this.broadcastTurn();
	}

	this.broadcastTurn = function() {
		this.broadcast({
			type: 'turn',
			data: {
				id: this.players[this.turn].id,
				timerEnd: this.players[this.turn].timerEnd
			}
		});
	}

	this.chat = function(m) {
		this.broadcast({
			type: 'text',
			data: m
		});
	}

	this.broadcast = function(message) {
		if (this.replayMode) {
			if (message.type !== 'text' && message.type !== 'turn') {
				if (typeof message == 'function') {
					this.replayBroadcast.push(message(this.players[0]));
				} else {
					this.replayBroadcast.push(message);
				}
			}
		} else {
			this.players.forEach(p => {
				if (typeof message == 'function') {
					p.send(message(p));
				} else {
					p.send(message);
				}
			});
		}
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
		function numeralizePosition(position) {
			switch (position.type) {
				case 'bag':
					return 0;
				case 'lid':
					return 1;
				case 'middle':
					return 2;
				case 'factory':
					return position.factoryid+3;
				case 'pattern':
					var offset = 100 + (100 * gameSelf.players.findIndex(p => position.playerId == p.id));
					offset += position.x;
					if (position.subposition == 'floor') {
						offset += 25;
					} else {
						offset += 5 * position.y;
					}
					return offset;
				case 'grid':
					var offset = 100 + (100 * gameSelf.players.findIndex(p => position.playerId == p.id));
					offset += 50;
					offset += position.x;
					offset += 5 * position.y;
					return offset;
			}
		}

		this.broadcast({
			type: 'tiles',
			data: {
				tiles: this.tiles.map(t => {
					return numeralizePosition(t.position);
				}),
				round: this.round
			}
		});
	}

	this.broadcaststate = function() {
		this.broadcastPlayerlist();
		this.broadcastFactories();
		this.broadcastTiles();
		this.broadcastTurn();
	}

	this.next = function() {
		if (this.players.every(p => !p.isConnected)) {
			this.finished = true;
		}
		if (!this.replayMode && Date.now() - this.startTime > 3_600_000) {
			this.finished = true;
		}
		if (this.finished) {
			return;
		}
		// check if the round is ending.
		if (this.factories.filter(f => f.length > 0).length > 0 || this.middle.length > 0) {
			// keep playing
			this.startTurn();
			this.broadcastTiles();
		} else {
			this.broadcastTiles();
			this.round++;

			if (this.replayMode) {
				// new round
				var roundResults = this.players.map(p => {
					return {
						res: p.build(),
						player: p
					};
				});

				var gameEnding = roundResults.filter(rr => rr.res.endingGame).length > 0;

				var nextPlayer = roundResults.filter(rr => rr.res.startsNext == true)[0].player;

				if (!gameEnding) {
					this.populateFactories();
					this.broadcastPlayerlist();
					this.startTurn(this.players.indexOf(nextPlayer));
					this.broadcastTiles();
				} else {
					this.players.forEach(p => {
						var bonus = p.calculateBonuses();
						this.chat(p.name + ' SCORES ' + bonus + ' BONUS POINTS!');
					});
					if (!this.replayMode) {
						database.UpdateGameRecord(this.gameRecordId, this.players.map(p => { 
							return { name: p.name, score: p.score, id: p.id };
						}));
					}
					var bestScore = Math.max(...this.players.map(p => p.score));
					this.broadcastPlayerlist();
					this.broadcastTiles();
				}
			} else {
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
	
					if (!gameEnding) {
						this.populateFactories();
						this.broadcastPlayerlist();
						this.startTurn(this.players.indexOf(nextPlayer));
						this.broadcastTiles();
					} else {
						this.players.forEach(p => {
							var bonus = p.calculateBonuses();
							this.chat(p.name + ' SCORES ' + bonus + ' BONUS POINTS!');
						});
						if (!this.replayMode) {
							database.UpdateGameRecord(this.gameRecordId, this.players.map(p => { 
								return { name: p.name, score: p.score, id: p.id };
							}));
						}
						var bestScore = Math.max(...this.players.map(p => p.score));
						var bestPlayer = this.players.filter(p => p.score == bestScore)[0];
						this.broadcastPlayerlist();
						this.broadcastTiles();
						this.chat(bestPlayer.name + ' WINS WITH ' + bestScore + ' POINTS!');
						this.chat('The game will end in 20 seconds');
	
						setTimeout(() => {
							this.finished = true;
						}, 18000);
					}
				}, 2000);
			}
		}
	}

	this.broadcastPlayerlist();
	host.sendHost();

	return this;
}

function Player(client, replayPlayerDetails) {
	if (replayPlayerDetails) {
		this.id = replayPlayerDetails.id;
		this.game = null;
		this.client = null;
		this.isTurn = false;
		this.startsNext = false;
		this.disconnected = false;
		this.isConnected = true;
		this.name = replayPlayerDetails.name;
		this.timedOut = false;
		this.timer = null;
		this.timerEnd = 0;
	} else {
		this.id = [0, 0, 0, 0, 0, 0, 0, 0].map(() => { return ALPHANUMERIC[Math.floor(Math.random()*ALPHANUMERIC.length)] }).join('');
		this.game = null;
		this.client = client;
		this.isTurn = false;
		this.startsNext = false;
		this.disconnected = false;
		this.isConnected = true;
		this.name = client.name;
		this.timedOut = false;
		this.timer = null;
		this.timerEnd = 0;
		client.player = this;
	}

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

	this.chat = function(message) {
		this.game.chat(this.name + ': ' + message);
	}

	this.startTimer = function() {
		var self = this;
		var tt = self.game.turnTime;
		if (this.disconnected) {
			tt = 0;
		} else {
			if (this.timedOut) {
				tt = Math.max(self.game.turnTime / 3, 10000);
			}
		}
		this.timerEnd = Date.now() + tt;
		this.timer = setTimeout(() => {
			self.randomMove();
		}, tt);
	}

	this.resetTimer = function() {
		clearTimeout(this.timer);
	}

	this.command = function(data) {
		if (this.isTurn) {
			var colour = NAMETOCOLOURID[data.colour];
			if(this.pick(colour, data.zone, data.destination)) {
				this.isTurn = false;
				this.timedOut = false;
				this.resetTimer();
				this.game.next();
			}
		}
	}

	this.startGame = function(roundTime) {
		if (this.isAdmin) {
			this.game.start(roundTime, true);
		}
	}

	this.leave = function() {
		if (this.game) {
			this.game.leave(this);
		}
	}


	this.state = function() {
		this.game.broadcaststate();
		if (!this.game.started && this.isAdmin) {
			this.sendHost();
		}
	}

	this.sendHost = function() {
		this.send({
			type: 'host'
		})
	}
	
	this.send = function(message) {
		if (this.client) {
			this.client.send(message)
		}
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

	this.randomMove = function() {
		if (this.isTurn) {
			var validZones = [];
			this.game.factories.forEach((f, i) => {
				if (f.length > 0) {
					validZones.push(i);
				}
			});
			if (this.game.middle.filter(t => t.colour != 5).length > 0) {
				validZones.push(-1);
			}
			var pickedZone = validZones[Math.floor(Math.random() * validZones.length)];
			if (pickedZone >= 0) {
				var pickedTile = this.game.factories[pickedZone][Math.floor(Math.random()*4)];
				this.pick(pickedTile.colour, pickedZone, -1);
			} else {
				var pickableTiles = this.game.middle.filter(t => t.colour != 5);
				var pickedTile = pickableTiles[Math.floor(Math.random()*pickableTiles.length)];
				this.pick(pickedTile.colour, pickedZone, -1);
			}
			this.isTurn = false;
			this.timedOut = true;
			this.resetTimer();
			this.game.next();
		}
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
			if (picked.filter(p => p.colour != 5).length == 0) {
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

		if (!this.game.replayMode) {
			database.InsertCommandRecord(this.game.gameRecordId, this.id, {
				colour: colour,
				zone: zone,
				destination, destination
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
			} else {
			 	this.game.moveTile(tile, 'middle');
			}
		}
		if (this.score < 0) {
			this.score = 0;
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