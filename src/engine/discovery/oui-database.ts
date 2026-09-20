import { DiscoveredDeviceType } from "./types";

interface OuiEntry {
  vendor: string;
  defaultType: DiscoveredDeviceType;
}

/**
 * Base de données OUI (Organizationally Unique Identifier) des constructeurs réseau & terminaux d'entreprise.
 * Utilise les 3 premiers octets (24 bits) de l'adresse MAC.
 */
const OUI_MAP: Record<string, OuiEntry> = {
  // Cisco Systems
  "00:00:0C": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:01:42": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:01:43": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:01:63": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:01:64": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:01:96": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:01:97": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:01:C7": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:01:C9": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:81:C4": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:1A:A1": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:1A:A2": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:24:14": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "00:26:0B": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "54:7F:EE": { vendor: "Cisco Systems", defaultType: "SWITCH" },
  "F8:C0:01": { vendor: "Cisco Systems", defaultType: "SWITCH" },

  // Cisco IP Phones
  "00:04:4D": { vendor: "Cisco IP Phone", defaultType: "PHONE_VOIP" },
  "00:07:0E": { vendor: "Cisco IP Phone", defaultType: "PHONE_VOIP" },
  "00:08:21": { vendor: "Cisco IP Phone", defaultType: "PHONE_VOIP" },
  "00:13:C3": { vendor: "Cisco IP Phone", defaultType: "PHONE_VOIP" },
  "00:1D:45": { vendor: "Cisco IP Phone", defaultType: "PHONE_VOIP" },
  "00:22:90": { vendor: "Cisco IP Phone", defaultType: "PHONE_VOIP" },
  "00:23:EB": { vendor: "Cisco IP Phone", defaultType: "PHONE_VOIP" },

  // Aruba Networks / HPE
  "00:0B:86": { vendor: "Aruba Networks", defaultType: "SWITCH" },
  "00:1A:1E": { vendor: "Aruba Networks", defaultType: "ACCESS_POINT" },
  "00:24:6C": { vendor: "Aruba Networks", defaultType: "ACCESS_POINT" },
  "20:A6:CD": { vendor: "Aruba Networks", defaultType: "ACCESS_POINT" },
  "94:B4:0F": { vendor: "Aruba Networks", defaultType: "ACCESS_POINT" },
  "AC:A3:1E": { vendor: "Aruba Networks", defaultType: "SWITCH" },
  "D0:C7:C0": { vendor: "Aruba Networks", defaultType: "SWITCH" },
  "00:18:71": { vendor: "HPE ProCurve", defaultType: "SWITCH" },
  "00:25:61": { vendor: "HPE ProCurve", defaultType: "SWITCH" },
  "3C:D9:2B": { vendor: "Hewlett Packard Enterprise", defaultType: "SERVER" },

  // Ubiquiti Networks
  "00:15:6D": { vendor: "Ubiquiti Networks", defaultType: "ACCESS_POINT" },
  "00:27:22": { vendor: "Ubiquiti Networks", defaultType: "ACCESS_POINT" },
  "04:18:D6": { vendor: "Ubiquiti Networks", defaultType: "SWITCH" },
  "24:A4:3C": { vendor: "Ubiquiti Networks", defaultType: "ACCESS_POINT" },
  "44:D9:E7": { vendor: "Ubiquiti Networks", defaultType: "ACCESS_POINT" },
  "68:D7:9A": { vendor: "Ubiquiti Networks", defaultType: "SWITCH" },
  "74:83:C2": { vendor: "Ubiquiti Networks", defaultType: "SWITCH" },
  "80:2A:A8": { vendor: "Ubiquiti Networks", defaultType: "SWITCH" },
  "B4:FB:E4": { vendor: "Ubiquiti Networks", defaultType: "ACCESS_POINT" },
  "DC:9F:DB": { vendor: "Ubiquiti Networks", defaultType: "SWITCH" },
  "F4:92:BF": { vendor: "Ubiquiti Networks", defaultType: "SWITCH" },

  // Zyxel Communications
  "00:19:CB": { vendor: "Zyxel Communications", defaultType: "SWITCH" },
  "00:26:44": { vendor: "Zyxel Communications", defaultType: "SWITCH" },
  "40:4A:03": { vendor: "Zyxel Communications", defaultType: "SWITCH" },
  "50:67:F0": { vendor: "Zyxel Communications", defaultType: "SWITCH" },
  "BC:CF:4F": { vendor: "Zyxel Communications", defaultType: "SWITCH" },

  // Téléphonie VoIP (Polycom / Yealink / Mitel / Snom / Grandstream)
  "00:04:F2": { vendor: "Polycom", defaultType: "PHONE_VOIP" },
  "00:15:65": { vendor: "Yealink", defaultType: "PHONE_VOIP" },
  "80:5E:C0": { vendor: "Yealink", defaultType: "PHONE_VOIP" },
  "00:08:5D": { vendor: "Aastra / Mitel", defaultType: "PHONE_VOIP" },
  "00:04:13": { vendor: "Snom Technology", defaultType: "PHONE_VOIP" },
  "00:0B:82": { vendor: "Grandstream Networks", defaultType: "PHONE_VOIP" },

  // Imprimantes réseau
  "00:00:74": { vendor: "Ricoh", defaultType: "PRINTER" },
  "00:17:C8": { vendor: "Kyocera Document Solutions", defaultType: "PRINTER" },
  "00:21:B7": { vendor: "Lexmark International", defaultType: "PRINTER" },
  "00:26:73": { vendor: "Ricoh", defaultType: "PRINTER" },
  "00:80:77": { vendor: "Brother Industries", defaultType: "PRINTER" },
  "00:1B:A9": { vendor: "Brother Industries", defaultType: "PRINTER" },
  "00:00:85": { vendor: "Canon", defaultType: "PRINTER" },
  "00:1E:8F": { vendor: "Canon", defaultType: "PRINTER" },
  "00:26:AB": { vendor: "Seiko Epson", defaultType: "PRINTER" },
  "00:00:AA": { vendor: "Xerox Corporation", defaultType: "PRINTER" },

  // Postes de travail / PC / Laptops
  "00:14:22": { vendor: "Dell", defaultType: "WORKSTATION" },
  "00:1E:4F": { vendor: "Dell", defaultType: "WORKSTATION" },
  "18:03:73": { vendor: "Dell", defaultType: "WORKSTATION" },
  "28:F1:0E": { vendor: "Dell", defaultType: "WORKSTATION" },
  "34:17:EB": { vendor: "Dell", defaultType: "WORKSTATION" },
  "00:1F:29": { vendor: "HP Inc.", defaultType: "WORKSTATION" },
  "10:60:4B": { vendor: "HP Inc.", defaultType: "WORKSTATION" },
  "3C:52:82": { vendor: "HP Inc.", defaultType: "WORKSTATION" },
  "00:21:CC": { vendor: "Lenovo", defaultType: "WORKSTATION" },
  "20:76:93": { vendor: "Lenovo", defaultType: "WORKSTATION" },
  "54:EE:75": { vendor: "Lenovo", defaultType: "WORKSTATION" },
  "3C:06:30": { vendor: "Apple", defaultType: "WORKSTATION" },
  "AC:DE:48": { vendor: "Apple", defaultType: "WORKSTATION" },
  "F0:18:98": { vendor: "Apple", defaultType: "WORKSTATION" },

  // Serveurs / Virtualisation
  "00:0C:29": { vendor: "VMware", defaultType: "SERVER" },
  "00:50:56": { vendor: "VMware", defaultType: "SERVER" },
  "52:54:00": { vendor: "QEMU / KVM Virtual Machine", defaultType: "SERVER" },

  // Baies / Onduleurs / PDU
  "00:C0:B7": { vendor: "American Power Conversion (APC)", defaultType: "SERVER" },
};

