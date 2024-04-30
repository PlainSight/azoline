var endpoint = 'http://localhost:7798';
//var endpoint = '/azulscore';

fetch(endpoint).then(response => {
    return response.json();
}).then(scores => {
    var element = document.getElementById('scores');

    scores.forEach(s => {
        var date = document.createElement('div');
        var completed = new Date(s.completed+'Z');
        date.innerHTML = (new Date(s.completed+'Z')).toLocaleString('en-NZ');
        date.classList.add('date');

        var code = document.createElement('div');
        code.innerHTML = s.code;
        code.classList.add('code');

        var replayLink = document.createElement('a');
        replayLink.innerHTML = 'Replay';
        replayLink.href = 'client.html?gameId=' + s.id;
        replayLink.classList.add('replayLink');

        var dateCode = document.createElement('div');
        dateCode.classList.add('datecode');
        dateCode.appendChild(date);
        dateCode.appendChild(code);
        if (s.hasReplay) {
            dateCode.appendChild(replayLink);
        }

        var game = document.createElement('div');
        game.classList.add('game');
        game.appendChild(dateCode);
        s.players.map((p, pi) => { return { ...p, order: pi }}).sort((a, b) => b.score - a.score).forEach(p => {
            var player = document.createElement('div');
            player.classList.add('player');
            player.innerHTML = '<div class="number">'+ p.score +'</div><div class="name">' + p.name + '</div>';
            if (completed > new Date('2023-03-12 10:30Z')) {
                player.innerHTML += '<div class="order">' + 'order: ' + (p.order+1) + '</div>';
            }
            game.appendChild(player);
        })
        element.appendChild(game);
    })
});