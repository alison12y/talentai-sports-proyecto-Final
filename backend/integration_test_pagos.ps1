$base='http://127.0.0.1:8000/api'
try {
    $pagos = Invoke-RestMethod -Uri "$base/pagos/" -Method Get
} catch {
    Write-Output "ERROR_FETCH_PAGOS: $($_.Exception.Message)"
    exit 2
}

$pago = $pagos | Where-Object { ([string]$_.estado).ToUpper() -eq 'PENDIENTE' } | Select-Object -First 1
if (-not $pago) {
    Write-Output 'NO_PENDING_PAYMENT_FOUND'
    exit 3
}

$jugador = $pago.jugador
$pagoid = $pago.id
Write-Output "Selected pago id: $pagoid jugador: $jugador"

function TryInvoke($desc, $scriptblock) {
    Write-Output "=== $desc ==="
    try {
        $res = & $scriptblock
        $json = $res | ConvertTo-Json -Depth 6
        Write-Output $json
    } catch {
        Write-Output ([string]::Format('ERROR {0}: {1}', $desc, $_.Exception.Message))
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader ($_.Exception.Response.GetResponseStream())
            $body = $reader.ReadToEnd()
            Write-Output 'Response Body:'
            Write-Output $body
        }
    }
}

TryInvoke "GET pagos by jugador" { Invoke-RestMethod -Uri "$base/pagos/?jugador=$jugador" -Method Get }
TryInvoke "POST iniciar-pago-stripe" { Invoke-RestMethod -Uri "$base/pagos/$pagoid/iniciar-pago-stripe/" -Method Post -ContentType 'application/json' -Body '{}' }
TryInvoke "POST simular-pago-exitoso" { Invoke-RestMethod -Uri "$base/pagos/$pagoid/simular-pago-exitoso/" -Method Post -ContentType 'application/json' -Body '{"referencia":"TEST-SIM-001"}' }
TryInvoke "GET pagos by jugador (after)" { Invoke-RestMethod -Uri "$base/pagos/?jugador=$jugador" -Method Get }
