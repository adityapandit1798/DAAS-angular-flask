import json
import select
import logging
import os
import time
import traceback
from datetime import datetime
from io import StringIO

import paramiko
from flask import Flask
from flask_cors import CORS
from flask_sock import Sock

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('test_backend_debug.log')
    ]
)
logger = logging.getLogger(__name__)

# --- Basic Flask App Setup ---
logger.info("🚀 Initializing Flask application for Docker-as-a-Service backend testing")
app = Flask(__name__)
# Allow connections from any origin for simple local file testing
CORS(app, origins="*")
sock = Sock(app)
logger.info("✅ Flask app, CORS, and WebSocket initialized successfully")

# --- Default SSH Credentials (can be overridden via environment variables and per-session hostIp) ---
SSH_HOST = os.getenv('SSH_HOST', '192.168.192.163')
SSH_USER = os.getenv('SSH_USER', 'docker-user')
SSH_PASS = os.getenv('SSH_PASS', 'password')

logger.info(
    "🔧 Default SSH configuration loaded (can be overridden per session): "
    f"Host={SSH_HOST}, User={SSH_USER}"
)
if os.getenv('SSH_HOST') is None:
    logger.warning("⚠️  SSH_HOST not set via environment; using default. You can override by sending hostIp in the WebSocket init payload.")

