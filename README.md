<p align="center">
  <img src="src-tauri/icons/icon.png" alt="YT Downloader" width="128" height="128">
</p>

<h1 align="center">YT Downloader</h1>

<p align="center">
  <em>Paste a link. Pick a quality. Hit download. Done.</em>
</p>

<p align="center">
  <a href="https://github.com/Mrtracker-new/YT_Download">
    <img src="https://img.shields.io/badge/source-GitHub-181717?logo=github" alt="GitHub">
  </a>
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/Rust-stable-CE422B?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-444" alt="Platform">
</p>

---

A no-nonsense desktop app for pulling video and audio off YouTube, Vimeo, SoundCloud, and [1000+ other sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) — straight to your own machine. No accounts, no cloud, no malware-flavored ads.

Real native app under the hood (Rust + Tauri, React on top), not a browser tab pretending to be one.

## ✨ Features

| | |
|---|---|
| 🎥 **Video** | Up to 1080p, or whatever the site offers |
| 🎵 **Audio** | Rip straight to MP3 — music, podcasts, the lot |
| 📃 **Playlists** | Fetch, cherry-pick, queue the whole thing |
| ⚡ **Live queue** | 3 at a time with real speed + ETA bars |
| ⏯️ **Pause / resume / cancel** | Actually kills the process — not just the button |
| 🕘 **History** | Remember what you already grabbed |
| 💬 **Subtitles** | Burned into the MP4 or saved as `.srt` |

## 🚀 Quick start

**Prerequisites** — [Node 18+](https://nodejs.org) and [Rust](https://rustup.rs).
On Windows you also need **Visual Studio Build Tools 2022** — run `setup-prerequisites.bat` and it walks you through it (~20 min, one time only).

```bash
git clone https://github.com/Mrtracker-new/YT_Download.git
cd YT_Download
npm install
npm run dev
```

A window pops up. `yt-dlp` and `ffmpeg` download themselves on first run — nothing else to set up.

## 📦 Build an installer

```bash
npm run build
```

Your `.exe` lands in `src-tauri/target/release/bundle/nsis/`.

## 💡 Good to know

- **Instagram / Twitter / private Vimeo** — log in via Chrome first; the app borrows your cookies.
- **Long videos pause on a purple bar** — that's ffmpeg merging, not a freeze. Let it cook.

## 🛠️ Built with

[Tauri 2](https://tauri.app) · [Rust](https://www.rust-lang.org) · [React](https://react.dev) · [Vite](https://vitejs.dev) · [yt-dlp](https://github.com/yt-dlp/yt-dlp) · [ffmpeg](https://ffmpeg.org)

---

<p align="center">
  <sub>Built with too much ☕ and a deep distrust of online video downloaders.</sub>
</p>
