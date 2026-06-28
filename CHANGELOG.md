# Changelog

## [1.2.0](https://github.com/Mrtracker-new/YT_Download/compare/v1.1.1...v1.2.0) (2026-06-28)


### Features

* **security:** add filename template traversal validator ([3883f26](https://github.com/Mrtracker-new/YT_Download/commit/3883f267c6e2161ea737930e8ccba488c86776bd))
* **security:** validate filename template on download start ([785391a](https://github.com/Mrtracker-new/YT_Download/commit/785391a0ac7a053251c207b61ee5ae2d7a2c5182))
* **security:** validate filename template on settings save ([e648b37](https://github.com/Mrtracker-new/YT_Download/commit/e648b37bd180d722adc3c08171e8c132244abf6e))
* **settings:** add updater preference fields ([f0cd1cb](https://github.com/Mrtracker-new/YT_Download/commit/f0cd1cb6830d4ea4e375393e278e3d4b972d286f))
* **updater:** add backend update-check commands ([40918e1](https://github.com/Mrtracker-new/YT_Download/commit/40918e1dc633e8883d6ccce090117efccdf20603))
* **updater:** add banner, modal, and context components ([f1fbf4c](https://github.com/Mrtracker-new/YT_Download/commit/f1fbf4c490c032747a96b0e8e688fc9c9488831f))
* **updater:** add update service and startup checker hook ([3f0f7e9](https://github.com/Mrtracker-new/YT_Download/commit/3f0f7e96f87cb340245d6c81313006db4a7834e6))
* **updater:** mount update provider and banner ([4177eb8](https://github.com/Mrtracker-new/YT_Download/commit/4177eb853f2c2dccf3b4bcc31c522b4ad28debe7))


### Bug Fixes

* clean subdirectory partials on cancel ([9bcf4cc](https://github.com/Mrtracker-new/YT_Download/commit/9bcf4cc20efac655d59da6554462cba94ae4d296))
* close pause/cancel race in resume_download ([be1ca5e](https://github.com/Mrtracker-new/YT_Download/commit/be1ca5e54b68d7c381b473485af1fb01ce69c8a7))
* don't let late progress events revert terminal job status ([09e5e83](https://github.com/Mrtracker-new/YT_Download/commit/09e5e831e248c9f9f5ac708cfa3bd15c86a9e0b0))
* ignore non-existent cookie file instead of passing bad path ([ad1aa94](https://github.com/Mrtracker-new/YT_Download/commit/ad1aa9409e1c2f58c3f9c6000b92f9d7a38c8b8b))
* key playlist selection by index, not video id ([8b25127](https://github.com/Mrtracker-new/YT_Download/commit/8b2512793af9c915a5b7fbee50a13b73e332981a))
* reconcile applyQueuePatch by status priority ([6101c7f](https://github.com/Mrtracker-new/YT_Download/commit/6101c7fcdea49f79d25cfa85d2f761b1e546e7c2))
* use cross-platform path separator in handleOpenFolder ([4c075b0](https://github.com/Mrtracker-new/YT_Download/commit/4c075b03ef44cfe73a6f56fadc0550e7954d37a4))
* wrap each queue item in a per-item error boundary ([9cd71d3](https://github.com/Mrtracker-new/YT_Download/commit/9cd71d359a4a8da053ffd0472bec481a733b60bd))

## [1.1.1](https://github.com/Mrtracker-new/YT_Download/compare/v1.1.0...v1.1.1) (2026-06-26)


### Bug Fixes

* enforce keepHistory and historyRetentionDays settings ([724d844](https://github.com/Mrtracker-new/YT_Download/commit/724d844980a36d62d42a1b4ce8bd586c17ebe83e))
* **security:** sanitize URL in playlist-info error message ([df3393e](https://github.com/Mrtracker-new/YT_Download/commit/df3393e5cda2c7bc10def9e6d644ef5ab9fb97e5))
* **security:** sanitize URL in yt-dlp job-start log ([3af0825](https://github.com/Mrtracker-new/YT_Download/commit/3af0825905fe9d40eb6b55e7ce9850b44d3b1dfb))
* **security:** validate job_id in delete_history_item ([71a81cf](https://github.com/Mrtracker-new/YT_Download/commit/71a81cfdd6085ae1f2afb8fd6a6349dac1590adc))
* **security:** validate job_id in download control commands ([b8ad00c](https://github.com/Mrtracker-new/YT_Download/commit/b8ad00cf78f4ee4785ada5057108d921ef445d30))
* **security:** validate output_dir against base download dir ([a0f1e1d](https://github.com/Mrtracker-new/YT_Download/commit/a0f1e1d3b75904c4058ef3d84649834a99f9112a))
* skip thumbnail embed for unsupported audio formats ([ecbef4d](https://github.com/Mrtracker-new/YT_Download/commit/ecbef4d7542a448f8cc9c359203fa907b05f2ee0))
* **ui:** restore link color inheritance after Tailwind removal ([6d8d808](https://github.com/Mrtracker-new/YT_Download/commit/6d8d808cee437e4f0444a55f7cd3183543a65f71))


### Performance Improvements

* derive subtitle languages from videoInfo instead of refetching ([079f318](https://github.com/Mrtracker-new/YT_Download/commit/079f3182e1314b48e52da0fef5c4b63ada07407c))

## [1.1.0](https://github.com/Mrtracker-new/YT_Download/compare/v1.0.0...v1.1.0) (2026-06-25)


### Features

* **download:** add codec, audio format, thumbnail & SponsorBlock options ([6d9a1ed](https://github.com/Mrtracker-new/YT_Download/commit/6d9a1ed6e04085641f0e41ab4063136c9176624a))


### Bug Fixes

* **setup:** bundle ffprobe so SponsorBlock cutting works ([a12f31e](https://github.com/Mrtracker-new/YT_Download/commit/a12f31e210288fe740cec42427229a61c31ba00e))
