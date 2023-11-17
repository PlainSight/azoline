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
	console.log(gameRecordId, command);
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
		console.log(gameRecordId, game.gameRecordId);
		game.gameRecordId = gameRecordId;
		console.log(game.gameRecordId);

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
		SELECT g.game_id, g.completed_date, g.code, ps.player_name, ps.player_score
		FROM game g
		INNER JOIN player_score ps on ps.game_id = g.game_id
		ORDER BY g.game_id DESC;
	`, function(err, rows) {
		var games = rows.reduce((a, c) => {
			a[c.game_id] = a[c.game_id] || {
				id: c.game_id,
				completed: c.completed_date,
				code: c.code,
				players: []
			};
			a[c.game_id].players.push({ name: c.player_name, score: c.player_score });
			return a;
		}, {});
		cb(Object.values(games).sort((a, b) => b.id - a.id ));
	});
}

module.exports = {
	CreateGameRecord,
    UpdateGameRecord,
	InsertCommandRecord,
	ReadGameHistory,
	SetupDatabase
}