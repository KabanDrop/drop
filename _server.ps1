$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8080
$prefix = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.js'='application/javascript; charset=utf-8';
  '.json'='application/json; charset=utf-8'; '.webp'='image/webp'; '.png'='image/png';
  '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif'; '.svg'='image/svg+xml';
  '.woff2'='font/woff2'; '.woff'='font/woff'; '.ttf'='font/ttf'; '.ico'='image/x-icon';
  '.mp4'='video/mp4'; '.webm'='video/webm'; '.mp3'='audio/mpeg'; '.txt'='text/plain; charset=utf-8'
}

try { $listener.Start() } catch {
  Write-Host "Не удалось запустить сервер на $prefix" -ForegroundColor Red
  Write-Host $_.Exception.Message
  Read-Host "Нажмите Enter для выхода"
  exit 1
}

$url = "http://localhost:$port/index.html"
Write-Host "КабанDrop запущен:" -ForegroundColor Green
Write-Host "  $url"
Write-Host "  (закройте это окно, чтобы остановить сервер)`n" -ForegroundColor DarkGray

Start-Process $url

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $rel = [System.Uri]::UnescapeDataString($req.Url.LocalPath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
    $full = Join-Path $root $rel
    $full = [System.IO.Path]::GetFullPath($full)

    if ($full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $ct = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $res.ContentType = $ct
      $res.ContentLength64 = $bytes.Length
      $res.Headers.Add('Cache-Control', 'no-cache')
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $b = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
      $res.OutputStream.Write($b, 0, $b.Length)
    }
    $res.OutputStream.Close()
  } catch {
    try { $ctx.Response.StatusCode = 500; $ctx.Response.OutputStream.Close() } catch {}
  }
}
