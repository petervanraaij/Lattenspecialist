param(
  [Parameter(Mandatory=$true)][string]$ApkPath,
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [string]$AndroidSdk=$env:ANDROID_HOME,
  [string]$JavaHome=$env:JAVA_HOME,
  [string]$SigningDirectory=(Join-Path $env:LOCALAPPDATA 'Lattenspecialist/Signing')
)
$ErrorActionPreference='Stop'
$aapt=Join-Path $AndroidSdk 'build-tools/36.0.0/aapt.exe'
$align=Join-Path $AndroidSdk 'build-tools/36.0.0/zipalign.exe'
$signer=Join-Path $AndroidSdk 'build-tools/36.0.0/lib/apksigner.jar'
$java=Join-Path $JavaHome 'bin/java.exe'
$key=Join-Path $SigningDirectory 'lattenspecialist-staff-upload.p12'
$protectedPassword=Join-Path $SigningDirectory 'staff-password.dpapi'
foreach($file in @($ApkPath,$aapt,$align,$signer,$java,$key,$protectedPassword)){
  if(!(Test-Path -LiteralPath $file -PathType Leaf)){throw "Benodigd bestand ontbreekt: $file"}
}
$badging=& $aapt dump badging $ApkPath
$identity=$badging[0]
if($LASTEXITCODE -ne 0 -or $identity -notmatch "name='nl\.lattenspecialist\.medewerkers' " -or $identity -match '-dev'){
  throw 'Alleen de gewone medewerkersapp mag als release worden ondertekend.'
}
$expected='c172da4620f071b693ae1e673c14ed733b2c7601627c57cc7ef0fa0f4bf3e81c'
$previousPassword=$env:LS_STAFF_RELEASE_SIGN_PASSWORD
$aligned=Join-Path ([IO.Path]::GetTempPath()) ('ls-staff-'+[guid]::NewGuid().ToString('N')+'.apk')
try{
  $secure=ConvertTo-SecureString (Get-Content -LiteralPath $protectedPassword -Raw).Trim()
  $env:LS_STAFF_RELEASE_SIGN_PASSWORD=[Net.NetworkCredential]::new('',$secure).Password
  & $align -P 16 -f 4 $ApkPath $aligned
  if($LASTEXITCODE -ne 0){throw 'Uitlijnen van de app is mislukt.'}
  & $java -jar $signer sign --ks $key --ks-key-alias lattenspecialist-staff --ks-pass env:LS_STAFF_RELEASE_SIGN_PASSWORD --key-pass env:LS_STAFF_RELEASE_SIGN_PASSWORD --out $OutputPath $aligned
  if($LASTEXITCODE -ne 0){throw 'Ondertekenen is mislukt.'}
  $verification=& $java -jar $signer verify --verbose --print-certs $OutputPath
  if($LASTEXITCODE -ne 0 -or ($verification -join "`n") -notmatch $expected){throw 'De ondertekening komt niet overeen met de gewone app 1.1.1.'}
  & $align -c -P 16 4 $OutputPath
  if($LASTEXITCODE -ne 0){throw 'Controle van de uitlijning is mislukt.'}
  Write-Output 'Gewone medewerkersapp ondertekend en gecontroleerd met dezelfde identiteit als 1.1.1.'
}finally{
  $env:LS_STAFF_RELEASE_SIGN_PASSWORD=$previousPassword
  if(Test-Path -LiteralPath $aligned){Remove-Item -LiteralPath $aligned}
}
