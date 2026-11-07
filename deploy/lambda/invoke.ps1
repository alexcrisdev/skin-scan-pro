param(
  [Parameter(Mandatory = $true)][string]$ImagePath,
  [string]$Endpoint = 'http://localhost:9000/2015-03-31/functions/function/invocations',
  [switch]$LocalRuntime
)
$ErrorActionPreference = 'Stop'
if (-not $env:SKINSCAN_INFERENCE_API_KEY) { throw 'Configura SKINSCAN_INFERENCE_API_KEY en esta terminal.' }
$imageFile = Get-Item -LiteralPath $ImagePath
if ($imageFile.Length -gt 4MB) { throw 'Usa una imagen de hasta 4 MiB.' }
$mimeTypes = @{ '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.png' = 'image/png'; '.webp' = 'image/webp' }
$mime = $mimeTypes[$imageFile.Extension.ToLowerInvariant()]
if (-not $mime) { throw 'Formato no admitido.' }
$payload = @{ mime = $mime; image = [Convert]::ToBase64String([IO.File]::ReadAllBytes($imageFile.FullName)) } | ConvertTo-Json -Compress
$headers = @{ Authorization = "Bearer $env:SKINSCAN_INFERENCE_API_KEY" }
if ($LocalRuntime) {
  $event = @{ headers = $headers; requestContext = @{ http = @{ method = 'POST' } }; body = $payload; isBase64Encoded = $false } | ConvertTo-Json -Depth 6 -Compress
  $result = Invoke-RestMethod -Uri $Endpoint -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($event))
  if ($result.statusCode -ne 200) { throw $result.body }
  $result.body | ConvertFrom-Json | ConvertTo-Json -Depth 6
} else {
  Invoke-RestMethod -Uri $Endpoint -Method Post -ContentType 'application/json' -Headers $headers -Body ([Text.Encoding]::UTF8.GetBytes($payload)) | ConvertTo-Json -Depth 6
}
