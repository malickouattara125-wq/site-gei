# GEI Gestion - mise a jour automatique (lancee par DEMARRER).
# Telecharge depuis GitHub les fichiers de l'application listes dans fichiers.txt,
# seulement s'ils ont change. Les donnees (data, uploads, fichiers) ne sont jamais touchees.
$ErrorActionPreference = 'Stop'
$base = 'https://raw.githubusercontent.com/malickouattara125-wq/site-gei/claude/gifted-meitner-sl86x9/gestion-app/'
$ici = $PSScriptRoot
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $liste = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 -Uri ($base + 'fichiers.txt')).Content
  if ($liste -is [byte[]]) { $liste = [Text.Encoding]::UTF8.GetString($liste) }
  $local = Join-Path $ici 'fichiers.txt'
  if ((Test-Path $local) -and (([IO.File]::ReadAllText($local)).Trim() -eq $liste.Trim())) { Write-Host '   Application deja a jour.'; exit 0 }
  $fichiers = $liste -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') -and $_ -notmatch '\.\.' -and $_ -notmatch '^(data|uploads|fichiers)/' -and $_ -ne 'DEMARRER.bat' }
  if (-not ($fichiers -contains 'server.js')) { throw 'liste incomplete' }
  Write-Host '   Nouvelle version trouvee, telechargement...'
  $tmp = Join-Path $env:TEMP ('gei-maj-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $tmp | Out-Null
  foreach ($f in $fichiers) {
    $dest = Join-Path $tmp $f
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 -Uri ($base + $f) -OutFile $dest
  }
  foreach ($f in $fichiers) {
    $dest = Join-Path $ici $f
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    Copy-Item -LiteralPath (Join-Path $tmp $f) -Destination $dest -Force
  }
  [IO.File]::WriteAllText($local, $liste)
  Write-Host '   Application mise a jour.'
} catch {
  Write-Host '   Mise a jour impossible (pas d''Internet ?) : la version actuelle est utilisee.'
}
