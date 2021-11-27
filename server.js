var ws = require('ws');
var game = require('./game');

const wss = new ws.Server({ port: 7777 });

const ALPHANUMERIC = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

var clients = {};
var games = {};

function parseMessage(m, client) {
    var message = JSON.parse(m);
    switch (message.type) {
        case 'connection': // connection when the player opens the page - if they don't have an id we give them an id, also give them faction
            var cookie = message.data;
            if (cookie == null) {
                // generate an id
                cookie = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0].map(() => { return ALPHANUMERIC[Math.floor(Math.random()*ALPHANUMERIC.length)] }).join('');
                
            }
            client.cookie = cookie;
            if (clients[cookie]) {
                clients[cookie].ws = client.ws;
                client = clients[cookie];
                client.isConnected = true;
                client.ws.client = client;
            } else {
                clients[cookie] = client;
            }
            client.send = function(message) {
                if (client.ws.readyState === ws.OPEN && client.isConnected) {
                    client.ws.send(JSON.stringify(message));
                }
            }
            client.send({ type: 'cookie', data: { cookie: cookie }});
            if (!client.player) {
                client.send({ type: 'nameplease' });
            } else {
                if (client.player.game) {
                    client.player.state();
                } else {
                    client.send({ type: 'codeplease' });
                }
            }
            break;
        case 'chat': // chat
            if (client.player) {
                client.player.chat(message.data);
            }
            break;
        case 'start': 
            if (client.player) {
                client.player.startGame();
            }
            break;
        case 'name':    // client sets their name
            client.name = message.data;
            break;
        case 'join':
            // either enter them into a game or start a new game
            var gameCode = message.data;
            var newPlayer = new game.Player(client);
            if (games[gameCode]) {
                if (!games[gameCode].addPlayer(newPlayer)) {
                    client.send({ type: 'text', data: 'Game already in progress please enter another code.' });
                    client.send({ type: 'codeplease' });
                }
            } else {
                games[gameCode] = new game.Game(gameCode, newPlayer);
            }
            break;
        case 'command':
            if (client.player) {
                client.player.command(message.data);
            }
            break;
    }

}

wss.on('connection', function connection(ws) {
    ws.client = { ws: ws, isConnected: true };
    ws.on('message', function incoming(message) {
        parseMessage(message, ws.client);
    });
    ws.on('close', () => {
        if (ws.player) {
            ws.client.isConnected = false;
        }
    });
});