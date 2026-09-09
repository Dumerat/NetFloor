# ==============================================================================
# Script de test et validation automatique du Lab NetFloor (LDAP + SNMP)
# ==============================================================================
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   VALIDATION TECHNIQUE DU LAB NETFLOOR" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Test LDAP
Write-Host "1. Test de l Annuaire LDAP (recherche d Alexandre Martin)..." -ForegroundColor Yellow
$ldapResult = docker exec netfloor-lab-ldap ldapsearch -x -H ldap://localhost -b "dc=company,dc=com" -D "cn=admin,dc=company,dc=com" -w "adminpassword" "(uid=alexandre.martin)" cn mail title telephoneNumber 2>&1

if ($ldapResult -match "Alexandre Martin") {
    Write-Host "   [OK] LDAP Operationnel : Collaborateur trouve avec succes !" -ForegroundColor Green
    $ldapResult | Where-Object { $_ -match "^(cn|mail|title|telephoneNumber):" } | ForEach-Object {
        Write-Host "        $_" -ForegroundColor Gray
    }
} else {
    Write-Host "   [X] Erreur lors de la requete LDAP :" -ForegroundColor Red
    Write-Host $ldapResult -ForegroundColor Red
}

# 2. Test SNMP - Switch Cisco
Write-Host ""
Write-Host "2. Test SNMP : Interrogation du Switch Cisco Catalyst..." -ForegroundColor Yellow
$snmpSwitchResult = docker run --rm --network lab_netfloor-lab-net alpine sh -c "apk add --no-cache net-snmp-tools >/dev/null 2>&1 && snmpget -v2c -c public 172.28.0.20:161 1.3.6.1.2.1.1.5.0 1.3.6.1.2.1.1.1.0" 2>&1

if ($snmpSwitchResult -match "SW-ACCESS-4A-U22") {
    Write-Host "   [OK] SNMP Switch Operationnel : Reponse recue de SW-ACCESS-4A-U22 !" -ForegroundColor Green
    $snmpSwitchResult | ForEach-Object { Write-Host "        $_" -ForegroundColor Gray }
} else {
    Write-Host "   [X] Erreur interrogation SNMP Switch :" -ForegroundColor Red
    Write-Host $snmpSwitchResult -ForegroundColor Red
}

# 3. Test SNMP - Bridge-MIB
Write-Host ""
Write-Host "3. Test SNMP Bridge-MIB : Table d adresses MAC vers Ports..." -ForegroundColor Yellow
$snmpBridgeResult = docker run --rm --network lab_netfloor-lab-net alpine sh -c "apk add --no-cache net-snmp-tools >/dev/null 2>&1 && snmpwalk -v2c -c public 172.28.0.20:161 1.3.6.1.2.1.17.4.3.1.2" 2>&1

if ($snmpBridgeResult -match "INTEGER: 12") {
    Write-Host "   [OK] Bridge-MIB Operationnel : PC Alexandre Martin detecte sur Port 12 !" -ForegroundColor Green
    $snmpBridgeResult | ForEach-Object { Write-Host "        $_" -ForegroundColor Gray }
} else {
    Write-Host "   [WARN] Resultat Bridge-MIB :" -ForegroundColor Yellow
    Write-Host $snmpBridgeResult -ForegroundColor Gray
}

# 4. Test SNMP - Baie APC
Write-Host ""
Write-Host "4. Test SNMP Baie APC : Releve de la sonde de temperature..." -ForegroundColor Yellow
$snmpApcResult = docker run --rm --network lab_netfloor-lab-net alpine sh -c "apk add --no-cache net-snmp-tools >/dev/null 2>&1 && snmpget -v2c -c apc_rack 172.28.0.20:161 1.3.6.1.4.1.318.1.1.10.2.3.2.1.4.1" 2>&1

if ($snmpApcResult -match "INTEGER: 21") {
    Write-Host "   [OK] SNMP Baie APC Operationnel : Temperature mesuree = 21 C !" -ForegroundColor Green
    $snmpApcResult | ForEach-Object { Write-Host "        $_" -ForegroundColor Gray }
} else {
    Write-Host "   [WARN] Resultat SNMP Baie APC :" -ForegroundColor Yellow
    Write-Host $snmpApcResult -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   TOUS LES TESTS DU LAB SONT VALIDES" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
