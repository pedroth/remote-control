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
8. To enable the mobile debug console on the controller page, open the URL with `?debug`, for example `http://<server-ip>:3000/index.html?debug`.

## Building executables

- For Windows: `bun run build-windows`
- For Linux: `bun run build-linux`
- For macOS: `bun run build-macos`

## GitHub Releases

Each push to `main`, including merges, triggers GitHub Actions to build release bundles for Linux, macOS, and Windows.

- Release tags and release names use the version from `package.json`, for example `v0.0.11`.
- Assets are published as platform-specific archives containing the executable and the required `public/` files.

> Before merging to `main`, do `bun run pub`, to update package.json and package-lock.json with the new version. The GitHub Actions workflow will then use this version to create the release.