/**
 * Normalise une adresse MAC vers le format standard FF:FF:FF:FF:FF:FF en majuscules.
 */
export function normalizeMac(rawMac: string): string {
  const cleaned = rawMac.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  if (cleaned.length !== 12) {
    return rawMac.trim().toUpperCase();
  }
  const pairs: string[] = [];
  for (let i = 0; i < 12; i += 2) {
    pairs.push(cleaned.slice(i, i + 2));
  }
  return pairs.join(":");
}

/**
 * Recherche le constructeur et le type probable d'équipement à partir de son adresse MAC.
 */
export function lookupOui(mac: string): { vendor: string; defaultType: DiscoveredDeviceType } {
  const norm = normalizeMac(mac);
  const prefix = norm.slice(0, 8); // "XX:XX:XX"

  const match = OUI_MAP[prefix];
  if (match) {
    return match;
  }

  // Fallbacks génériques sur les 2 premiers octets si vendor étendu
  if (norm.startsWith("00:50:56") || norm.startsWith("00:0C:29")) {
    return { vendor: "VMware", defaultType: "SERVER" };
  }
  if (norm.startsWith("52:54:00")) {
    return { vendor: "QEMU/KVM", defaultType: "SERVER" };
  }

  return {
    vendor: "Constructeur inconnu",
    defaultType: "WORKSTATION",
  };
}
