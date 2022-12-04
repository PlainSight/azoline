var sql = require('sqlite3');
var db = new sql.Database('azul.db');

var SetupDatabase = function() {
	db.exec(`
		CREATE TABLE IF NOT EXISTS game (game_id INTEGER PRIMARY KEY, completed_date TEXT, code TEXT);
		CREATE TABLE IF NOT EXISTS player_score (player_score_id INTEGER PRIMARY KEY, player_name TEXT, player_score INTEGER, game_id INTEGER);
	`);
};

var RecordGame = function(code, players) {
	db.run(`
		INSERT INTO game (completed_date, code) VALUES (datetime(), $code);
	`, {
		$code: code
		}, function(err) {
		console.log(this.lastID);
		var gameRecordId = this.lastID;

		players.forEach(p => {
			db.run(`
				INSERT INTO player_score (player_name, player_score, game_id) VALUES ($name, $score, $game)
			`, {
				$name: p.name,
				$score: p.score,
				$game: gameRecordId
			});
		});
	});
};

var ReadGameHistory = function(cb) {
	db.all(`
		SELECT g.game_id, g.completed_date, g.code, ps.player_name, ps.player_score
		FROM game g
		INNER JOIN player_score ps on ps.game_id = g.game_id
		ORDER BY g.game_id DESC;
	`, function(err, rows) {
		console.log(err, rows);
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
    RecordGame,
	ReadGameHistory,
	SetupDatabase
}