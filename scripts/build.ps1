# Frames, soundtrack, MP4, then a verification printout. Windows PowerShell 5.1+.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\build.ps1 [-SkipFrames] [-SkipAudio]
param([switch]$SkipFrames, [switch]$SkipAudio)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

# Prefer portable copies in tools\, otherwise use PATH.
$nodeDir = Get-ChildItem -Path "$root\tools" -Directory -Filter 'node-v*-win-x64' -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending | Select-Object -First 1
if ($nodeDir) { $env:PATH = "$($nodeDir.FullName);$env:PATH" }
$ffDir = "$root\tools\ffmpeg\bin"
$ff = if (Test-Path "$ffDir\ffmpeg.exe") { "$ffDir\ffmpeg.exe" } else { 'ffmpeg' }
$fp = if (Test-Path "$ffDir\ffprobe.exe") { "$ffDir\ffprobe.exe" } else { 'ffprobe' }
$mp4 = "$root\output\memphis_city_drive.mp4"

if (-not $SkipFrames) {
  node scripts\render-frames.cjs
  if ($LASTEXITCODE -ne 0) { throw 'frame render failed' }
}
if (-not $SkipAudio) {
  node scripts\audio.cjs
  if ($LASTEXITCODE -ne 0) { throw 'audio render failed' }
} elseif (-not (Test-Path output\soundtrack.wav)) { throw 'output\soundtrack.wav missing; run without -SkipAudio' }

# ffmpeg writes to stderr; under 'Stop' PowerShell 5.1 would treat that as fatal.
$ErrorActionPreference = 'Continue'
& $ff -hide_banner -loglevel error -y -framerate 30 -i output\frames\frame_%04d.png -i output\soundtrack.wav `
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p `
  -vf "scale=out_color_matrix=bt709:out_range=tv" -color_primaries bt709 -color_trc bt709 -colorspace bt709 `
  -r 30 -c:a aac -b:a 192k -ar 48000 -movflags +faststart $mp4
if ($LASTEXITCODE -ne 0) { throw 'mux failed' }
& $ff -hide_banner -loglevel error -y -i output\soundtrack.wav -lavfi "showspectrumpic=s=1600x500:mode=combined:scale=log:legend=1" output\soundtrack_spectrogram.png

Write-Output '--- video stream'
& $fp -v error -count_frames -select_streams v:0 -show_entries 'stream=codec_name,pix_fmt,width,height,r_frame_rate,nb_read_frames,duration' -of default=nw=1 $mp4
Write-Output '--- container'
& $fp -v error -show_entries 'format=duration,size' -of default=nw=1 $mp4
Write-Output '--- loudness'
foreach ($src in @('output\soundtrack.wav', $mp4)) {
  & $ff -hide_banner -nostats -i $src -vn -af ebur128=peak=true -f null - 2>&1 |
    Select-String -Pattern '^\s+(I:|Peak:)' | ForEach-Object { "  $(Split-Path -Leaf $src) $($_.Line.Trim())" }
}
