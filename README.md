# 📱 EmbyX Vertical Player `v1.1`

[中文说明](./README_zh.md) | [English Documentation](./README.md)

> A TikTok-style web interface for Emby / Jellyfin, designed for browsing and managing short videos in an immersive way.

---

## ✨ Features

- **Fluid Playback**: TikTok-style vertical scrolling, immersive full-screen experience.
- **Grid View**: Browse with cover walls, supports pagination and random refresh.
- **Direct Play**: Works natively on modern devices. Support for 8K, AV1, and HEVC without transcoding.
- **Library Sync**: One-tap to favorite/unfavorite videos, fully synced with Emby server.
- **Key & Mouse Support**: Complete keyboard shortcut mapping. Friendly for TV and PC browsers.
- **PWA Ready**: Install as a desktop or home screen app.
- **Privacy First**: All data is stored locally; nothing is uploaded to the cloud.

---

## 🔮 Playback Performance

| Device | HEVC Decode | AV1 Decode |
|:---:|:---:|:---:|
| Apple | A9 (2015) / M1 | A17 Pro (2023) / M3 |
| Android | Budget (2016) | Budget (2024) |
| PC | Intel Core 6-8th Gen (iGPU) | Intel Core 11th Gen+ (iGPU) |

---

## ⌨️ Shortcuts Guide

| Key | Function |
|:---:|---|
| `W / S / ↑ / ↓` | Previous / Next Video |
| `A / D / ← / →` | Seek Back / Forward 15s |
| `Space / Click OK` | Pause / Play |
| `U / Double Click OK` | Favorite Video |
| `J / Menu Key` | Toggle Aspect Ratio |
| `M` | Toggle Mute |
| `I` | Open Settings / Profile |
| `E` | Toggle View Mode (List/Grid) |
| `R` | Sequential / Random Mode |
| `F` | Fullscreen Mode |
| `G` | Toggle Libraries |
| `V` | Show File Info |

---

## 📁 Directory Structure

```
embyx/
├── zh/               # Chinese Version
│   ├── index.html
│   ├── manifest.json
│   └── ...
├── en/               # English Version
│   ├── index.html
│   ├── manifest.json
│   └── ...
├── README.md         # English (Default)
└── README_zh.md      # Chinese
```

---

## 🚀 Deployment

### Option 1: Direct File Hosting (Recommended)

Simply put all files from either `zh/` or `en/` folder into your web server (Nginx, Apache, etc.).

### Option 2: Docker Deployment

One image, multiple languages. Controlled by environment variable.

```bash
docker run -d \
  --name embyx \
  --network host \
  -e APP_LANG=en \
  -e APP_PORT=8090 \
  ghcr.io/juneix/embyx:latest
```

| Env | Description | Default |
|---|---|---|
| `APP_LANG` | `en` (English) / `zh` (Chinese) | `en` |
| `APP_PORT` | The port the container will listen on | `8090` |

---

## 📝 License

MIT License — Feel free to use, PRs and Issues are welcome.

👨🏻‍💻 Author: [@Juneix](https://juneix.github.io)  
🛜 Official Site: [June's Hub](https://5nav.eu.org)
