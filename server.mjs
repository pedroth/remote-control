import express from "express";
import { createServer } from "https";
import { readFileSync } from "fs";
import open from "open";
import ip from "ip";
import path from "path";
import robot from "@jitsi/robotjs";
import { cwd } from "process";
import { WebSocketServer } from "ws";
import { $ } from "bun";

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
        this.wss.on("connection", (ws) => {
            this.setupListeners(ws);
        });
    }

    setupListeners(ws) {
        ws.on("message", async (msg) => {
            let parsed;
            try {
                parsed = JSON.parse(msg);
            } catch (e) {
                console.error("Invalid message:", msg);
                return;
            }
            const { event, data } = parsed;
            if (this.eventMap.has(event)) {
                this.eventMap.get(event)(data);
            } else {
                console.log("Unknown event:", event);
            }
        });
    }
}

// main server logic
(async () => {
    const isSelfSigned = process.argv.includes("-s");
    if (isSelfSigned) {
        console.log("Using self-signed certificates for HTTPS.");

        const keyFile = Bun.file("key.pem");
        const certFile = Bun.file("cert.pem");

        const keyExists = await keyFile.exists();
        const certExists = await certFile.exists();

        const keyEmpty = !keyExists || (await keyFile.text()).trim().length === 0;
        const certEmpty = !certExists || (await certFile.text()).trim().length === 0;

        if (keyEmpty || certEmpty) {
            console.log("Generating self-signed certificates...");

            const result = await $`openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"`.quiet();

            if (result.exitCode !== 0) {
                console.error("Failed to generate self-signed certificates:");
                console.error(result.stderr?.toString());
                process.exit(1);
            }

            console.log("Self-signed certificates generated.");
        }
    }

    const app = express();
    const httpsOptions = isSelfSigned
        ? {
                key: readFileSync("key.pem"),
                cert: readFileSync("cert.pem"),
            }
        : {};

    const httpServer = createServer(httpsOptions, app);
    const wss = new mySocket(httpServer);

    let PORT = 3000;
    const LOCAL_IP = ip.address();
    const __dirname = cwd();
    const PUBLIC_DIR = path.join(__dirname, "public");

    app.use(express.static(PUBLIC_DIR));

    app.get("/config", (req, res) => {
        res.json({
            hostUrl: `http${isSelfSigned ? "s" : ""}://${LOCAL_IP}:${availablePort}/index.html`,
        });
    });

    wss.on("cmd_goto", async (data) => {
        await open(data);
    });

    wss.on("cmd_mouse_move", async (data) => {
        try {
            const mouse = robot.getMousePos();
            const speed = 2.0;
            robot.moveMouse(mouse.x + data.x * speed, mouse.y + data.y * speed);
        } catch (e) {}
    });

    wss.on("cmd_mouse_click", async (data) => {
        try {
            robot.mouseClick(data);
        } catch (e) {
            console.error(e);
        }
    });

    wss.on("cmd_mouse_down", async (data) => {
        try {
            robot.mouseToggle("down", data);
        } catch (e) {
            console.error(e);
        }
    });

    wss.on("cmd_mouse_up", async (data) => {
        try {
            robot.mouseToggle("up", data);
        } catch (e) {
            console.error(e);
        }
    });

    wss.on("cmd_type", async (data) => {
        try {
            console.log("Typing:", data);
            robot.typeString(data);
        } catch (e) {
            console.error(e);
        }
    });

    wss.on("cmd_scroll", async (data) => {
        try {
            const speed = 1;
            robot.scrollMouse(0, data.amount * speed);
        } catch (e) {
            console.error(e);
        }
    });

    wss.on("cmd_key_tap", (key) => {
        try {
            console.log("Key tap:", key);
            robot.keyTap(key);
        } catch (e) {
            console.error(e);
        }
    });

    wss.init();

    // Function to find an available port
    const findAvailablePort = (startPort) => {
        return new Promise((resolve) => {
            const tryPort = (port) => {
                const server = createServer(httpsOptions, app);
                server.listen(port, () => {
                    console.log(`✓ Port ${port} is available`);
                    server.close(() => {
                        resolve(port);
                    });
                }).on("error", (err) => {
                    if (err.code === "EADDRINUSE") {
                        console.log(`✗ Port ${port} is in use, trying port ${port + 1}...`);
                        tryPort(port + 1);
                    } else {
                        console.error("Server error:", err);
                    }
                });
            };
            tryPort(startPort);
        });
    };

    const availablePort = await findAvailablePort(PORT);
    console.log(`Starting server on port ${availablePort}...`);

    httpServer.listen(availablePort, () => {
        const protocol = isSelfSigned ? "https" : "http";
        console.log(`✓ Server started successfully!`);
        console.log(`Address: ${protocol}://${LOCAL_IP}:${availablePort}/qr.html`);
        open(`${protocol}://${LOCAL_IP}:${availablePort}/qr.html`);
    }).on("error", (err) => {
        console.error(`✗ Failed to start server on port ${availablePort}:`, err.message);
        process.exit(1);
    });
})();
