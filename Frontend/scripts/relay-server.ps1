<#
.SYNOPSIS
  Feedback email relay server for the Asus Zenbook.

.DESCRIPTION
  Starts an HTTP server that the Ubuntu feedback server pushes email send
  requests to. Each request is fulfilled via Outlook COM and the result is
  returned synchronously in the HTTP response.

  Run once on Windows startup (via Task Scheduler or the Startup folder).
  Outlook must be open and signed in as gajavegs@rose-hulman.edu before
  this script is started.

.PARAMETER Port
  Port to listen on (default 3001). Must be reachable from the Ubuntu server.

.PARAMETER ServerUrl
  Base URL of the Ubuntu feedback server (no trailing slash).

.PARAMETER RelaySecret
  Shared secret — must match RELAY_SECRET in the server's .env.

.EXAMPLE
  .\relay-server.ps1 -ServerUrl "http://10.20.30.40:3000" -RelaySecret "abc123"
#>
param(
  [int]$Port         = 3001,
  [string]$ServerUrl = $env:FEEDBACK_SERVER_URL,
  [string]$RelaySecret = $env:RELAY_SECRET
)

if (-not $ServerUrl)   { Write-Error "ServerUrl is required. Set FEEDBACK_SERVER_URL or pass -ServerUrl."; exit 1 }
if (-not $RelaySecret) { Write-Error "RelaySecret is required. Set RELAY_SECRET or pass -RelaySecret."; exit 1 }

$AuthHeader = @{ "Authorization" = "Bearer $RelaySecret"; "Content-Type" = "application/json" }

# ── Register with the feedback server ────────────────────────────────────────
function Register-WithServer {
  try {
    $body = @{ port = $Port } | ConvertTo-Json
    Invoke-RestMethod -Uri "$ServerUrl/api/relay/register" -Method Post -Headers $AuthHeader -Body $body | Out-Null
    Write-Host "[relay] Registered with $ServerUrl (port $Port)"
  } catch {
    Write-Warning "[relay] Registration failed: $_  (will retry on next restart)"
  }
}

# ── Send one email via Outlook COM ────────────────────────────────────────────
function Send-OutlookEmail($outlook, $recipient, $subject, $body) {
  $mail = $outlook.CreateItem(0)   # 0 = olMailItem
  $mail.To                = $recipient
  $mail.Subject           = $subject
  $mail.HTMLBody          = $body     # HTML — Outlook sets charset=utf-8 automatically
  $mail.DeleteAfterSubmit = $true     # MANDATORY: suppress Sent Items copy per IRB protocol
  $mail.Send()
}

# ── Write a JSON response and close the context ───────────────────────────────
function Write-JsonResponse($ctx, [int]$statusCode, [string]$json) {
  $ctx.Response.StatusCode  = $statusCode
  $ctx.Response.ContentType = "application/json; charset=utf-8"
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.Close()
}

# ── Main ──────────────────────────────────────────────────────────────────────

# Acquire Outlook COM object once and reuse across requests to avoid ~2s startup
# cost per email. If Outlook is not running this will launch it.
Write-Host "[relay] Connecting to Outlook..."
try {
  $outlook = New-Object -ComObject Outlook.Application
} catch {
  Write-Error "Could not connect to Outlook COM: $_"
  exit 1
}
Write-Host "[relay] Outlook ready."

# Start HTTP listener
$listener = [Net.HttpListener]::new()
$listener.Prefixes.Add("http://+:$Port/")
try {
  $listener.Start()
} catch {
  Write-Error "Could not start HTTP listener on port ${Port}: $_"
  Write-Error "Run PowerShell as Administrator or reserve the URL with: netsh http add urlacl url=http://+:$Port/ user=$env:USERNAME"
  exit 1
}
Write-Host "[relay] Listening on port $Port"

Register-WithServer

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    if ($listener.IsListening) { Write-Warning "[relay] GetContext error: $_" }
    break
  }

  $req  = $ctx.Request
  $path = $req.Url.AbsolutePath

  # ── Auth ──────────────────────────────────────────────────────────────────
  if ($req.Headers["Authorization"] -ne "Bearer $RelaySecret") {
    Write-JsonResponse $ctx 401 '{"error":"Unauthorized"}'
    continue
  }

  # ── POST /send ────────────────────────────────────────────────────────────
  if ($req.HttpMethod -eq "POST" -and $path -eq "/send") {
    $rawBody = [IO.StreamReader]::new($req.InputStream, [Text.Encoding]::UTF8).ReadToEnd()

    try {
      $payload = $rawBody | ConvertFrom-Json
    } catch {
      Write-JsonResponse $ctx 400 '{"error":"Invalid JSON"}'
      continue
    }

    if (-not $payload.recipient -or -not $payload.subject -or -not $payload.body) {
      Write-JsonResponse $ctx 400 '{"error":"recipient, subject, and body are required"}'
      continue
    }

    try {
      Send-OutlookEmail $outlook $payload.recipient $payload.subject $payload.body
      Write-Host "[relay] Sent to $($payload.recipient)"
      Write-JsonResponse $ctx 200 '{"ok":true}'
    } catch {
      $errMsg = $_.ToString() -replace '"', "'"
      Write-Warning "[relay] Outlook error for $($payload.recipient): $_"
      Write-JsonResponse $ctx 500 "{`"error`":`"$errMsg`"}"
    }
    continue
  }

  # ── GET /status ───────────────────────────────────────────────────────────
  # Lightweight probe the Ubuntu server can use to confirm the relay is reachable.
  if ($req.HttpMethod -eq "GET" -and $path -eq "/status") {
    Write-JsonResponse $ctx 200 '{"ok":true}'
    continue
  }

  Write-JsonResponse $ctx 404 '{"error":"Not found"}'
}

$listener.Stop()
Write-Host "[relay] Stopped."
