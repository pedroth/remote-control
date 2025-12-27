# remote-control

## Description

Remote control your computer using the remote-control server. This server enables you to control your computer from your phone. The project was initially created to control a Raspberry Pi connected to a TV via mobile device.

![Remote Control Demo](./remote-control.webp)

## Usage

1. Install [bun.js](https://bun.sh/) if you haven't already.
2. git clone this repository.
3. Navigate to the project directory.
4. Run `bun install` to install dependencies.
5. Mobile Setup:
    - Ensure your mobile device is connected to the same network as the server.
5. Start the server:
    - For HTTP: `bun server.mjs`
    - For HTTPS with self-signed certificates: `bun server.mjs -s`
6. The default browser will open with a QR code.
7. Scan it with your mobile device to access the remote control UI.