@sock.route('/ws')
def ssh_websocket_handler(ws):
    """
    A simplified WebSocket handler for testing the SSH connection to a container.
    It expects an initial auth message with container details.
    """
    connection_start_time = time.time()
    session_id = f"session_{int(connection_start_time)}"
    
    logger.info(f"🔌 [{session_id}] WebSocket connection received at {datetime.now()}")
    logger.debug(f"🔍 [{session_id}] WebSocket object: {ws}")
    logger.debug(f"🔍 [{session_id}] Client address: {getattr(ws, 'environ', {}).get('REMOTE_ADDR', 'Unknown')}")
    
    print(f"[TEST_BACKEND] [{session_id}] WebSocket connection received.")
    ssh_client = None
    channel = None

    try:
        # 1. Receive container details from the client
        logger.info(f"📥 [{session_id}] Waiting for initial parameters from client (timeout: 10s)")
        init_params_raw = ws.receive(timeout=10)
        
        logger.debug(f"🔍 [{session_id}] Raw received data: {init_params_raw!r}")
        logger.debug(f"🔍 [{session_id}] Data type: {type(init_params_raw)}")
        logger.debug(f"🔍 [{session_id}] Data length: {len(init_params_raw) if init_params_raw else 0} bytes")
        
        if not init_params_raw:
            error_msg = 'Initial parameters not received within timeout'
            logger.error(f"❌ [{session_id}] {error_msg}")
            ws.close(reason=1008, message=error_msg)
            return

        logger.info(f"📋 [{session_id}] Parsing initial parameters...")
        try:
            params = json.loads(init_params_raw)
            logger.debug(f"🔍 [{session_id}] Parsed parameters: {params}")
        except json.JSONDecodeError as e:
            error_msg = f"Invalid JSON in initial parameters: {str(e)}"
            logger.error(f"❌ [{session_id}] {error_msg}")
            ws.send(json.dumps({'error': error_msg}))
            ws.close(reason=1008, message=error_msg)
            return
            
        container_id = params.get('containerId')
        container_shell = params.get('command', '/bin/sh')
        term_cols = params.get('cols', 80)
        term_rows = params.get('rows', 24)
        
        logger.info(f"🐳 [{session_id}] Container ID: {container_id}")
        logger.info(f"🖥️  [{session_id}] Shell command: {container_shell}")
        logger.info(f"📐 [{session_id}] Terminal size: {term_cols}x{term_rows}")
        
        # Allow overriding SSH host via client-provided hostIp (from login)
        host_ip = params.get('hostIp')
        target_host = host_ip or SSH_HOST
        logger.info(f"🌐 [{session_id}] Target SSH host: {target_host} (provided: {bool(host_ip)})")

        # Proactively inform the client which host will be used
        try:
            ws.send(json.dumps({
                'info': 'session_start',
                'target_host': target_host,
                'container_id': container_id,
                'shell': container_shell,
                'cols': term_cols,
                'rows': term_rows
            }))
            logger.debug(f"📤 [{session_id}] Sent session_start info to client")
        except Exception as e:
            logger.warning(f"⚠️  [{session_id}] Failed to send session_start info: {e}")

        if not container_id:
            error_msg = 'Container ID is required but not provided'
            logger.error(f"❌ [{session_id}] {error_msg}")
            logger.debug(f"🔍 [{session_id}] Available parameters: {list(params.keys())}")
            ws.send(json.dumps({'error': error_msg}))
            ws.close(reason=1008, message='Container ID not provided.')
            return

        # 2. Establish SSH connection with Paramiko
        ssh_start_time = time.time()
        logger.info(f"🔐 [{session_id}] Attempting SSH connection to {SSH_USER}@{target_host}...")
        print(f"[TEST_BACKEND] [{session_id}] Attempting to connect to {SSH_USER}@{target_host}...")
        
        ssh_client = paramiko.SSHClient()
        logger.debug(f"🔍 [{session_id}] SSH client created: {ssh_client}")
        
        ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        logger.debug(f"🔍 [{session_id}] SSH host key policy set to AutoAddPolicy")
        
        try:
            ssh_client.connect(
                hostname=target_host,
                username=SSH_USER,
                password=SSH_PASS,
                timeout=10
            )
            ssh_connect_time = time.time() - ssh_start_time
            logger.info(f"✅ [{session_id}] SSH connection successful in {ssh_connect_time:.2f}s")
            print(f"[TEST_BACKEND] [{session_id}] SSH connection successful.")
        except paramiko.AuthenticationException as e:
            error_msg = f"SSH authentication failed: {str(e)}"
            logger.error(f"❌ [{session_id}] {error_msg}")
            raise
        except paramiko.SSHException as e:
            error_msg = f"SSH connection error: {str(e)}"
            logger.error(f"❌ [{session_id}] {error_msg}")
            raise
        except Exception as e:
            error_msg = f"Unexpected SSH error: {str(e)}"
            logger.error(f"❌ [{session_id}] {error_msg}")
            raise

        # 3. Execute 'docker exec' directly with a PTY
        command_to_run = f"docker exec -it {container_id} {container_shell}"
        logger.info(f"🐳 [{session_id}] Preparing to execute Docker command: {command_to_run}")
        print(f"[TEST_BACKEND] [{session_id}] Executing command directly: {command_to_run}")
        
        connection_msg = f'Attempting to connect to container {container_id}...\r\n'
        logger.debug(f"📤 [{session_id}] Sending connection message to client: {connection_msg!r}")
        ws.send(json.dumps({'output': connection_msg}))

        # Using exec_command with get_pty=True is cleaner than invoke_shell.
        # It avoids an intermediate host shell, so the user doesn't see the
        # `docker exec` command and isn't dropped into the host shell on exit.
        exec_start_time = time.time()
        logger.info(f"⚡ [{session_id}] Executing SSH command with PTY...")
        logger.debug(f"🔍 [{session_id}] Environment: {{'TERM': 'xterm-color'}}")
        
        try:
            stdin, stdout, stderr = ssh_client.exec_command(
                command_to_run,
                get_pty=True,
                environment={'TERM': 'xterm-color'}
            )
            exec_setup_time = time.time() - exec_start_time
            logger.info(f"✅ [{session_id}] SSH command execution setup completed in {exec_setup_time:.2f}s")
            
            channel = stdout.channel
            logger.debug(f"🔍 [{session_id}] SSH channel obtained: {channel}")
            logger.debug(f"🔍 [{session_id}] Channel active: {channel.active}")
            
            logger.info(f"📐 [{session_id}] Resizing PTY to {term_cols}x{term_rows}")
            channel.resize_pty(width=term_cols, height=term_rows)
            logger.debug(f"✅ [{session_id}] PTY resize completed")
            
        except Exception as e:
            error_msg = f"Failed to execute Docker command: {str(e)}"
            logger.error(f"❌ [{session_id}] {error_msg}")
            raise

        # 4. Proxy data between WebSocket and SSH channel
        proxy_start_time = time.time()
        logger.info(f"🔄 [{session_id}] Starting WebSocket-SSH data proxy loop")
        logger.debug(f"🔍 [{session_id}] Initial state - WebSocket connected: {ws.connected}, Channel active: {channel.active}")
        
        loop_count = 0
        last_activity_time = time.time()
        
        while ws.connected and channel.active:
            loop_count += 1
            if loop_count % 100 == 0:  # Log every 100 iterations to avoid spam
                logger.debug(f"🔄 [{session_id}] Proxy loop iteration #{loop_count}")
            
            # Check for readability on both the WebSocket and the SSH channel
            select_start = time.time()
            readable, _, _ = select.select([ws.sock, channel], [], [], 0.1)
            select_time = time.time() - select_start
            
            if select_time > 0.05:  # Log if select takes longer than 50ms
                logger.debug(f"⏱️  [{session_id}] Select call took {select_time:.3f}s")
            
            if readable:
                last_activity_time = time.time()
                logger.debug(f"📡 [{session_id}] Data available on: {[str(r) for r in readable]}")

            if ws.sock in readable:
                logger.debug(f"📥 [{session_id}] WebSocket has data available")
                try:
                    data_from_client = ws.receive(timeout=0)
                    logger.debug(f"🔍 [{session_id}] Received data type: {type(data_from_client)}, length: {len(data_from_client) if data_from_client else 0}")
                except Exception as e:
                    logger.error(f"❌ [{session_id}] Error receiving WebSocket data: {str(e)}")
                    break
                    
                if data_from_client:
                    try:
                        # Handle resize commands from client
                        msg = json.loads(data_from_client)
                        if msg.get('type') == 'resize':
                            new_cols, new_rows = msg['cols'], msg['rows']
                            logger.info(f"📐 [{session_id}] Resizing PTY to {new_cols}x{new_rows}")
                            print(f"[TEST_BACKEND] [{session_id}] Resizing PTY to {new_cols}x{new_rows}")
                            channel.resize_pty(width=new_cols, height=new_rows)
                            logger.debug(f"✅ [{session_id}] PTY resize completed")
                            continue
                    except (json.JSONDecodeError, TypeError):
                        # Not a JSON command, treat as terminal input
                        logger.debug(f"🔍 [{session_id}] Data is not JSON, treating as terminal input")
                        pass
                    except KeyError as e:
                        logger.warning(f"⚠️  [{session_id}] Resize command missing required field: {str(e)}")
                        pass

                    logger.debug(f"📤 [{session_id}] >> Sending to SSH channel: {data_from_client!r}")
                    print(f"[TEST_BACKEND] [{session_id}] >> Received from client: {data_from_client!r}")
                    try:
                        channel.send(data_from_client)
                        logger.debug(f"✅ [{session_id}] Data sent to SSH channel successfully")
                    except Exception as e:
                        logger.error(f"❌ [{session_id}] Error sending data to SSH channel: {str(e)}")
                        break
                else:
                    logger.info(f"🔌 [{session_id}] Client closed WebSocket connection")
                    print(f"[TEST_BACKEND] [{session_id}] Client closed WebSocket.")
                    break

            if channel in readable:
                logger.debug(f"📡 [{session_id}] SSH channel has data available")
                
                if channel.recv_ready():
                    logger.debug(f"📥 [{session_id}] SSH channel ready to receive data")
                    try:
                        data_from_ssh = channel.recv(1024).decode('utf-8', 'ignore')
                        logger.debug(f"🔍 [{session_id}] Received {len(data_from_ssh)} bytes from SSH")
                        logger.debug(f"📤 [{session_id}] << Sending to client: {data_from_ssh!r}")
                        print(f"[TEST_BACKEND] [{session_id}] << Sending to client: {data_from_ssh!r}")
                        
                        response = json.dumps({'output': data_from_ssh})
                        ws.send(response)
                        logger.debug(f"✅ [{session_id}] Data sent to WebSocket client successfully")
                    except Exception as e:
                        logger.error(f"❌ [{session_id}] Error processing SSH data: {str(e)}")
                        break

                if channel.exit_status_ready():
                    exit_status = channel.recv_exit_status()
                    logger.info(f"🏁 [{session_id}] SSH channel exited with status: {exit_status}")
                    print(f"[TEST_BACKEND] [{session_id}] SSH channel exited with status: {exit_status}")
                    break
            
            # Check for connection timeout (optional)
            current_time = time.time()
            if current_time - last_activity_time > 300:  # 5 minutes timeout
                logger.warning(f"⏰ [{session_id}] Connection timeout after 5 minutes of inactivity")
                break

    except Exception as e:
        error_message = f"Error: {str(e)}"
        total_time = time.time() - connection_start_time
        
        logger.error(f"❌ [{session_id}] Exception after {total_time:.2f}s: {error_message}")
        logger.error(f"🔍 [{session_id}] Exception type: {type(e).__name__}")
        logger.error(f"📍 [{session_id}] Traceback: {traceback.format_exc()}")
        
        print(f"❌ [TEST_BACKEND] [{session_id}] Exception: {error_message}")
        
        try:
            error_response = json.dumps({
                'error': error_message,
                'session_id': session_id,
                'timestamp': datetime.now().isoformat()
            })
            ws.send(error_response)
            logger.debug(f"📤 [{session_id}] Error message sent to client")
        except Exception as send_error:
            logger.error(f"❌ [{session_id}] Failed to send error to client: {str(send_error)}")
            pass  # WebSocket might already be closed
    finally:
        cleanup_start_time = time.time()
        total_session_time = time.time() - connection_start_time
        
        logger.info(f"🧹 [{session_id}] Starting cleanup after {total_session_time:.2f}s total session time")
        print(f"[TEST_BACKEND] [{session_id}] Cleaning up and closing connections.")
        
        if channel:
            try:
                logger.debug(f"🔌 [{session_id}] Closing SSH channel")
                channel.close()
                logger.debug(f"✅ [{session_id}] SSH channel closed successfully")
            except Exception as e:
                logger.error(f"❌ [{session_id}] Error closing SSH channel: {str(e)}")
                
        if ssh_client:
            try:
                logger.debug(f"🔌 [{session_id}] Closing SSH client")
                ssh_client.close()
                logger.debug(f"✅ [{session_id}] SSH client closed successfully")
            except Exception as e:
                logger.error(f"❌ [{session_id}] Error closing SSH client: {str(e)}")
                
        if ws.connected:
            try:
                logger.debug(f"🔌 [{session_id}] Closing WebSocket connection")
                ws.close()
                logger.debug(f"✅ [{session_id}] WebSocket closed successfully")
            except Exception as e:
                logger.error(f"❌ [{session_id}] Error closing WebSocket: {str(e)}")
        
        cleanup_time = time.time() - cleanup_start_time
        logger.info(f"🏁 [{session_id}] Cleanup completed in {cleanup_time:.2f}s")
        logger.info(f"📊 [{session_id}] Session summary - Total time: {total_session_time:.2f}s, Loop iterations: {loop_count if 'loop_count' in locals() else 'N/A'}")
        print(f"[TEST_BACKEND] [{session_id}] Test connection closed.")

if __name__ == '__main__':
    logger.info("🚀 Starting test_backend.py in standalone mode")
    print("--- This file is intended to be run with a WSGI server like Gunicorn ---")
    print("--- Example: gunicorn --worker-class gevent --bind 0.0.0.0:5001 test_backend:app ---")
    logger.warning("⚠️  Running in standalone mode - use WSGI server for production")
    
    # Optional: Run Flask development server for testing
    logger.info("🔧 Starting Flask development server on port 5001")
    app.run(host='0.0.0.0', port=5001, debug=True)