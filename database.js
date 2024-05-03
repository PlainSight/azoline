var sql = require('sqlite3');
var db = new sql.Database('azul.db');

var SetupDatabase = function() {
	var lines = `CREATE TABLE IF NOT EXISTS game (game_id INTEGER PRIMARY KEY, completed_date TEXT, code TEXT);
		CREATE TABLE IF NOT EXISTS player_score (player_score_id INTEGER PRIMARY KEY, player_name TEXT, player_score INTEGER, game_id INTEGER);
		CREATE TABLE IF NOT EXISTS action (action_id INTEGER PRIMARY KEY, time TEXT, game_id INTEGER, player_id TEXT, command TEXT);
		ALTER TABLE player_score ADD COLUMN player_id TEXT;
		ALTER TABLE game ADD COLUMN seed INTEGER;`.split('\n');
	lines.forEach(l => {
		db.exec(l, (err) => console.log(err));
	})
};

var InsertCommandRecord = function(gameRecordId, playerId, command) {
	db.run(`
		INSERT INTO action (game_id, time, player_id, command) VALUES ($game, datetime(), $playerId, $command)
	`, {
		$game: gameRecordId,
		$command: JSON.stringify(command),
		$playerId: playerId
	});
}

var CreateGameRecord = function(code, seed, players, game) {
	db.run(`
		INSERT INTO game (completed_date, seed, code) VALUES (datetime(), $seed, $code);
	`, {
		$code: code,
		$seed: seed
		}, function(err) {
		var gameRecordId = this.lastID;
		game.gameRecordId = gameRecordId;

		players.forEach(p => {
			db.run(`
				INSERT INTO player_score (player_name, player_id, player_score, game_id) VALUES ($name, $playerId, $score, $game)
			`, {
				$name: p.name,
				$score: p.score,
				$playerId: p.id,
				$game: gameRecordId
			});
		});
	});
}

var UpdateGameRecord = function(gameRecordId, players) {
	players.forEach(p => {
		db.run(`
			UPDATE player_score
			SET player_score = $score
			WHERE game_id = $game AND player_id = $player_id
		`, {
			$player_id: p.id,
			$score: p.score,
			$game: gameRecordId
		});
	});
}

var ReadGameHistory = function(cb) {
	db.all(`
		SELECT g.game_id, g.completed_date, g.code, ps.player_name, ps.player_score, ga.game_id is not null as has_replay
		FROM game g
		INNER JOIN player_score ps on ps.game_id = g.game_id
		LEFT JOIN (
			SELECT a.game_id
			FROM action a
			GROUP BY a.game_id
		) ga on ga.game_id = g.game_id
		ORDER BY g.game_id DESC, ps.player_score_id ASC;
	`, function(err, rows) {
		var games = rows.reduce((a, c) => {
			a[c.game_id] = a[c.game_id] || {
				id: c.game_id,
				completed: c.completed_date,
				code: c.code,
				players: [],
				hasReplay: c.has_replay > 0
			};
			a[c.game_id].players.push({ name: c.player_name, score: c.player_score });
			return a;
		}, {});
		cb(Object.values(games).sort((a, b) => b.id - a.id ));
	});
}

var ReadGameCommands = function(cb, gameRecordId) {
	db.all(`
		SELECT g.game_id, g.completed_date, g.code, g.seed, ps.player_id, ps.player_name, ps.player_score, ga.game_id is not null as has_replay
		FROM game g
		INNER JOIN player_score ps on ps.game_id = g.game_id
		LEFT JOIN (
			SELECT a.game_id
			FROM action a
			GROUP BY a.game_id
		) ga on ga.game_id = g.game_id
		WHERE g.game_id = $game
		ORDER BY g.game_id DESC;
	`, {
		$game: gameRecordId
	},
	function(err, rows) {
		var res = rows.reduce((a, c) => {
			a[c.game_id] = a[c.game_id] || {
				id: c.game_id,
				completed: c.completed_date,
				code: c.code,
				seed: c.seed,
				players: [],
				hasReplay: c.has_replay > 0
			};
			a[c.game_id].players.push({ id: c.player_id, name: c.player_name, score: c.player_score });
			return a;
		}, {});
		var game = Object.values(res)[0];

		if (!game) {
			cb(null);
			return;
		}
		
		if (game.hasReplay) {
			db.all(`
				SELECT *
				FROM action a
				WHERE a.game_id = $game
				ORDER BY a.action_id ASC
			`, {
				$game: gameRecordId
			}, function (err, rows) {
				//(action_id INTEGER PRIMARY KEY, time TEXT, game_id INTEGER, player_id TEXT, command TEXT);
				game.actions = rows.map(r => {
					return {
						id: r.action_id,
						time: r.time,
						playerId: r.player_id,
						command: JSON.parse(r.command)
					};
				});

				cb(game);
			});
		}
	});
}

module.exports = {
	CreateGameRecord,
    UpdateGameRecord,
	InsertCommandRecord,
	ReadGameHistory,
	ReadGameCommands,
	SetupDatabase
}