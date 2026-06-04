interface SubprocessResult {
  status: number
  killed_by_us: boolean
  stdout: string
  stderr: string
  error_string?: string
}

interface Options {
  lrc_tools_binary: string
  [key: string]: string | boolean | number
}

const options: Options = {
  lrc_tools_binary: "lrc_tools",
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

function getBasename(path: string): string {
  const pathSeparator = isWindows() ? "\\" : "/"
  return path.split(pathSeparator).pop() ?? path
}

function isLrcToolsInstalled(): boolean {
  const lrcTools = options.lrc_tools_binary
  const whichCmd = isWindows() ? "where" : "which"
  const subprocessResult = mp.command_native({
    name: "subprocess",
    capture_stdout: true,
    capture_stderr: true,
    args: [whichCmd, lrcTools],
  }) as SubprocessResult

  if (subprocessResult.killed_by_us) {
    return false
  }

  if (subprocessResult.status < 0) {
    logError(
      `Could not check '${getBasename(lrcTools)}': ${subprocessResult.error_string ?? "unknown error"}`,
    )
    return false
  }

  return subprocessResult.status === 0
}

function readLyrics(filePath: string, type: "timed" | "plain" = "timed"): string | null {
  const lrcTools = options.lrc_tools_binary
  const subprocessResult = mp.command_native({
    name: "subprocess",
    capture_stdout: true,
    capture_stderr: true,
    args: [lrcTools, "read", "--include-lang", filePath, type],
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
    const noLyricsPattern = new RegExp(`No ${type} lyrics`, "i")
    const noLyricsMatch = noLyricsPattern.test(errorOutput)
    const hasNonStandardError = !noLyricsMatch
    if (hasNonStandardError) {
      logError(`'${getBasename(lrcTools)}' error: ${errorOutput}`)
    }
    return null
  }

  const rawLyrics = subprocessResult.stdout
  return rawLyrics ?? null
}

function parseTimedLyricsAndLang(rawOutput: string): {
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
  mp.options.read_options(options, "mpv-lrc-loader")

  mp.register_event("file-loaded", () => {
    const filePath = mp.get_property("path")
    if (!filePath) {
      return
    }

    if (!isLocalFile(filePath)) {
      return
    }

    if (getFileExtension(filePath) !== ".mp3") {
      return
    }

    if (!isLrcToolsInstalled()) {
      logError(
        `'${getBasename(options.lrc_tools_binary)}' is not installed. Please install it from https://github.com/PaperNick/lrc_tools`,
      )
      return
    }

    const rawOutput = readLyrics(filePath, "timed") ?? readLyrics(filePath, "plain")
    if (!rawOutput) {
      return
    }

    const { language, lyrics } = parseTimedLyricsAndLang(rawOutput)
    if (!lyrics) {
      return
    }

    loadLyricsInMpv(lyrics, language)
  })
}

main()
