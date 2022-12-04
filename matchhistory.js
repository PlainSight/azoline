var endpoint = 'http://localhost:7798';
//var endpoint = '/azulscore';

fetch(endpoint).then(response => {
    return response.json();
}).then(scores => {
    var element = document.getElementById('scores');

    scores.forEach(s => {
        var date = document.createElement('div');
        date.innerHTML = (new Date(s.completed+'Z')).toLocaleString();
        date.classList.add('date');

        var code = document.createElement('div');
        code.innerHTML = s.code;
        code.classList.add('code');

        var dateCode = document.createElement('div');
        dateCode.classList.add('datecode');
        dateCode.appendChild(date);
        dateCode.appendChild(code);

        var game = document.createElement('div');
        game.classList.add('game');
        game.appendChild(dateCode);
        s.players.sort((a, b) => b.score - a.score).forEach(p => {
            var player = document.createElement('div');
            player.classList.add('player');
            player.innerHTML = '<div class="number">'+ p.score +'</div><div class="name">' + p.name + '</div>';
            game.appendChild(player);
        })
        element.appendChild(game);
    })
});