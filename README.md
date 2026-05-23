# MPV LRC Loader

MPV script to read embedded timed LRC lyrics (SYLT frames) from MP3 files and display them as subtitles in mpv. Only local MP3 files are processed.


## Dependencies

You need to have [lrc_tools](https://github.com/PaperNick/lrc_tools) installed in your `PATH`


## Installation

> [!NOTE]
> Pre-compiled versions are available on the [releases page](https://github.com/PaperNick/mpv-lrc-loader/releases)

Compile the project and copy the script to your mpv scripts folder:

```bash
npm ci
npm run build
cp dist/mpv-lrc-loader.js ~/.config/mpv/scripts/
```


## How it works

1. When a file is loaded in mpv, the script checks if it's a local MP3 file.
2. If so, it runs `lrc_tools read --include-lang file.mp3 timed` to extract embedded timed lyrics (SYLT).
3. The lyrics (in LRC format with timestamps) are loaded into mpv's subtitle system via `sub-add`.
4. The language code (e.g. `en`, `ja`, `ko`) from the SYLT frame is passed along so mpv can use it for track selection.

The content loaded from the MP3's SYLT frame looks like this:

```
Language: ja
[00:01.13] 強くなれる理由を知った 僕を連れて進め
[00:18.82] 泥だらけの走馬灯に酔う こわばる心
[00:26.11] 震える手は掴みたいものがある それだけさ
...
```

The first line indicates the 2-letter ISO 639-1 language code, followed by LRC-formatted timestamped lyrics in [mm:ss.cc] centisecond format.


## Configuration (optional)

Create a file in `~/.config/mpv/script-opts/mpv-lrc-loader.conf` with any of the following options:

| Option | Value | Description |
|--------|---------|-------------|
| `lrc_tools_binary` | `lrc_tools` | Name of the `lrc_tools` binary or its full path |

For example if you renamed the `lrc_tools` binary to `my-lyric-tool`:

```ini
lrc_tools_binary=my-lyric-tool
```

You can also use a full path if the binary is not in your `PATH`:

```ini
lrc_tools_binary=/home/user/bin/my-lyric-tool
```
