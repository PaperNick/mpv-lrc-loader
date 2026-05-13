# MPV LRC Loader

MPV script to read embedded timed LRC lyrics (SYLT frames) from MP3 files and display them as subtitles in mpv. Only local MP3 files are processed.


## Dependencies

You need to have [go-sylt](https://github.com/mogita/go-sylt) installed in your `PATH`


## Installation

Copy the compiled script to your mpv scripts folder:

```bash
cp dist/mpv-lrc-loader.js ~/.config/mpv/scripts/
```


## How it works

1. When a file is loaded in mpv, the script checks if it's a local MP3 file.
2. If so, it runs `go-sylt` to extract embedded SYLT lyrics.
3. The lyrics (in LRC format with timestamps) are loaded into mpv's subtitle system via `sub-add`.
4. The language code (e.g. `eng`, `jpn`, `kor`) from the SYLT frame is passed along so mpv can use it for track selection.

The content loaded from the MP3's SYLT frame looks like this:

```
Language: jpn
[00:01.130] 強くなれる理由を知った 僕を連れて進め
[00:18.820] 泥だらけの走馬灯に酔う こわばる心
[00:26.110] 震える手は掴みたいものがある それだけさ
...
```

The first line indicates the 3-letter ISO 639-2 language code, followed by LRC-formatted timestamped lyrics.


## Building from source

```bash
npm ci
npm run build
```

The compiled output will be located at `dist/mpv-lrc-loader.js`
