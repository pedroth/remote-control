
import express from 'express';
import { createServer } from 'https';
import { readFileSync } from 'fs';
import open from 'open';
import ip from 'ip';
import path from 'path';
import robot from '@jitsi/robotjs';
import { cwd } from "process";
import { WebSocketServer } from 'ws';

const app = express();

// 2. Load the certificate files you just generated
const httpsOptions = {
    key: readFileSync('key.pem'),
    cert: readFileSync('cert.pem')
};

class mySocket {
    constructor(httpsServer) {
        this.wss = new WebSocketServer({ server: httpsServer });
        this.eventMap = new Map();
    }

    on(event, callback) {
        this.eventMap.set(event, callback);
        return this;
    }

    init() {
        this.wss.on('connection', (ws) => {
            this.setupListeners(ws);
        });
    }

    setupListeners(ws) {
        ws.on('message', async (msg) => {
            let parsed;
            try {
                parsed = JSON.parse(msg);
            } catch (e) {
                console.error('Invalid message:', msg);
                return;
            }
            const { event, data } = parsed;
            if (this.eventMap.has(event)) {
                this.eventMap.get(event)(data);
            } else {
                console.log('Unknown event:', event);
            }
        });
    }


}

// 3. Create an HTTPS server instead of HTTP

const httpsServer = createServer(httpsOptions, app);
const wss = new mySocket(httpsServer);

const PORT = 3000;
const LOCAL_IP = ip.address();


// Get current file directory in any environment
const __dirname = cwd();
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR));

app.get('/config', (req, res) => {
    // 4. Update protocol to HTTPS
    res.json({
        hostUrl: `https://${LOCAL_IP}:${PORT}/index.html`
    });
});


wss.on('cmd_goto', async (data) => {
    let url = data;
    if (!url.startsWith('http')) url = 'https://' + url;
    await open(url);
});
wss.on('cmd_mouse_move', async (data) => {
    try {
        const mouse = robot.getMousePos();
        const speed = 2.0;
        robot.moveMouse(mouse.x + (data.x * speed), mouse.y + (data.y * speed));
    } catch (e) { }
});
wss.on('cmd_mouse_click', async (data) => {
    try { robot.mouseClick(data); } catch (e) { }
});
wss.on('cmd_mouse_down', async (data) => {
    try { robot.mouseToggle('down', data); } catch (e) { }
});
wss.on('cmd_mouse_up', async (data) => {
    try { robot.mouseToggle('up', data); } catch (e) { }
});
wss.on('cmd_type', async (data) => {
    try { robot.typeString(data); robot.keyTap("enter"); } catch (e) { }
});
wss.on('cmd_scroll', async (data) => {
    try { 
        const speed = 1;
        robot.scrollMouse(0, data.amount * speed);
    } catch (e) { }
});
wss.init();

// 5. Listen using the httpsServer
httpsServer.listen(PORT, () => {
    console.log(`\n--- SECURE REMOTE CONTROL ---`);
    console.log(`Address: https://${LOCAL_IP}:${PORT}/qr.html`);
    console.log(`Note: You will still see a 'Not Secure' warning in the browser.`);
    console.log(`      Click 'Advanced' -> 'Proceed' to allow the Camera.`);
    // launch browser automatically
    open(`https://${LOCAL_IP}:${PORT}/qr.html`);
});
