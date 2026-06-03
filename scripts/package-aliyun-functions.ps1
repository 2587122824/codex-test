param(
  [string]$SourceDir = "server/aliyun-functions",
  [string]$OutputZip = "dist/aliyun-functions-deploy.zip"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$source = Resolve-Path -LiteralPath (Join-Path $root $SourceDir)
$output = Join-Path $root $OutputZip
$outputDir = Split-Path -Parent $output

if (-not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

if (Test-Path -LiteralPath $output) {
  Remove-Item -LiteralPath $output -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$include = @(
  "index.js",
  "handler.js",
  "postgres-adapter.js",
  "aliyun-sms-adapter.js",
  "package.json",
  "package-lock.json",
  "rds-schema.sql",
  "node_modules"
)

$archive = [System.IO.Compression.ZipFile]::Open($output, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($item in $include) {
    $path = Join-Path $source $item
    if (-not (Test-Path -LiteralPath $path)) {
      throw "Missing deployment item: $item"
    }

    $files = if ((Get-Item -LiteralPath $path).PSIsContainer) {
      Get-ChildItem -LiteralPath $path -Recurse -File
    } else {
      Get-Item -LiteralPath $path
    }

    foreach ($file in $files) {
      $sourcePath = $source.Path.TrimEnd("\") + "\"
      $relative = $file.FullName.Substring($sourcePath.Length).Replace("\", "/")
      if ($relative -match "(^|/)\.env$") {
        continue
      }

      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive,
        $file.FullName,
        $relative,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  }
} finally {
  $archive.Dispose()
}

Get-Item -LiteralPath $output | Select-Object FullName,Length,LastWriteTime
