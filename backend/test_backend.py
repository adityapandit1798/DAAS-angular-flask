import json
import select
from io import StringIO

import paramiko
from flask import Flask
from flask_cors import CORS
from flask_sock import Sock

# --- Basic Flask App Setup ---
app = Flask(__name__)
# Allow connections from any origin for simple local file testing
CORS(app, origins="*")
sock = Sock(app)

# --- Hardcoded SSH Credentials ---
SSH_HOST = '192.168.192.163'
SSH_USER = 'docker-user'
SSH_PASS = 'password'

@sock.route('/ws')
def ssh_websocket_handler(ws):
    """
    A simplified WebSocket handler for testing the SSH connection.
    It does not require an initial auth message from the client.
    """
    print("[TEST_BACKEND] WebSocket connection received.")
    ssh_client = None
    channel = None

    try:
        # 1. Establish SSH connection with Paramiko
        print(f"[TEST_BACKEND] Attempting to connect to {SSH_USER}@{SSH_HOST}...")
        ssh_client = paramiko.SSHClient()
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh_client.connect(
            hostname=SSH_HOST,
            username=SSH_USER,
            password=SSH_PASS,
            timeout=10
        )
        print("[TEST_BACKEND] SSH connection successful.")
        ws.send(json.dumps({'output': 'Connection established. Opening shell...\r\n'}))

        # 2. Open an interactive shell
        channel = ssh_client.invoke_shell(term='xterm-color', width=80, height=24)
        print("[TEST_BACKEND] Shell opened. Entering proxy loop.")

        # 3. Proxy data between WebSocket and SSH channel
        while ws.connected and channel.active:
            # Check for readability on both the WebSocket and the SSH channel
            readable, _, _ = select.select([ws.sock, channel], [], [], 0.1)

            if ws.sock in readable:
                data_from_client = ws.receive(timeout=0)
                if data_from_client:
                    print(f"[TEST_BACKEND] >> Received from client: {data_from_client!r}")
                    channel.send(data_from_client)
                else:
                    print("[TEST_BACKEND] Client closed WebSocket.")
                    break

            if channel in readable:
                if channel.recv_ready():
                    data_from_ssh = channel.recv(1024).decode('utf-8', 'ignore')
                    print(f"[TEST_BACKEND] << Sending to client: {data_from_ssh!r}")
                    ws.send(json.dumps({'output': data_from_ssh}))

                if channel.exit_status_ready():
                    print("[TEST_BACKEND] SSH channel exited.")
                    break

    except Exception as e:
        error_message = f"Error: {str(e)}"
        print(f"❌ [TEST_BACKEND] Exception: {error_message}")
        try:
            ws.send(json.dumps({'error': error_message}))
        except Exception:
            pass  # WebSocket might already be closed
    finally:
        print("[TEST_BACKEND] Cleaning up and closing connections.")
        if channel:
            channel.close()
        if ssh_client:
            ssh_client.close()
        if ws.connected:
            ws.close()
        print("[TEST_BACKEND] Test connection closed.")

if __name__ == '__main__':
    print("--- This file is intended to be run with a WSGI server like Gunicorn ---")
    print("--- Example: gunicorn --worker-class gevent --bind 0.0.0.0:5001 test_backend:app ---")