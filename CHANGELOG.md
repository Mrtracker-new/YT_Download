# Changelog

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
