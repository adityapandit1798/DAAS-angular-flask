#!/bin/sh
set -euo pipefail

echo "🚀 Setting up Docker Host for DaaS (Docker-as-a-Service)"

# === 1. System Setup ===
echo "📦 Updating system and installing Docker..."
apk update
apk add docker openrc

# Enable Docker on boot
rc-update add docker boot

# === 2. Add User (if not exists) ===
USERNAME="dockeruser"
if ! id "$USERNAME" >/dev/null 2>&1; then
    echo "👥 Creating user: $USERNAME"
    adduser -D -s /bin/sh "$USERNAME"
    echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
fi

# === 3. Start Docker (if not running) ===
if ! rc-service docker status >/dev/null 2>&1; then
    echo "🐳 Starting Docker..."
    rc-service docker start
else
    echo "🐳 Docker is already running."
fi

# === 4. Generate TLS Certs ===
TLS_DIR="/etc/docker/tls"
mkdir -p "$TLS_DIR"
cd "$TLS_DIR"

# === Detect IP from eth1 using BusyBox-compatible method ===
echo "🔍 Detecting IP address on eth1 (Alpine/BusyBox compatible)..."
IP=""
if ip link show eth1 >/dev/null 2>&1; then
    IP=$(ip addr show eth1 | awk '/inet / {print $2}' | cut -d'/' -f1 | head -n1)
fi

# Validate IP
if [ -z "$IP" ] || ! echo "$IP" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
    echo "❌ Could not detect a valid IP address on eth1."
    echo "💡 Make sure eth1 is up and has an IPv4 address."
    echo "📄 Here's what 'ip addr show eth1' returns:"
    ip addr show eth1
    exit 1
fi

echo "✅ Detected IP: $IP"

# Backup old certs (optional)
if [ -f "ca.pem" ] || [ -f "server-cert.pem" ]; then
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    echo "💾 Backing up old certs to backup-${TIMESTAMP}/"
    mkdir -p "backup-${TIMESTAMP}"
    cp -f *.pem *.key *.csr *.cnf *.srl "backup-${TIMESTAMP}/" 2>/dev/null || true
    echo "📁 Backup complete."
fi

# === Generate CA ===
echo "🔐 Generating new CA..."
openssl genrsa -out ca-key.pem 4096 >/dev/null 2>&1
openssl req -new -x509 -days 365 -key ca-key.pem -sha256 -out ca.pem -subj "/CN=Docker CA" >/dev/null 2>&1
echo "✅ CA generated."

# === Generate Server Cert for CURRENT IP ===
echo "🔐 Generating server certificate for IP: $IP..."
openssl genrsa -out server-key.pem 4096 >/dev/null 2>&1
openssl req -new -key server-key.pem -out server.csr -subj "/CN=$IP" >/dev/null 2>&1

# Create extfile with SAN for current IP
cat > extfile.cnf <<EOF
subjectAltName = IP:$IP,IP:127.0.0.1,DNS:localhost
extendedKeyUsage = serverAuth
EOF

openssl x509 -req -days 365 -in server.csr -CA ca.pem -CAkey ca-key.pem -CAcreateserial -out server-cert.pem -extfile extfile.cnf >/dev/null 2>&1
echo "✅ Server certificate generated for: $IP"

# === Generate Client Cert ===
echo "🔐 Generating client certificate..."
openssl genrsa -out key.pem 4096 >/dev/null 2>&1
openssl req -new -key key.pem -out client.csr -subj "/CN=client" >/dev/null 2>&1

cat > extfile-client.cnf <<EOF
extendedKeyUsage = clientAuth
EOF

openssl x509 -req -days 365 -in client.csr -CA ca.pem -CAkey ca-key.pem -CAcreateserial -out cert.pem -extfile extfile-client.cnf >/dev/null 2>&1
echo "✅ Client certificate generated."

# === Cleanup ===
echo "🧹 Cleaning up temporary files..."
rm -f server.csr client.csr extfile.cnf extfile-client.cnf

chmod 400 ca-key.pem server-key.pem key.pem
chmod 644 ca.pem server-cert.pem cert.pem

# === Configure Docker ===
echo "⚙️  Configuring Docker daemon for TLS..."
cat > /etc/conf.d/docker <<EOF
DOCKER_OPTS="--tlsverify --tlscacert=/etc/docker/tls/ca.pem --tlscert=/etc/docker/tls/server-cert.pem --tlskey=/etc/docker/tls/server-key.pem -H tcp://0.0.0.0:2376 -H unix:///var/run/docker.sock"
EOF

# === Restart Docker ===
echo "🔄 Restarting Docker with TLS enabled..."
rc-service docker restart

# Wait and verify
sleep 3

if netstat -tln | grep -q ':2376 ' 2>/dev/null || ss -tln 2>/dev/null | grep -q ':2376 '; then
    echo "✅ Docker is listening on port 2376 (TLS)."
else
    echo "⚠️  Warning: Docker may not be listening on 2376. Check logs with: rc-service docker status"
fi

# === Set Permissions ===
echo "🔐 Setting permissions for user: $USERNAME"
chown -R "$USERNAME":"$USERNAME" /etc/docker/tls
chmod 644 /etc/docker/tls/ca.pem /etc/docker/tls/cert.pem /etc/docker/tls/key.pem

# === Output Client Certs ===
echo
echo "✅✅✅ DOCKER TLS SETUP COMPLETE ✅✅✅"
echo

# === 9. Generate SCP Instructions ===
echo
echo "📥 SCP COMMANDS TO COPY CERTS TO YOUR LOCAL MACHINE:"
echo
echo "mkdir -p ~/docker-certs/$IP && cd ~/docker-certs/$IP"
echo "scp dockeruser@$IP:/etc/docker/tls/ca.pem ./"
echo "scp dockeruser@$IP:/etc/docker/tls/cert.pem ./"
echo "scp dockeruser@$IP:/etc/docker/tls/key.pem ./"
echo
echo "✅ Then test with:"
echo "docker --tlsverify --tlscacert=ca.pem --tlscert=cert.pem --tlskey=key.pem -H tcp://$IP:2376 version"
echo


echo
echo "✅ TEST FROM CLIENT MACHINE:"
echo "docker --tlsverify \\"
echo "  --tlscacert=ca.pem \\"
echo "  --tlscert=cert.pem \\"
echo "  --tlskey=key.pem \\"
echo "  -H tcp://$IP:2376 version"
echo
echo "📌 CERT IS VALID ONLY FOR: $IP"
