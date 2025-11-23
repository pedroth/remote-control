import express from 'express';
// 1. Import HTTPS and FileSystem (fs)
import { createServer } from 'https';
import { readFileSync } from 'fs';
import { Server } from 'socket.io';
import open from 'open';
import ip from 'ip';
import path from 'path';
import robot from '@jitsi/robotjs';
import { cwd } from "process";

const app = express();

// 2. Load the certificate files you just generated
const httpsOptions = {
    key: readFileSync('key.pem'),
    cert: readFileSync('cert.pem')
};

// 3. Create an HTTPS server instead of HTTP
const httpsServer = createServer(httpsOptions, app);
const io = new Server(httpsServer);

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

io.on('connection', (socket) => {
    console.log(`Device connected: ${socket.id}`);

    socket.on('cmd_goto', async (url) => {
        if (!url.startsWith('http')) url = 'https://' + url;
        await open(url);
    });

    socket.on('cmd_mouse_move', (data) => {
        try {
            const mouse = robot.getMousePos();
            const speed = 2.0;
            robot.moveMouse(mouse.x + (data.x * speed), mouse.y + (data.y * speed));
        } catch (e) { }
    });

    socket.on('cmd_mouse_click', (btn) => {
        try { robot.mouseClick(btn); } catch (e) { }
    });

    socket.on('cmd_mouse_down', (btn) => {
        try { robot.mouseToggle('down', btn); } catch (e) { }
    });

    socket.on('cmd_mouse_up', (btn) => {
        try { robot.mouseToggle('up', btn); } catch (e) { }
    });

    socket.on('cmd_type', (text) => {
        try { robot.typeString(text); robot.keyTap("enter"); } catch (e) { }
    });

    socket.on('cmd_scroll', (data) => {
        try {
            const speed = 1;
            robot.scrollMouse(0, data.amount * speed);
        } catch (e) { }
    });

});

// 5. Listen using the httpsServer
httpsServer.listen(PORT, () => {
    console.log(`\n--- SECURE REMOTE CONTROL ---`);
    console.log(`Address: https://${LOCAL_IP}:${PORT}/qr.html`);
    console.log(`Note: You will still see a 'Not Secure' warning in the browser.`);
    console.log(`      Click 'Advanced' -> 'Proceed' to allow the Camera.`);
    // launch browser automatically
    open(`https://${LOCAL_IP}:${PORT}/qr.html`);
});
