param([switch]$Local)
$ErrorActionPreference="Stop"
$root="C:\Users\razor\OneDrive\Desktop\Projects\live-map"
Set-Location $root
$envPath="$root\.env"
$bak="$root\.env.tunnel.bak"
$log="$env:TEMP\opencode\tunnel.log"
$log2="$env:TEMP\opencode\tunnel-reverb.log"
$serveLog="$env:TEMP\opencode\serve.log"
function Restart-Serve {
  $pid8000=(Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
  if($pid8000){ Stop-Process -Id $pid8000 -Force -ErrorAction SilentlyContinue; Start-Sleep 2 }
  php artisan config:clear | Out-Null
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c php artisan serve --host=127.0.0.1 --port=8000 > `"$serveLog`" 2>&1" -WindowStyle Hidden
  Start-Sleep 4
  Write-Host "serve -> http://localhost:8000"
}
function Ensure-Reverb {
  $has=(Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" })
  if(-not $has){
    Write-Host "starting reverb 8080..."
    $logR="$env:TEMP\opencode\reverb.log"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c php artisan reverb:start --host=0.0.0.0 --port=8080 > `"$logR`" 2>&1" -WindowStyle Hidden
    Start-Sleep 4
  }
}
if($Local){
  Write-Host "=== LOCAL MODE ==="
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Remove-Item $log,$log2 -Force -ErrorAction SilentlyContinue
  if(Test-Path $bak){ Copy-Item $bak $envPath -Force; Write-Host "restored .env from backup" }
  else{
    $c=Get-Content $envPath -Raw
    $c=$c -replace 'APP_URL=.*','APP_URL=http://localhost:8000'
    $c=$c -replace 'ASSET_URL=.*\r?\n',''
    $c=$c -replace 'VITE_REVERB_HOST=.*','VITE_REVERB_HOST=localhost'
    $c=$c -replace 'VITE_REVERB_PORT=.*','VITE_REVERB_PORT=8080'
    $c=$c -replace 'VITE_REVERB_SCHEME=.*','VITE_REVERB_SCHEME=http'
    Set-Content $envPath $c -NoNewline
  }
  if(Test-Path "$root\public\hot"){ Remove-Item "$root\public\hot" -Force }
  Ensure-Reverb
  npm run build | Out-Host
  Restart-Serve
  Write-Host "Local OK. Run 'npm run dev' for HMR."
  exit 0
}
Write-Host "=== TUNNEL MODE (prod build) ==="
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Copy-Item $envPath $bak -Force
Ensure-Reverb
$vitePid=(Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
if($vitePid){ Stop-Process -Id $vitePid -Force -ErrorAction SilentlyContinue; Write-Host "killed vite $vitePid" }
if(Test-Path "$root\public\hot"){ Remove-Item "$root\public\hot" -Force; Write-Host "removed public/hot" }
Remove-Item $log,$log2 -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
Write-Host "starting cloudflared 8000..."
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx --yes cloudflared tunnel --url http://localhost:8000 --no-autoupdate > `"$log`" 2>&1" -WindowStyle Hidden
Write-Host "starting cloudflared 8080 (reverb)..."
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx --yes cloudflared tunnel --url http://localhost:8080 --no-autoupdate > `"$log2`" 2>&1" -WindowStyle Hidden
$appUrl=$null; $reverbUrl=$null; $t=0
while($t -lt 45 -and (-not $appUrl -or -not $reverbUrl)){
  Start-Sleep 2; $t+=2
  if(-not $appUrl -and (Test-Path $log)){ $m=Select-String -Path $log -Pattern "https://.*trycloudflare\.com" | Select-Object -Last 1; if($m){ $appUrl=$m.Matches.Value.Trim() } }
  if(-not $reverbUrl -and (Test-Path $log2)){ $m=Select-String -Path $log2 -Pattern "https://.*trycloudflare\.com" | Select-Object -Last 1; if($m){ $reverbUrl=$m.Matches.Value.Trim() } }
  Write-Host "." -NoNewline
}
Write-Host ""
if(-not $appUrl){ Write-Host "fail app tunnel"; Get-Content $log | Select-Object -Last 20 | Out-Host; exit 1 }
if(-not $reverbUrl){ Write-Host "fail reverb tunnel"; Get-Content $log2 | Select-Object -Last 20 | Out-Host; exit 1 }
$reverbHost=$reverbUrl -replace 'https://','' -replace '/',''
Write-Host "APP tunnel: $appUrl"
Write-Host "REVERB tunnel: $reverbUrl ($reverbHost)"
$c=Get-Content $envPath -Raw
$c=$c -replace 'APP_URL=.*',"APP_URL=$appUrl"
if($c -match 'ASSET_URL='){ $c=$c -replace 'ASSET_URL=.*',"ASSET_URL=$appUrl" } else { $c+="`nASSET_URL=$appUrl" }
$c=$c -replace 'VITE_REVERB_HOST=.*',"VITE_REVERB_HOST=$reverbHost"
$c=$c -replace 'VITE_REVERB_PORT=.*',"VITE_REVERB_PORT=443"
$c=$c -replace 'VITE_REVERB_SCHEME=.*',"VITE_REVERB_SCHEME=https"
Set-Content $envPath $c -NoNewline
Get-Content $envPath | Select-String "APP_URL|ASSET_URL|VITE_REVERB" | Out-Host
npm run build | Out-Host
Restart-Serve
Write-Host ""
Write-Host "=== READY ===" -ForegroundColor Green
Write-Host "App: $appUrl" -ForegroundColor Cyan
Write-Host "Reverb: $reverbUrl" -ForegroundColor Cyan
Write-Host "Local: http://localhost:8000"
Write-Host "Stop: .\tunnel.ps1 -Local  OR  Get-Process cloudflared | Stop-Process -Force"
