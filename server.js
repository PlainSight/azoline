var ws = require('ws');
var game = require('./game');

const wss = new ws.Server({ port: 7777 });

const ALPHANUMERIC = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

var clients = [];

function broadcast(m) {
    clients.forEach(c => {
        if (c.ws.readyState === ws.OPEN && c.isConnected) {
            c.ws.send(JSON.stringify(m));
        }
    });
}

function send(m, c) {
    if (c.ws.readyState === ws.OPEN && c.isConnected) {
        c.ws.send(JSON.stringify(m));
    }
}

function parseMessage(m, client) {
    var message = JSON.parse(m);
    switch (message.type) {
        case 'connection': // connection when the player opens the page - if they don't have an id we give them an id, also give them faction
            var id = message.data;
            var faction = 0;
            if (id == null) {
                // generate an id
                id = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map(() => { return ALPHANUMERIC[Math.floor(Math.random()*ALPHANUMERIC.length)] }).join('');
                
            }
            client.id = id;
            if (factionMap[id]) {
                faction = factionMap[id];
            } else {
                faction = nextFaction;
                factionMap[id] = faction;
                nextFaction++;
            }
            client.faction = faction;
            send({ type: 'faction', data: { faction: faction, id: id }}, client);
            console.log('player with faction ', faction, 'joined');
            var alive = pieces.filter(p => p.faction == faction && p.type == 5).length > 0;
            if (!alive) {
                // spawn some pieces for them
                pieces.filter(p => p.faction == faction).forEach(p => { 
                    p.kill = true;
                });
                var spawn = spawnFactionPieces(faction);
                console.log('spawning new player at', spawn);
                send({ type: 'spawn', data: { spawnX: spawn.x, spawnY: spawn.y }}, client);
            } else {
                // send position of king
                var king = pieces.filter(p => p.faction == faction && p.type == 5)[0];
                send({ type: 'spawn', data: { spawnX: king.x, spawnY: king.y, tickTime: tickTime }}, client);
            }
            break;
        case 'chat': // chat
            messages.push((client.name || client.faction) + ': ' + message.data);
            break;
        case 'name':    // client sets their name
            client.name = message.data;
            break;
        case 'start':   // client wants to start, this spawns then units (or if they already have some gives them control) - dont do for now
            break;
        case 'command':
            // validate faction
            var good = pieces.filter(p => p.id == message.data.piece && p.faction == client.faction).length > 0;
            if (good) {
                actions.push({ piece: message.data.piece, move: message.data.move });
            }
            break;
    }

}

wss.on('connection', function connection(ws) {
    ws.client = { ws: ws, faction: null, name: null, isConnected: true };
    clients.push(ws.client);
    ws.on('message', function incoming(message) {
        parseMessage(message, ws.client);
    });
    ws.on('close', () => {
        ws.client.isConnected = false;
        clients = clients.filter(c => c.isConnected);
    });
});

//broadcast({ type: 'chat', data: messages });


    //     var worldStateMessage = {
    //         type: 'state',
    //         data: {
    //             chunks: Object.values(chunksForClient),
    //             pieces: piecesForClient,
    //             objects: objectsForClient,
    //             tick: currentTick
    //         }
    //     }
    //     send(worldStateMessage, client)
    // }

    

    // respawn dead players
    clients.forEach(c => {
        if (c.ws.readyState === ws.OPEN && c.isConnected) {
            var alive = pieces.filter(p => p.faction == c.faction && p.type == 5 && !p.kill).length > 0;
            if (!alive) {
                pieces.filter(p => p.faction == c.faction).forEach(p => { 
                    p.kill = true;
                });
                var spawn = spawnFactionPieces(c.faction);
                console.log('spawning dead player', c.faction, 'at', spawn);
                send({ type: 'spawn', data: { spawnX: spawn.x, spawnY: spawn.y }}, c);
            }
        }
    });
