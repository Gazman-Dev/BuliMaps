# BuliMaps

> **Turn a sentence into a 3D world you can play, share, remix — and extend with AI‑powered vibe coding.**

**BuliMaps** is a *vibe‑coding starter kit* for building browser‑based **3D web games**.  Describe your world in everyday language, press **Generate**, and BuliMaps spits out a complete level plus a playable demo.  Plug it straight into **[Bulifier AI on Android](https://play.google.com/store/apps/details?id=com.bulifier)** —or any AI IDE of your choice—and you’re ready to iterate, test, and ship.

Everything runs client‑side: clone the repo, spin up a tiny HTTP server, and roam your world in seconds.

---

## 🚀 Quick Start

```bash
# 1. Grab the code
$ python -m http.server 8000
# open → http://localhost:8000/demo/
```

---

## ✨ Highlights

* **Prompt‑to‑Play:** Type a short description, click *Generate*, get a live world.
* **Vibe‑Coding Ready:** Designed as a starter pack for AI coding environments—hook it to Bulifier AI or any LLM‑powered IDE and co‑create levels at lightning speed.
* **One‑File Worlds:** Each map compiles into a compact `.world` binary for instant loading and effortless sharing.
* **Web‑Native:** Powered by Three.js, so your levels run on desktop, mobile, VR headsets—any modern browser.
* **Instant Wow:** Perfect for prototypes, game jams, client pitches, or teaching sessions.

---

## 🔧 Using .world Files in Your Project

```js
import { BuliLoader } from "./loader/BuliLoader.js";

const loader = new BuliLoader();
loader.load("/maps/myMap.world", scene => {
  threeScene.add(scene);
});
```

Drop the loader into your existing Three.js setup—or let an AI IDE do it for you.

---

## 🗂️ Repo Layout

```
demo/        # Playable sample level + assets
loader/      # Tiny Three.js loader
LICENSE      # Apache 2.0
```

---

## 📜 License

Released under the **Apache License 2.0**.  See the [`LICENSE`](LICENSE) file for full details.