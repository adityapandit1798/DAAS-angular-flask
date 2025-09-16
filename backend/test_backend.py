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
    A simplified WebSocket handler for testing the SSH connection to a container.
    It expects an initial auth message with container details.
    """
    print("[TEST_BACKEND] WebSocket connection received.")
    ssh_client = None
    channel = None

    try:
        # 1. Receive container details from the client
        init_params_raw = ws.receive(timeout=10)
        if not init_params_raw:
            ws.close(reason=1008, message='Initial parameters not received.')
            return

        params = json.loads(init_params_raw)
        container_id = params.get('containerId')
        container_shell = params.get('command', '/bin/sh')
        term_cols = params.get('cols', 80)
        term_rows = params.get('rows', 24)

        if not container_id:
            ws.send(json.dumps({'error': 'Container ID is required.'}))
            ws.close(reason=1008, message='Container ID not provided.')
            return

        # 2. Establish SSH connection with Paramiko
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

        # 3. Execute 'docker exec' directly with a PTY
        command_to_run = f"docker exec -it {container_id} {container_shell}"
        print(f"[TEST_BACKEND] Executing command directly: {command_to_run}")
        ws.send(json.dumps({'output': f'Attempting to connect to container {container_id}...\r\n'}))

        # Using exec_command with get_pty=True is cleaner than invoke_shell.
        # It avoids an intermediate host shell, so the user doesn't see the
        # `docker exec` command and isn't dropped into the host shell on exit.
        stdin, stdout, stderr = ssh_client.exec_command(
            command_to_run,
            get_pty=True,
            environment={'TERM': 'xterm-color'}
        )
        channel = stdout.channel
        channel.resize_pty(width=term_cols, height=term_rows)

        # 4. Proxy data between WebSocket and SSH channel
        while ws.connected and channel.active:
            # Check for readability on both the WebSocket and the SSH channel
            readable, _, _ = select.select([ws.sock, channel], [], [], 0.1)

            if ws.sock in readable:
                data_from_client = ws.receive(timeout=0)
                if data_from_client:
                    try:
                        # Handle resize commands from client
                        msg = json.loads(data_from_client)
                        if msg.get('type') == 'resize':
                            print(f"[TEST_BACKEND] Resizing PTY to {msg['cols']}x{msg['rows']}")
                            channel.resize_pty(width=msg['cols'], height=msg['rows'])
                            continue
                    except (json.JSONDecodeError, TypeError):
                        # Not a JSON command, treat as terminal input
                        pass

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