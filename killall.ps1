Get-Process -Name "node","tsx" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Killing $($_.Name) PID $($_.Id)"
    $_ | Stop-Process -Force
}
Write-Host "Done"
