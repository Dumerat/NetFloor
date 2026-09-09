# ==============================================================================
# Demarrage automatise du Lab de test NetFloor (LDAP + SNMP)
# ==============================================================================
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   DEMARRAGE DU LAB DE TEST NETFLOOR (AD/LDAP + SNMP)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$LabDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $LabDir

# 1. Verification Docker
try {
    docker info > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Docker non disponible"
    }
} catch {
    Write-Host "[X] Erreur : Le moteur Docker n est pas demarre." -ForegroundColor Red
    Write-Host "    Veuillez lancer Docker Desktop puis relancer ce script." -ForegroundColor Yellow
    exit 1
}

# 2. Lancement des conteneurs
Write-Host "[+] Demarrage des conteneurs du lab..." -ForegroundColor Yellow
docker compose up -d

Write-Host ""
Write-Host "[*] Attente de l initialisation des services (5s)..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# 3. Verification des conteneurs
Write-Host ""
Write-Host "[*] Etat des conteneurs :" -ForegroundColor Yellow
$containers = docker compose ps --format "{{.Service}}: {{.State}} ({{.Status}})"
foreach ($c in $containers) {
    if ($c -match "running") {
        Write-Host "  [OK] $c" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] $c" -ForegroundColor Yellow
    }
}

# 4. Initialisation automatique des comptes LDAP
Write-Host ""
Write-Host "[*] Verification des comptes de l annuaire..." -ForegroundColor Yellow
$checkUser = docker exec netfloor-lab-ldap ldapsearch -x -H ldap://localhost -b "dc=company,dc=com" "(uid=alexandre.martin)" 2>&1
if ($checkUser -notmatch "alexandre.martin") {
    docker exec netfloor-lab-ldap ldapadd -x -H ldap://localhost -D "cn=admin,dc=company,dc=com" -w "adminpassword" -f /ldap-seed/01-bootstrap.ldif > $null 2>&1
    Write-Host "  [OK] 10 collaborateurs et equipements importes dans l annuaire !" -ForegroundColor Green
} else {
    Write-Host "  [OK] Annuaire deja initialise (10 collaborateurs presents)." -ForegroundColor Green
}

# 5. Recapitulatif des acces
Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   LAB OPERATIONNEL ET PRET POUR LES TESTS" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "1. ANNUAIRE D ENTREPRISE (AD / LDAP)" -ForegroundColor Green
Write-Host "   - Hote LDAP       : localhost:389 / localhost:636"
Write-Host "   - Base DN         : dc=company,dc=com"
Write-Host "   - Admin Bind DN   : cn=admin,dc=company,dc=com"
Write-Host "   - Mot de passe    : adminpassword"
Write-Host "   - Utilisateur RO  : cn=readonly,dc=company,dc=com (mdp: readonlypassword)"
Write-Host "   - Console Web     : http://localhost:8088 (phpLDAPadmin)"

Write-Host ""
Write-Host "2. SIMULATEUR D EQUIPEMENTS RESEAU (SNMP)" -ForegroundColor Green
Write-Host "   - Endpoint        : 127.0.0.1:161 (UDP)"
Write-Host "   - Switch Cisco    : Communautes 'public' et 'public_ro'"
Write-Host "   - Baie APC PDU    : Communaute 'apc_rack'"

Write-Host ""
Write-Host "3. COMMANDES UTILES" -ForegroundColor Yellow
Write-Host "   - Valider le lab  : .\test-lab.ps1"
Write-Host "   - Stopper le lab  : docker compose down"
Write-Host "   - Reset complet   : docker compose down -v"
Write-Host ""
