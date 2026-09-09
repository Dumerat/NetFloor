#!/usr/bin/env bash
# ==============================================================================
# Démarrage automatisé du Lab de test NetFloor (LDAP + SNMP)
# ==============================================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo -e "\033[1;36m========================================================\033[0m"
echo -e "\033[1;36m   🚀 DÉMARRAGE DU LAB DE TEST NETFLOOR (AD/LDAP + SNMP)\033[0m"
echo -e "\033[1;36m========================================================\033[0m\n"

# 1. Vérification Docker
if ! docker info >/dev/null 2>&1; then
    echo -e "\033[1;31m❌ Erreur : Le moteur Docker n'est pas démarré.\033[0m"
    exit 1
fi

# 2. Lancement des conteneurs
echo -e "\033[1;33m📦 Démarrage des conteneurs du lab...\033[0m"
docker compose up -d

echo -e "\n\033[0;37m⏳ Attente de l'initialisation des services (5s)...\033[0m"
sleep 5

# 3. Vérification de l'état
echo -e "\n\033[1;33m🔍 Vérification des conteneurs :\033[0m"
docker compose ps

# 4. Initialisation automatique de l'annuaire LDAP
echo -e "\n\033[1;33m🌱 Vérification des comptes de l'annuaire (10 collaborateurs NetFloor)...\033[0m"
if ! docker exec netfloor-lab-ldap ldapsearch -x -H ldap://localhost -b "dc=company,dc=com" "(uid=alexandre.martin)" 2>&1 | grep -q "alexandre.martin"; then
    docker exec netfloor-lab-ldap ldapadd -x -H ldap://localhost -D "cn=admin,dc=company,dc=com" -w "adminpassword" -f /ldap-seed/01-bootstrap.ldif >/dev/null 2>&1
    echo -e "\033[1;32m  ✅ 10 collaborateurs et machines importés avec succès dans l'annuaire !\033[0m"
else
    echo -e "\033[1;32m  ✅ Annuaire déjà peuplé (10 collaborateurs présents).\033[0m"
fi

# 5. Affichage du récapitulatif
echo -e "\n\033[1;36m========================================================\033[0m"
echo -e "\033[1;36m   🎉 LAB OPÉRATIONNEL & PRÊT POUR LES TESTS\033[0m"
echo -e "\033[1;36m========================================================\033[0m\n"

echo -e "\033[1;32m📁 1. ANNUAIRE D'ENTREPRISE (AD / LDAP)\033[0m"
echo -e "   - Hôte LDAP       : localhost:389 / localhost:636"
echo -e "   - Base DN         : dc=company,dc=com"
echo -e "   - Admin Bind DN   : cn=admin,dc=company,dc=com (mdp: adminpassword)"
echo -e "   - Console Web     : http://localhost:8088 (phpLDAPadmin)\n"

echo -e "\033[1;32m📡 2. SIMULATEUR D'ÉQUIPEMENTS RÉSEAU (SNMP)\033[0m"
echo -e "   - Endpoint        : 127.0.0.1:161 (UDP)"
echo -e "   - Switch Cisco    : Communautés 'public' et 'public_ro'"
echo -e "   - Baie APC PDU    : Communauté 'apc_rack'\n"

echo -e "\033[1;33m🧪 3. COMMANDES UTILES\033[0m"
echo -e "   - Stopper le lab  : docker compose down"
echo -e "   - Reset complet   : docker compose down -v\n"
