<p align="center">
  <img src="src-tauri/icons/icon.png" alt="YT Downloader" width="128" height="128">
</p>

<h1 align="center">YT Downloader</h1>

<p align="center">
  <strong>Paste a link. Pick a quality. Hit download. It's yours.</strong>
</p>

<p align="center">
  <em>Any video. Any quality. Straight to your machine — no accounts, no cloud, no nonsense.</em>
</p>

<p align="center">
  <a href="https://github.com/Mrtracker-new/YT_Download">
    <img src="https://img.shields.io/badge/source-GitHub-181717?logo=github" alt="GitHub">
  </a>
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/Rust-stable-CE422B?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-444" alt="Platform">
  <img src="https://img.shields.io/badge/price-free%20forever-2ea44f" alt="Free">
</p>

---

## 🎬 Grab any video in three clicks

Found something on YouTube you want to keep? A playlist worth saving? A track you'd rather have as an MP3? **YT Downloader pulls it down for you** — full quality, on your hard drive, ready to watch or listen offline. Forever.

It speaks **YouTube, Vimeo, SoundCloud, and [1000+ other sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)**. No sign-ups. No upload limits. No sketchy "DOWNLOAD NOW" buttons that install three toolbars. Just a clean little desktop app that does exactly what it says.

And it's a **real native app** — Rust + Tauri at the core, React on top. Not a browser tab wearing a costume. Fast to launch, light on memory, yours to keep.

## ✨ What it does

| | |
|---|---|
| 🎥 **Crisp video** | Down to the file in up to **1080p** — or whatever the highest the site has |
| 🎵 **Instant MP3** | Rip audio clean — music, podcasts, lectures, the lot |
| 📃 **Whole playlists** | Fetch them all, cherry-pick the ones you want, queue and go |
| ⚡ **Live progress** | Real-time **speed + ETA bars** — 3 downloads running at once |
| ⏯️ **Real pause & resume** | Stops the actual process, not just the spinner — pick up right where you left off |
| 🕘 **History** | Every grab remembered, so you never download the same thing twice |
| 💬 **Subtitles** | Burn them into the MP4 or save them as a tidy `.srt` |

## 🚀 Get going in a minute

**You'll need** — [Node 18+](https://nodejs.org) and [Rust](https://rustup.rs).
On Windows, also grab **Visual Studio Build Tools 2022** — just run `setup-prerequisites.bat` and it'll hold your hand through it (~20 min, once, ever).

```bash
git clone https://github.com/Mrtracker-new/YT_Download.git
cd YT_Download
npm install
npm run dev
```

A window pops up and you're in. `yt-dlp` and `ffmpeg` **download themselves** on first run — zero extra setup.

## 📦 Want a real installer?

```bash
npm run build
```

Your shiny `.exe` lands in `src-tauri/target/release/bundle/nsis/` — double-click and share.

## 💡 Good to know

- **Instagram / Twitter / private Vimeo** — log into the site in Chrome first; the app borrows your cookies so the gated stuff just works.
- **Long video stuck on a purple bar?** That's not a freeze — it's ffmpeg stitching the final file together. Let it cook. ☕

## 🛠️ Built with

[Tauri 2](https://tauri.app) · [Rust](https://www.rust-lang.org) · [React](https://react.dev) · [Vite](https://vitejs.dev) · [yt-dlp](https://github.com/yt-dlp/yt-dlp) · [ffmpeg](https://ffmpeg.org)

---

<p align="center">
  <sub>Built with too much ☕ and a deep distrust of online video downloaders.</sub>
</p>
