Set-Location "$PSScriptRoot"
Start-Process -NoNewWindow -FilePath "npx" -ArgumentList "electron ."
