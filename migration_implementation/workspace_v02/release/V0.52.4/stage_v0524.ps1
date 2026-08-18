# Stage V0.52.4 deploy bundle for NUC
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Src = Resolve-Path "$Root\..\..\ros2_ws\src\delivery_web"
$Out = "$env:TEMP\v0524_deploy"
$Nuc = "ubuntu@172.31.0.84"
$Remote = "/tmp/v0524_deploy"

if (Test-Path $Out) { Remove-Item -Recurse -Force $Out }
New-Item -ItemType Directory -Force -Path "$Out\delivery_web\blackbox" | Out-Null
New-Item -ItemType Directory -Force -Path "$Out\www\v2" | Out-Null
New-Item -ItemType Directory -Force -Path "$Out\www\debug" | Out-Null

Copy-Item "$Src\delivery_web\dashboard_node.py" "$Out\delivery_web\"
Copy-Item "$Src\delivery_web\web_auth.py" "$Out\delivery_web\"
Copy-Item "$Src\delivery_web\blackbox\*" "$Out\delivery_web\blackbox\" -Recurse
Copy-Item "$Src\www\index.html" "$Out\www\"
Copy-Item "$Src\www\auth.js" "$Out\www\"
Copy-Item "$Src\www\alert_queue.js" "$Out\www\"
Copy-Item "$Src\www\widgets.js" "$Out\www\"
Copy-Item "$Src\www\v2\*" "$Out\www\v2\" -Recurse
Copy-Item "$Src\www\debug\index.html" "$Out\www\debug\"
Copy-Item "$Root\blackbox_deploy_nuc.sh" "$Out\"
Copy-Item "$Root\blackbox_verify_nuc.sh" "$Out\"

Write-Host "Staged to $Out"
Write-Host "Uploading to ${Nuc}:${Remote} ..."
ssh $Nuc "rm -rf $Remote && mkdir -p $Remote"
scp -r "$Out\*" "${Nuc}:${Remote}/"
Write-Host "Run on NUC:"
Write-Host "  ssh $Nuc 'sed -i s/\r$// $Remote/*.sh; bash $Remote/blackbox_deploy_nuc.sh $Remote'"
Write-Host "  ssh $Nuc 'bash $Remote/blackbox_verify_nuc.sh'"
