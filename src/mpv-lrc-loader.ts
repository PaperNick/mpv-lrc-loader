interface SubprocessResult {
  status: number
  killed_by_us: boolean
  stdout: string
  stderr: string
  error_string?: string
}

function logError(message: string): void {
  mp.msg.error(message)
  if (mp.get_property_native("vo-configured")) {
    mp.osd_message(message, 5)
  }
}

function isWindows(): boolean {
  const workdir = mp.get_property_native("working-directory") as string
  return workdir.indexOf("\\") !== -1
}

function isGoSyltInstalled(): boolean {
  const whichCmd = isWindows() ? "where" : "which"
  const subprocessResult = mp.command_native({
    name: "subprocess",
    capture_stdout: true,
    capture_stderr: true,
    args: [whichCmd, "go-sylt"],
  }) as SubprocessResult

  if (subprocessResult.killed_by_us) {
    return false
  }

  if (subprocessResult.status < 0) {
    logError(`Could not check 'go-sylt': ${subprocessResult.error_string ?? "unknown error"}`)
    return false
  }

  return subprocessResult.status === 0
}

function extractSyltLyrics(filePath: string): string | null {
  const subprocessResult = mp.command_native({
    name: "subprocess",
    capture_stdout: true,
    capture_stderr: true,
    args: ["go-sylt", filePath],
  }) as SubprocessResult

  if (subprocessResult.killed_by_us) {
    return null
  }

  if (subprocessResult.status < 0) {
    logError(`Subprocess error: ${subprocessResult.error_string ?? "unknown error"}`)
    return null
  }

  if (subprocessResult.status !== 0) {
    const errorOutput = (subprocessResult.stderr ?? "").trim()
    const noSyncedLyrics = /no SYLT frames found/i.test(errorOutput)
    if (!noSyncedLyrics) {
      logError(`go-sylt error: ${errorOutput}`)
    }
    return null
  }

  const rawLyrics = subprocessResult.stdout
  return rawLyrics ?? null
}

function parseLanguageAndLyrics(rawOutput: string): {
  language: string | null
  lyrics: string
} {
  let language: string | null = null
  const lrcLines: string[] = []

  for (const line of rawOutput.split("\n")) {
    const cleanedLine = line.replace(/\r$/, "")

    if (!language) {
      language = cleanedLine.match(/^Language:\s*(\w+)/)?.[1] ?? null
    }

    // Keep only timestamp lines like [mm:ss.xx], skip metadata tags like [ar:Artist]
    if (/^\[\d+:\d+/.test(cleanedLine)) {
      lrcLines.push(cleanedLine)
    }
  }

  return { language, lyrics: lrcLines.join("\n") }
}

/**
 * Converts 3-digit millisecond timestamps to 2-digit centiseconds.
 *
 * 'go-sylt' outputs [mm:ss.xxx] (milliseconds), but mpv expects
 * [mm:ss.xx] (centiseconds). The last millisecond digit is dropped.
 *
 * @example
 * convertToCentiseconds("[01:05.123] Line one\n[01:08.999] Line two")
 * // Returns: "[01:05.12] Line one\n[01:08.99] Line two"
 */
function convertToCentiseconds(lyrics: string): string {
  return lyrics.replace(
    /\[(\d+):(\d+)\.(\d\d)\d\]/g,
    (_match, minutes, seconds, centiseconds) => `[${minutes}:${seconds}.${centiseconds}]`,
  )
}

function getFileExtension(filePath: string): string {
  const lastDotIndex = filePath.lastIndexOf(".")
  return lastDotIndex !== -1 ? filePath.slice(lastDotIndex).toLowerCase() : ""
}

function isLocalFile(filePath: string): boolean {
  return filePath.indexOf("://") === -1
}

function loadLyricsInMpv(lyrics: string, language: string | null): void {
  const subtitleArguments: string[] = ["sub-add", `memory://${lyrics}`, "select", "Embedded LRC"]
  if (language) {
    subtitleArguments.push(language)
  }

  mp.commandv(...subtitleArguments)
}

function main(): void {
  mp.register_event("file-loaded", () => {
    if (!isGoSyltInstalled()) {
      logError(
        "'go-sylt' is not installed. Please install it from https://github.com/mogita/go-sylt",
      )
      return
    }

    const filePath = mp.get_property("path")
    if (!filePath) {
      return
    }

    if (!isLocalFile(filePath)) {
      // go-sylt supports only local files, not streams
      return
    }

    if (getFileExtension(filePath) !== ".mp3") {
      return
    }

    const rawSyltOutput = extractSyltLyrics(filePath)
    if (!rawSyltOutput) {
      return
    }

    const { language, lyrics } = parseLanguageAndLyrics(rawSyltOutput)
    if (!lyrics) {
      return
    }

    loadLyricsInMpv(convertToCentiseconds(lyrics), language)
  })
}

main()
