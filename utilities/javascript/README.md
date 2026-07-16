# Fate's Edge Toolkit v4.0.0a — with Campaign Sharing Server

**Fate's Edge** is a narrative‑first TTRPG system. This repository provides a complete **web‑based toolkit** for running and playing the game, plus a **self‑hosted campaign server** that lets your group share the same campaign state via a short code.

![Fate's Edge Toolkit Screenshot](docs/screenshot.png)

---

## ✨ Features

- **Full digital toolkit** – characters, dice roller, timers, encounters, VTT chat, wiki, document library, and more.
- **Password protection** – lock the entire site with a playtester password (stored as a SHA‑256 hash).
- **Custom base URL** – fix document link generation for your hosting environment.
- **Deck of Consequences** – draw cards to generate narrative complications from Story Beats.
- **Regional Roller** – generate places, actors, complications, and rewards using the worldbook’s regional decks.
- **Data persistence** – all data stays in your browser’s local storage (export/import JSON for backup).
- **Campaign Sharing Server** – a tiny Docker image that stores and retrieves your full toolkit state using a 6‑character code. Share campaigns with your group easily.

---

## 🚀 Getting Started

### 1. Frontend – The Toolkit

The entire toolkit is a **single HTML file** (`index.html`). It’s self‑contained – all CSS and JavaScript are inside. You can:

- **Open it directly** in your browser (double‑click the file).  
- **Serve it with any static web server** (e.g., `npx serve .`, Python `http.server`, or upload to your web host).

When you first open it, you’ll see a password gate (if one has been set). You can set or remove the password from the **Settings** tab.

### 2. Backend – Campaign Sharing Server (Optional)

If you want to share campaigns among your group, run the tiny server. It stores uploaded JSON campaign files in a `data/` directory.

#### Quick Start with Docker

```bash
# Clone or create the server files (see below)
git clone https://github.com/yourusername/fates-edge-campaign-server.git
cd fates-edge-campaign-server

# Build the image
docker build -t fates-edge-campaign-server .

# Run the container (maps port 3000, persists data in ./data)
docker run -d -p 3000:3000 --name campaign-server -v $(pwd)/data:/app/data fates-edge-campaign-server
```

The server will be available at `http://localhost:3000` (or your server’s IP).

#### Manual Setup (without Docker)

```bash
npm install
node server.js
```

The server listens on port 3000 by default.

---

## 🔌 Using the Campaign Sharing Feature

1. Open the toolkit and go to **Settings** → **Campaign Sharing**.
2. Enter your server’s URL (e.g., `http://localhost:3000`).
3. Click **Upload Current State** – the server returns a 6‑character code (e.g., `A9K3LQ`).
4. Share this code with your players.
5. They enter the same server URL and the code, then click **Load State** – their toolkit will now mirror your campaign.
6. Use **Delete Campaign** to remove a stored campaign from the server.

> **Note:** The server stores data as plain `.json` files in the `data/` directory. You can backup or inspect them manually.

---

## 📦 Server API

The server exposes a simple REST API:

| Method | Endpoint               | Description |
|--------|------------------------|-------------|
| POST   | `/campaigns`           | Upload a JSON payload. Returns `{ code: "ABC123" }`. |
| GET    | `/campaigns/:code`     | Retrieve the stored JSON for the given code. |
| DELETE | `/campaigns/:code`     | Delete the campaign with that code. |

All endpoints respond with `application/json` and support CORS.

---

## 🛠️ Configuration

### Frontend

- **Password** – set or remove from the Settings tab. The hash is stored in `localStorage`.
- **Base URL** – also in Settings. Leave empty to auto‑detect from the browser. Used for generating shareable document links.
- **Theme** – toggle between dark, light, and auto.

### Server

The server uses environment variables (or defaults):

| Env Var   | Default | Description |
|-----------|---------|-------------|
| `PORT`    | `3000`  | Port to listen on. |

The `data/` directory is created automatically where the server runs. For Docker, you can mount a volume to persist data.

---

## 📂 File Structure

```
.
├── index.html                 # The complete toolkit (frontend)
├── server.js                  # Campaign sharing server (Node.js)
├── package.json               # Server dependencies
├── Dockerfile                 # Docker build definition
├── data/                      # (created at runtime) stored campaign JSON files
└── README.md                  # This file
```

---

## 🔒 License & Attribution

- **Fate's Edge** is © Nicholas A. Gasper.  
- The **SRD** and **Essentials** guide are licensed under [CC BY‑NC‑SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).  
- All other content – setting lore, original characters, proprietary magic systems, artwork – is **All Rights Reserved**.

---

## 🤝 Contributing

This project is maintained for personal and playtester use. If you find issues or have feature requests, please open an issue or submit a pull request.

---

## 🧑‍💻 Development Notes

- The frontend uses **vanilla JavaScript** (no frameworks) and relies on `localStorage` for data.
- The server is a minimal **Express.js** app – feel free to extend it (e.g., add authentication, rate limiting, or a database).
- Both components are designed to be **portable** – the HTML works offline after the first load (except for external CDN dependencies like jsPDF and marked.js).

---

**Enjoy your games!**  
— The Fate's Edge Team
