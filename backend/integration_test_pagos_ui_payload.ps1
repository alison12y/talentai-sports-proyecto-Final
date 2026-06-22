$base='http://127.0.0.1:8000/api'
$pagos = Invoke-RestMethod -Uri "$base/pagos/" -Method Get
$pago = $pagos | Where-Object { ([string]$_.estado).ToUpper() -eq 'PENDIENTE' } | Select-Object -First 1
if (-not $pago) { Write-Output 'NO_PENDING'; exit 3 }
$jugador = $pago.jugador
$pagoid = $pago.id
Write-Output "Found $pagoid"
Invoke-RestMethod -Uri "$base/pagos/$pagoid/simular-pago-exitoso/" -Method Post -ContentType 'application/json' -Body '{"referencia":"STRIPE-SIM-PORTAL","referencia_simulada":"STRIPE-SIM-PORTAL"}' | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$base/pagos/?jugador=$jugador" -Method Get | ConvertTo-Json -Depth 6
