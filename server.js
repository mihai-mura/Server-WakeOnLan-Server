import http from 'http';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';

//* server states: online | offline | waiting | error
const State = {
	name: '',
	state: '',
	ping: 0,
	rssi: 0,
};
let nodeConnected = false;

const app = express();
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });

httpServer.listen(5000, () => console.log('Server listening on port 5000'));

app.use(cors({ origin: '*' }));

wss.on('connection', (socket) => {
	console.log('client connected');
	socket.on('message', (message) => {
		const payload = JSON.parse(message);
		//* data types: connected | event | ping | rssi | state
		//* events: server_on | server_off | boot_error
		switch (payload.type) {
			case 'connected':
				if (payload.from === 'node') {
					//*  node connected
					socket.node = true;
					nodeConnected = true;
					State.name = payload.data;
				}
				break;
			case 'state':
				if (payload.from === 'node') {
					State.state = payload.serverState;
					State.ping = payload.ping;
					State.rssi = payload.rssi;
				}
				break;
			case 'event':
				if (payload.from === 'node') {
					console.log(`Event: ${payload.data}`);
				}
		}
		console.log(State);
	});
});

app.post('/server/on', (req, res) => {
	wss.clients.forEach((client) => {
		if (client.node) {
			client.send(JSON.stringify({ type: 'power', data: 'on' }));
		}
	});
	res.sendStatus(200);
});
