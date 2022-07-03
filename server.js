import http from 'http';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Expo } from 'expo-server-sdk';

//* server states: online | offline | waiting | error
const State = {
	name: '',
	state: '',
	ping: 0,
	rssi: 0,
};
let nodeConnected = false;

const expo = new Expo();
const app = express();
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });

httpServer.listen(process.env.PORT || 5000, () => console.log(`Server listening on port ${process.env.PORT || 5000}`));

app.use(cors({ origin: '*' }));

let pushToken = '';

wss.on('connection', (socket) => {
	console.log('client connected');
	socket.on('message', (message) => {
		const payload = JSON.parse(message);
		//* data types: connected | event | state | pushToken
		//* events: server_on | server_off | boot_error
		switch (payload.type) {
			case 'connected':
				if (payload.from === 'node') {
					//*  node connected
					State.name = payload.data;
					socket.node = true;
					nodeConnected = true;
					sendEventNotif(pushToken, 'NodeMCU Online');
				}
				break;
			case 'state':
				if (payload.from === 'node') {
					State.state = payload.serverState;
					State.ping = parseInt(payload.ping);
					State.rssi = parseInt(payload.rssi);
					wss.clients.forEach((client) => {
						if (!client.node) {
							client.send(JSON.stringify({ type: 'state', data: State }));
						}
					});
				}
				break;
			case 'event':
				if (payload.from === 'node') {
					console.log(`Event: ${payload.data}`);
					switch (payload.data) {
						case 'server_on':
							sendEventNotif(pushToken, 'Server Online');
							break;
						case 'server_off':
							sendEventNotif(pushToken, 'Server Offline');
							break;
						case 'boot_error':
							sendEventNotif(pushToken, 'Server Boot Error');
							break;
						default:
							break;
					}
				}
				break;
			case 'pushToken':
				console.log(`Push Token Registred: ${payload.token}`);
				pushToken = payload.token;
				break;
		}
	});

	socket.on('close', () => {
		console.log('client disconnected');
		if (socket.node) {
			nodeConnected = false;
			sendEventNotif(pushToken, 'NodeMCU Offline');
		}
	});
});

app.post('/on', (req, res) => {
	wss.clients.forEach((client) => {
		if (client.node) {
			client.send(JSON.stringify({ type: 'power', data: 'on' }));
		}
	});
	res.sendStatus(200);
});

app.post('/test-notif', async (req, res) => {
	try {
		sendEventNotif(pushToken, 'Test Notification');
		res.sendStatus(200);
	} catch (error) {
		console.log(error);
		res.sendStatus(500);
	}
});

const sendEventNotif = async (token, title) => {
	if (!Expo.isExpoPushToken(token)) {
		console.error(`Push token ${token} is not a valid Expo push token`);
		return;
	}

	await expo.sendPushNotificationsAsync([
		{
			to: token,
			title: title,
			sound: 'default',
		},
	]);
};
