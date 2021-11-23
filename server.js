var ws = require('ws');
var game = require('./game');

const wss = new ws.Server({ port: 7777 });

const ALPHANUMERIC = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

var clients = {};

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
            } else {
                clients[cookie] = client;
            }
            client.send = function(message) {
                if (client.ws.readyState === ws.OPEN && client.isConnected) {
                    client.ws.send(JSON.stringify(message));
                }
            }
            client.send({ type: 'cookie', data: { cookie: cookie }});
            break;
        case 'chat': // chat
            if (client.player) {
                client.player.chat(message.data);
            }
            break;
        case 'name':    // client sets their name
            client.name = message.data;
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
