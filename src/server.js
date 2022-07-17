import http from 'http';
import cors from 'cors';
import express from 'express';
import { WebSocketServer } from 'ws';
import { Expo } from 'expo-server-sdk';

const expo = new Expo();
const app = express();
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer });

httpServer.listen(process.env.PORT || 5000, () => console.log(`Server listening on port ${process.env.PORT || 5000}`));

app.use(cors({ origin: '*' }));

const NodesPower = {
	proxmox: false,
	mainLight: false,
};

//* server states: online | offline | waiting | error
const ProxmoxState = {
	name: '',
	state: '',
	ping: 0,
	rssi: 0,
};

let pushToken = '';

wss.on('connection', (socket) => {
	socket.on('message', (message) => {
		const payload = JSON.parse(message);
		//* data types: connected | event | state | pushToken
		//* proxmox events: server_on | server_off | boot_error
		switch (payload.type) {
			case 'register-node-mcu': {
				socket.node = true;
				switch (payload.sender) {
					case 'node-proxmox':
						console.log('proxmox connected');
						NodesPower.proxmox = true;
						socket.node_proxmox = true;
						ProxmoxState.name = payload.data;
						wss.clients.forEach((client) => {
							if (!client.node) {
								client.send(JSON.stringify({ type: 'node-state', state: 'on' }));
							}
						});
						sendEventNotif(pushToken, 'NodeMCU Online');
						break;
					case 'node-main-light':
						console.log('main light connected');
						socket.node_main_light = true;
						break;
				}
				break;
			}
			case 'pushToken':
				console.log(`Push Token Registred: ${payload.token}`);
				pushToken = payload.token;
				break;

			case 'state':
				if (payload.sender === 'node-proxmox') {
					ProxmoxState.state = payload.serverState;
					ProxmoxState.ping = parseInt(payload.ping);
					ProxmoxState.rssi = parseInt(payload.rssi);
					wss.clients.forEach((client) => {
						if (!client.node) {
							client.send(JSON.stringify({ type: 'state', data: ProxmoxState }));
						}
					});
				}
				break;

			case 'event':
				if (payload.sender === 'node-proxmox') {
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
		}
	});

	socket.on('close', () => {
		console.log('client disconnected');
		if (socket.node_proxmox) {
			setTimeout(() => {
				if (!NodesPower.proxmox) {
					NodesPower.proxmox = false;
					wss.clients.forEach((client) => {
						if (!client.node) {
							client.send(JSON.stringify({ type: 'node-state', state: 'off' }));
						}
					});
					sendEventNotif(pushToken, 'NodeMCU Offline');
				}
			}, 10000);
		}
	});
});

//----------------------------------------------------------------------------------------------------------------------
//* Proxmox

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

app.post('/proxmox/on', (req, res) => {
	wss.clients.forEach((client) => {
		if (client.node_proxmox) {
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

//----------------------------------------------------------------------------------------------------------------------
//* Main Light

app.post('/main-light/:action', async (req, res) => {
	try {
		switch (req.params.action) {
			case 'power':
				wss.clients.forEach((client) => {
					if (client.node_main_light) {
						client.send(JSON.stringify({ action: 'power' }));
					}
				});
				break;
			case 'night-mode':
				wss.clients.forEach((client) => {
					if (client.node_main_light) {
						client.send(JSON.stringify({ action: 'night-mode' }));
					}
				});
				break;
			case 'brightness-up':
				wss.clients.forEach((client) => {
					if (client.node_main_light) {
						client.send(JSON.stringify({ action: 'brightness-up' }));
					}
				});
				break;
			case 'brightness-down':
				wss.clients.forEach((client) => {
					if (client.node_main_light) {
						client.send(JSON.stringify({ action: 'brightness-down' }));
					}
				});
				break;
			case 'switch-temp':
				wss.clients.forEach((client) => {
					if (client.node_main_light) {
						client.send(JSON.stringify({ action: 'switch-temp' }));
					}
				});
				break;
			case 'timer':
				wss.clients.forEach((client) => {
					if (client.node_main_light) {
						client.send(JSON.stringify({ action: 'timer' }));
					}
				});
				break;
			case 'cold':
				wss.clients.forEach((client) => {
					if (client.node_main_light) {
						client.send(JSON.stringify({ action: 'cold' }));
					}
				});
				break;
			case 'warm':
				wss.clients.forEach((client) => {
					if (client.node_main_light) {
						client.send(JSON.stringify({ action: 'warm' }));
					}
				});
				break;
			default:
				return res.sendStatus(400);
		}
		res.sendStatus(200);
	} catch (error) {
		console.log(error);
		res.sendStatus(500);
	}
});
