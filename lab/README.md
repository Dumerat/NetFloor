# 🧪 NetFloor Lab - Environnement de Test Isolé (AD/LDAP & SNMP)

Ce dossier contient un environnement de simulation complet, conteneurisé avec **Docker Compose**, pour tester l'application **NetFloor** face à un annuaire d'entreprise (**Active Directory / LDAP**) et des équipements réseau virtuels (**SNMP**).

---

## 🚀 Démarrage Rapide

### Sous Windows (PowerShell)
```powershell
cd lab
.\start-lab.ps1
```

### Sous Linux / macOS / WSL
```bash
cd lab
chmod +x start-lab.sh
./start-lab.sh
```

### Ou via Docker Compose standard :
```bash
cd lab
docker compose up -d
```

---

## 🏗️ Services Déployés

| Service | Conteneur | Ports Exposés | Rôle & Description |
| :--- | :--- | :--- | :--- |
| **OpenLDAP (AD)** | `netfloor-lab-ldap` | `389` (LDAP), `636` (LDAPS) | Annuaire d'entreprise avec schéma AD/LDAP et 10 collaborateurs pré-injectés. |
| **phpLDAPadmin** | `netfloor-lab-ldap-admin` | `8088` (HTTP) | Interface web pour visualiser et administrer l'annuaire graphiquement. |
| **SNMP Simulator** | `netfloor-lab-snmpsim` | `161/udp` (SNMP) | Simulateur d'équipements : Switch Cisco 24 ports + Baie serveur APC. |

---

## 🔐 Identifiants & Accès

### 1. Annuaire LDAP / Active Directory
* **Hôte** : `localhost` ou `127.0.0.1` (Port `389`)
* **Base DN** : `dc=company,dc=com`
* **Compte Administrateur** :
  * **Bind DN** : `cn=admin,dc=company,dc=com`
  * **Mot de passe** : `adminpassword`
* **Compte Lecture Seule (Read-Only)** :
  * **Bind DN** : `cn=readonly,dc=company,dc=com`
  * **Mot de passe** : `readonlypassword`
* **Comptes utilisateurs créés** (mot de passe par défaut : `Password123!`) :
  * `alexandre.martin` (Tech Lead Fullstack - Tech Lab)
  * `sarah.benali` (RH & Recrutement)
  * `thomas.dubois` (Admin Réseau & Sécurité - DSI)
  * `julie.moreau` (Office Manager)
  * `emma.petit` (UI/UX Designer)
  * `marc.lefebvre` (Directeur Financier)
  * `antoine.roux` (Technicien Support & Câblage)
  * `lea.bernard` (Juriste & DPO)
  * `maxime.girard` (DevOps & Cloud Architect)
  * `chloe.rousseau` (Communication)

### 2. Interface Web phpLDAPadmin
* **URL** : [http://localhost:8088](http://localhost:8088)
* **Login** : `cn=admin,dc=company,dc=com`
* **Password** : `adminpassword`

### 3. Simulateur SNMP
* **Hôte** : `127.0.0.1` (Port `161/udp`)
* **Communautés supportées** :
  * `public` et `public_ro` : Commutateur **Cisco Catalyst 9300** (`SW-ACCESS-4A-U22`).
    * MIB-II (`sysDescr`, `sysName`, `sysUpTime`)
    * IF-MIB : 24 ports GigabitEthernet (états Up/Down, vitesse 1 Gbps, compteurs octets)
    * BRIDGE-MIB (`dot1dTpFdbTable`) : Table des adresses MAC par port (ex: PC d'Alexandre Martin sur le port 12)
    * Télémétrie Cisco : CPU (12%), RAM (44%), Température interne (36.5°C)
  * `apc_rack` : Baie Serveur **APC NetShelter SX 42U** (`BAIE-PRINCIPALE-RDC`).
    * Sonde de température de baie : `21 °C`
    * Consommation PDU : `5.0 A` / `1150 W`

---

## 🧪 Valider le Lab

Pour exécuter un test automatique des requêtes LDAP et SNMP :
```powershell
cd lab
.\test-lab.ps1
```

Exemple de commande manuelle SNMP depuis votre machine (si `snmp-tools` est installé) :
```bash
# Interroger le nom du switch Cisco
snmpget -v2c -c public 127.0.0.1:161 1.3.6.1.2.1.1.5.0

# Récupérer la température de la baie APC
snmpget -v2c -c apc_rack 127.0.0.1:161 1.3.6.1.4.1.318.1.1.10.2.3.2.1.4.1
```

---

## 🛑 Arrêt et Nettoyage

* Pour arrêter les conteneurs :
  ```bash
  docker compose down
  ```
* Pour réinitialiser complètement la base LDAP et recommencer à zéro :
  ```bash
  docker compose down -v
  ```
