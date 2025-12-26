import express from "express";
import { createServer as createHttpsServer } from "https";
import { createServer as createHttpServer } from "http";
import { readFileSync, existsSync } from "fs";
import { promises as fsPromises } from "fs"; // Used for checking file stats
import open from "open";
import ip from "ip";
import path from "path";
import robot from "@jitsi/robotjs";
import { cwd } from "process";
import { WebSocketServer } from "ws";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

class mySocket {
    constructor(server) {
        this.wss = new WebSocketServer({ server });
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

        const keyPath = "key.pem";
        const certPath = "cert.pem";

        // Check if files exist
        const keyExists = existsSync(keyPath);
        const certExists = existsSync(certPath);

        // Check if files are empty
        let keyEmpty = !keyExists;
        let certEmpty = !certExists;

        if (keyExists) {
            const keyStat = await fsPromises.stat(keyPath);
            keyEmpty = keyStat.size === 0;
        }
        if (certExists) {
            const certStat = await fsPromises.stat(certPath);
            certEmpty = certStat.size === 0;
        }

        if (keyEmpty || certEmpty) {
            console.log("Generating self-signed certificates...");

            try {
                // Replaced Bun Shell `$` with Node `exec`
                await execAsync('openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"');
                console.log("Self-signed certificates generated.");
            } catch (error) {
                console.error("Failed to generate self-signed certificates:");
                console.error(error.message);
                process.exit(1);
            }
        }
    }

    const app = express();
    
    // Node requires different factories for HTTP vs HTTPS
    let httpServer; 
    
    if (isSelfSigned) {
        const httpsOptions = {
            key: readFileSync("key.pem"),
            cert: readFileSync("cert.pem"),
        };
        httpServer = createHttpsServer(httpsOptions, app);
    } else {
        httpServer = createHttpServer(app);
    }

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
                const testServer = isSelfSigned
                    ? createHttpsServer(
                          {
                              key: readFileSync("key.pem"),
                              cert: readFileSync("cert.pem"),
                          },
                          app
                      )
                    : createHttpServer(app);

                testServer.listen(port, () => {
                    console.log(`✓ Port ${port} is available`);
                    testServer.close(() => {
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
    PORT = availablePort;
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