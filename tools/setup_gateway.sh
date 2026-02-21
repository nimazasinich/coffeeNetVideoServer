#!/bin/bash
# SmartCopy Pro – Network Gateway Setup
# Sets up Linux-based captive portal for café WiFi SSID
# Tested on Ubuntu 22.04 / Debian 11
#
# Usage: sudo bash tools/setup_gateway.sh <SERVER_IP> <WIFI_INTERFACE>
# Example: sudo bash tools/setup_gateway.sh 192.168.1.100 wlan0

set -e

SERVER_IP="${1:-192.168.1.100}"
WIFI_IFACE="${2:-wlan0}"
PORTAL_IP="192.168.100.1"
DHCP_RANGE="192.168.100.10,192.168.100.200"

echo "=== SmartCopy Pro Network Gateway Setup ==="
echo "Server IP   : $SERVER_IP"
echo "WiFi Iface  : $WIFI_IFACE"
echo "Portal IP   : $PORTAL_IP"

# ─── Install packages ─────────────────────────────────────────────────────────
apt-get update -qq
apt-get install -y dnsmasq iptables-persistent hostapd python3 python3-pip qrencode

# ─── Configure hostapd (WiFi AP) ─────────────────────────────────────────────
cat > /etc/hostapd/hostapd.conf << EOF
interface=$WIFI_IFACE
driver=nl80211
ssid=SmartCopy-Free-WiFi
hw_mode=g
channel=6
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=0
EOF

# Enable hostapd
sed -i 's/#DAEMON_CONF/DAEMON_CONF/' /etc/default/hostapd
echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' >> /etc/default/hostapd

# ─── Assign static IP to WiFi interface ─────────────────────────────────────
ip addr flush dev $WIFI_IFACE || true
ip addr add $PORTAL_IP/24 dev $WIFI_IFACE
ip link set $WIFI_IFACE up

# ─── Configure dnsmasq (DHCP + DNS redirect) ──────────────────────────────────
cat > /etc/dnsmasq.d/smartcopy-portal.conf << EOF
# DHCP for WiFi clients
interface=$WIFI_IFACE
dhcp-range=$DHCP_RANGE,12h
dhcp-option=3,$PORTAL_IP
dhcp-option=6,$PORTAL_IP

# DNS: redirect everything to our IP (captive portal trick)
address=/#/$PORTAL_IP

# Set proper hostname
domain=smartcopy.local
EOF

# ─── iptables: captive portal redirect ───────────────────────────────────────
# Flush old rules
iptables -t nat -F
iptables -F

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A FORWARD -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow DNS and DHCP from WiFi clients
iptables -A INPUT -i $WIFI_IFACE -p udp --dport 53 -j ACCEPT
iptables -A INPUT -i $WIFI_IFACE -p udp --dport 67 -j ACCEPT

# Redirect HTTP from WiFi clients to our portal (port 8080)
iptables -t nat -A PREROUTING -i $WIFI_IFACE -p tcp --dport 80 \
    -j DNAT --to-destination $PORTAL_IP:8080

# Redirect HTTPS (best-effort, clients will get SSL error then get portal)
iptables -t nat -A PREROUTING -i $WIFI_IFACE -p tcp --dport 443 \
    -j DNAT --to-destination $PORTAL_IP:8080

# NAT to let portal access main server
iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
iptables -A FORWARD -i $WIFI_IFACE -o eth0 -j ACCEPT

# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf

# Save iptables rules
netfilter-persistent save

# ─── Captive portal web server ────────────────────────────────────────────────
cat > /opt/smartcopy_portal.py << PYEOF
#!/usr/bin/env python3
"""
Minimal captive portal HTTP server.
Redirects all requests to the SmartCopy catalog page.
"""
import http.server
import socketserver
import urllib.parse

CATALOG_URL = "http://$SERVER_IP:3000"

class CaptivePortalHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        # Respond to Apple, Android, Windows captive portal probes
        probe_paths = [
            "/hotspot-detect.html", "/generate_204", "/connecttest.txt",
            "/ncsi.txt", "/redirect", "/canonical.html",
        ]
        if any(self.path.startswith(p) for p in probe_paths):
            # Android expects 204 after authentication
            self.send_response(302)
            self.send_header("Location", CATALOG_URL)
            self.end_headers()
            return

        # Main redirect
        self.send_response(302)
        self.send_header("Location", CATALOG_URL)
        self.end_headers()
        html = f"""<!DOCTYPE html>
<html><head><meta http-equiv="refresh" content="2;url={CATALOG_URL}">
<title>SmartCopy – Welcome</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px">
<h1>🎬 Welcome to SmartCopy!</h1>
<p>Redirecting to our media catalog…</p>
<a href="{CATALOG_URL}">Click here if not redirected</a>
</body></html>"""
        self.wfile.write(html.encode())

    def log_message(self, fmt, *args):
        pass  # suppress noisy logs

if __name__ == "__main__":
    with socketserver.TCPServer(("0.0.0.0", 8080), CaptivePortalHandler) as httpd:
        print(f"Captive portal running on :8080 → {CATALOG_URL}")
        httpd.serve_forever()
PYEOF

chmod +x /opt/smartcopy_portal.py

# Create systemd service for portal
cat > /etc/systemd/system/smartcopy-portal.service << EOF
[Unit]
Description=SmartCopy Captive Portal
After=network.target

[Service]
ExecStart=/usr/bin/python3 /opt/smartcopy_portal.py
Restart=always
User=nobody

[Install]
WantedBy=multi-user.target
EOF

# ─── Generate QR code fallback ────────────────────────────────────────────────
qrencode -o /opt/smartcopy_qr.png "http://$SERVER_IP:3000" && \
    echo "QR code saved to /opt/smartcopy_qr.png"

# ─── Start services ───────────────────────────────────────────────────────────
systemctl daemon-reload
systemctl enable hostapd dnsmasq smartcopy-portal
systemctl restart hostapd dnsmasq
systemctl start smartcopy-portal

echo ""
echo "=== Gateway Setup Complete ==="
echo "WiFi SSID    : SmartCopy-Free-WiFi (open)"
echo "Portal URL   : http://$PORTAL_IP:8080"
echo "Catalog URL  : http://$SERVER_IP:3000"
echo ""
echo "Clients connecting to 'SmartCopy-Free-WiFi' will be redirected to the catalog."
echo "QR code at: /opt/smartcopy_qr.png (print and display in café)"
