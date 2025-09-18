# backend/app/routes.py

import os
import docker
import requests
from flask import Blueprint, jsonify, request, Response, session
import json, uuid, shutil, time

main = Blueprint('main', __name__)

# Directory to store temporary certs
temp_certs_dir = os.path.join(os.getcwd(), 'temp_certs')
os.makedirs(temp_certs_dir, exist_ok=True)


def get_docker_client(config=None):
    """
    Create a Docker client based on a passed-in config or the current session.
    """
    if config is None:
        if 'docker_config' not in session:
            raise Exception('Not connected to any Docker host. Please connect first.')
        config = session.get('docker_config', {})

    base_url = config.get('base_url')
    if not base_url:
        raise Exception('Connection details are incomplete in session.')

    tls_config = None
    if config.get('mode') == 'https':
        session_id = config.get('session_id')
        if not session_id:
            raise Exception("Session is missing required TLS information.")

        session_cert_dir = os.path.join(temp_certs_dir, session_id)
        ca_path = os.path.join(session_cert_dir, "ca.pem")
        cert_path = os.path.join(session_cert_dir, "cert.pem")
        key_path = os.path.join(session_cert_dir, "key.pem")

        if not all(os.path.exists(p) for p in [ca_path, cert_path, key_path]):
            raise Exception("Certificate files not found for this session. Please reconnect.")

        tls_config = docker.tls.TLSConfig(
            client_cert=(cert_path, key_path),
            ca_cert=ca_path,
            verify=True
        )

    return docker.DockerClient(
        base_url=base_url,
        tls=tls_config,
        timeout=10
    )


def get_node_info():
    client = None
    try:
        client = get_docker_client()
        info = client.info()
        version = client.version()

        # Memory (in MB)
        memory_total_mb = info['MemTotal'] // (1024 * 1024)

        containers = client.containers.list(all=True)
        total_containers = len(containers)
        running_containers = len([c for c in containers if c.status == 'running'])

        images = client.images.list()
        total_images = len(images)

        networks = client.networks.list()
        total_networks = len(networks)

        volumes = client.volumes.list()
        total_volumes = len(volumes)

        try:
            host_ip = session.get('docker_config', {}).get('host_ip')
            if not host_ip:
                raise Exception('No host IP configured in session')

            host_stats = requests.get(f"http://{host_ip}:8000", timeout=5).json()

            memory_usage_mb = host_stats.get('memory_used_mb', 0)
            cpu_usage_percent = host_stats.get('cpu_usage_percent', 0.0)
            uptime = host_stats.get('uptime', 'Unknown')
        except Exception as e:
            print(f"⚠️ Failed to fetch host stats: {str(e)}")
            memory_usage_mb = int(memory_total_mb * 0.3)
            cpu_usage_percent = 25.0
            uptime = 'Unknown'

        return {
            'docker_version': version.get('Version', 'unknown'),
            'os': info.get('OperatingSystem', 'unknown'),
            'kernel_version': info.get('KernelVersion', 'unknown'),
            'total_containers': total_containers,
            'running_containers': running_containers,
            'total_images': total_images,
            'total_networks': total_networks,
            'total_volumes': total_volumes,
            'memory_total_mb': memory_total_mb,
            'memory_usage_mb': memory_usage_mb,
            'cpu_cores': info.get('NCPU', 1),
            'cpu_usage_percent': cpu_usage_percent,
            'uptime': uptime,
            'docker_root': info.get('DockerRootDir', '/var/lib/docker'),
            'hostname': info.get('Name', 'docker-host')
        }

    except Exception as e:
        print(f"❌ Error fetching node info: {str(e)}")
        return {
            'docker_version': 'N/A',
            'os': 'N/A',
            'kernel_version': 'N/A',
            'total_containers': 0,
            'running_containers': 0,
            'total_images': 0,
            'total_networks': 0,
            'total_volumes': 0,
            'memory_total_mb': 1,
            'memory_usage_mb': 0,
            'cpu_cores': 0,
            'cpu_usage_percent': 0.0,
            'uptime': 'N/A',
            'docker_root': '',
            'hostname': 'unknown'
        }
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass


@main.route('/api/logs')
def api_logs():
    container_id = request.args.get('container')
    print(f"=== API LOGS CALLED === container={container_id}")

    if not container_id:
        print("❌ No container ID provided")
        return jsonify({"error": "Container ID is required"}), 400

    # Capture docker_config from session while we are in the request context
    docker_config = session.get('docker_config')
    if not docker_config:
        return jsonify({"error": "Not connected to any Docker host. Please connect first."} ), 401

    def generate(config):
        client = None
        try:
            # Pass the captured config to get a client without needing the session
            client = get_docker_client(config=config)
            container = client.containers.get(container_id)

            # Stream logs
            for chunk in container.logs(stdout=True, stderr=True, stream=True, tail=250, follow=True):
                if isinstance(chunk, bytes):
                    line = chunk.decode('utf-8', errors='replace').strip()
                else:
                    line = str(chunk).strip()
                if line:
                    yield f"data: {json.dumps({'line': line})}\n\n"

        except docker.errors.NotFound:
            yield f"data: {json.dumps({'error': 'Container not found'})}\n\n"
        except Exception as e:
            print(f"❌ Log stream error: {str(e)}")
            yield f"data: {json.dumps({'error': f'Log stream error: {str(e)}'})}\n\n"
        finally:
            if client:
                try:
                    client.close()
                except Exception:
                    pass

    return Response(
        generate(docker_config),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'}
    )

@main.route('/api/connect', methods=['POST'])
def api_connect():
    data = request.get_json()

    host_ip = data.get('hostIp', '').strip()
    mode = 'https'

    if not host_ip:
        return jsonify({"error": "Host IP is required"}), 400

    base_url = f"https://{host_ip}:2376"

    tls_config = None
    session_id = None

    if mode == "https":
        ca_cert = data.get('caCert', '').strip()
        client_cert = data.get('clientCert', '').strip()
        client_key = data.get('clientKey', '').strip()

        if not all([ca_cert, client_cert, client_key]):
            return jsonify({"error": "CA Certificate, Client Certificate, and Client Key are required for HTTPS mode"}), 400

        session_id = uuid.uuid4().hex
        session_cert_dir = os.path.join(temp_certs_dir, session_id)
        os.makedirs(session_cert_dir, exist_ok=True)

        ca_path = os.path.join(session_cert_dir, "ca.pem")
        cert_path = os.path.join(session_cert_dir, "cert.pem")
        key_path = os.path.join(session_cert_dir, "key.pem")

        try:
            with open(ca_path, 'w') as f:
                f.write(ca_cert)
            with open(cert_path, 'w') as f:
                f.write(client_cert)
            with open(key_path, 'w') as f:
                f.write(client_key)

            os.chmod(ca_path, 0o600)
            os.chmod(cert_path, 0o600)
            os.chmod(key_path, 0o600)

            tls_config = docker.tls.TLSConfig(
                client_cert=(cert_path, key_path),
                ca_cert=ca_path,
                verify=True
            )
        except Exception as e:
            return jsonify({"error": f"Failed to configure TLS: {str(e)}"}), 400

    session['docker_config'] = {
        "host_ip": host_ip,
        "mode": mode,
        "base_url": base_url,
        "session_id": session_id,
    }

    try:
        client = docker.DockerClient(
            base_url=base_url,
            tls=tls_config,
            timeout=10
        )
        client.ping()
        client.close()
    except Exception as e:
        session.pop('docker_config', None)
        if session_id:
            shutil.rmtree(os.path.join(temp_certs_dir, session_id), ignore_errors=True)
        return jsonify({"error": f"Connection failed: {str(e)}"}), 500

    return jsonify({
        "success": True,
        "message": "Successfully connected to Docker host",
        "data": {
            "host": host_ip,
            "mode": mode,
            "apiUrl": base_url
        }
    })


@main.route('/api/disconnect', methods=['POST'])
def api_disconnect():
    """Disconnects the user by clearing session data and certs."""
    docker_config = session.pop('docker_config', None)
    if docker_config and docker_config.get('session_id'):
        session_id = docker_config['session_id']
        session_cert_dir = os.path.join(temp_certs_dir, session_id)
        if os.path.isdir(session_cert_dir):
            try:
                shutil.rmtree(session_cert_dir)
                print(f"Cleaned up cert directory: {session_cert_dir}")
            except Exception as e:
                print(f"Error removing cert directory {session_cert_dir}: {e}")

    return jsonify({"success": True, "message": "Disconnected successfully."})

@main.route('/api/node-info', methods=['GET'])
def api_node_info():
    return jsonify(get_node_info())


# ---------- Docker Hub Image Detail ----------
def format_image_data(data: dict):
    """Normalize Docker Hub image fields for the UI."""
    return {
        "name": data.get("name", "unknown"),
        "namespace": data.get("namespace", "library"),
        "full_name": data.get("full_name") or f"{data.get('namespace', 'library')}/{data.get('name', '')}",
        "description": data.get("description", ""),
        "full_description": data.get("full_description", ""),
        "pull_count": data.get("pull_count", 0),
        "star_count": data.get("star_count", 0),
        "last_updated": data.get("last_updated", ""),
        "is_official": bool(data.get("is_official", False)),
        "status": data.get("status", 1),
        "hub_url": f"https://hub.docker.com/r/{data.get('namespace', 'library')}/{data.get('name', '')}"
    }


@main.route('/api/images/<path:image_name>', methods=['GET'])
def api_image_detail(image_name):
    image_name = (image_name or '').strip().lower()
    if not image_name:
        return jsonify({"error": "Image name is required"}), 400

    # If no namespace provided, default to 'library'
    if "/" in image_name:
        namespace, name = image_name.split("/", 1)
        api_url = f"https://hub.docker.com/v2/repositories/{namespace}/{name}"
    else:
        api_url = f"https://hub.docker.com/v2/repositories/library/{image_name}"

    try:
        resp = requests.get(api_url, timeout=10)
        if resp.status_code == 404:
            return jsonify({"error": "Image not found"}), 404
        resp.raise_for_status()
        data = resp.json()
        return jsonify(format_image_data(data))
    except Exception as e:
        print(f"❌ API request failed: {str(e)}")
        return jsonify({"error": "Failed to fetch"}), 500


# ---------- Images list (on connected host) ----------
@main.route('/api/my-images', methods=['GET'])
def api_my_images():
    client = None
    try:
        print("[my-images] creating docker client")
        client = get_docker_client()
        imgs = client.images.list(all=True)
        print(f"[my-images] fetched {len(imgs)} images")
        rows = []
        for img in imgs:
            tags = getattr(img, 'tags', None) or ["<none>:<none>"]
            created_raw = img.attrs.get('Created', '') if hasattr(img, 'attrs') else ''
            size_bytes = img.attrs.get('Size', 0) if hasattr(img, 'attrs') else 0
            size_mb = round(size_bytes / (1024 * 1024), 1)
            for tag in tags:
                if ':' in tag:
                    repository, tag_name = tag.split(':', 1)
                else:
                    repository, tag_name = tag, 'latest'
                rows.append({
                    'repository': repository,
                    'tag': tag_name,
                    'id': (img.short_id or ''),
                    'createdAt': created_raw,
                    'size': f"{size_mb} MB"
                })
        print(f"[my-images] returning {len(rows)} rows")
        return jsonify({'images': rows})
    except Exception as e:
        print(f"[my-images] error: {e}")
        return jsonify({'images': [], 'error': str(e)}), 200
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass


# ---------- Pull image via SSE ----------
@main.route('/api/pull-image', methods=['GET'])
def pull_image():
    repository = request.args.get('repository', '').strip()
    tag = request.args.get('tag', 'latest').strip()

    print(f"[pull-image] [DEBUG] Request received for repo='{repository}', tag='{tag}'")
    if not repository:
        def generate_error():
            print("[pull-image] [DEBUG] Repository is missing, sending error.")
            yield f"data: {json.dumps({'error': 'Missing repository'})}\n\n"
        return Response(generate_error(), mimetype='text/event-stream', headers={
            'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'
        })

    docker_config = session.get('docker_config')
    if not docker_config:
        def generate_no_connect_error():
            print("[pull-image] [DEBUG] Not connected to Docker host, sending error.")
            yield f"data: {json.dumps({'error': 'Not connected to any Docker host.'})}\\n\n"
        return Response(generate_no_connect_error(), mimetype='text/event-stream', headers={
            'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'
        })

    def generate(config):
        client = None
        try:
            print("[pull-image] [DEBUG] Generator started. Creating Docker client.")
            client = get_docker_client(config=config)
            client.ping()
            print("[pull-image] [DEBUG] Docker ping OK. Starting pull stream from Docker API.")
            for i, chunk in enumerate(client.api.pull(repository, tag=tag, stream=True, decode=True)):
                try:
                    # Log condensed event
                    status = chunk.get('status', '')
                    progress = chunk.get('progress', '')
                    log_msg = f"status='{status}'"
                    if progress:
                        log_msg += f", progress='{progress}'"
                    print(f"[pull-image] [DEBUG] Sending chunk {i+1}: {log_msg}")
                    yield f"data: {json.dumps(chunk)}\\n\n"
                except Exception as inner_e:
                    print(f"[pull-image] [DEBUG] Error processing chunk: {inner_e}")
                    yield f"data: {json.dumps({'error': f'Stream error: {str(inner_e)}'})}\n\n"
            print("[pull-image] [DEBUG] Pull stream finished. Sending 'completed' event.")
            yield f"data: {json.dumps({'status': 'completed'})}\n\n"
            print("[pull-image] [DEBUG] 'completed' event sent.")
        except Exception as e:
            print(f"[pull-image] [DEBUG] An exception occurred during pull: {e}")
            yield f"data: {json.dumps({'error': f'Pull failed: {str(e)}'})}\n\n"
        finally:
            if client:
                print("[pull-image] [DEBUG] Closing Docker client.")
                try:
                    client.close()
                except Exception:
                    pass
            print("[pull-image] [DEBUG] Generator finished.")

    return Response(generate(docker_config), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no', 'Access-Control-Allow-Origin': '*'
    })


# ---------- Inspect and Delete Image ----------
@main.route('/api/inspect-image', methods=['GET'])
def api_inspect_image():
    image_name = request.args.get('image', '').strip()
    if not image_name:
        return jsonify({"error": "Image name is required"}), 400
    client = None
    try:
        client = get_docker_client()
        image = client.images.get(image_name)
        return jsonify(image.attrs)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass


# ---------- Networks ----------
@main.route('/api/networks', methods=['GET'])
def api_networks_list():
    try:
        client = get_docker_client()
        networks = client.networks.list()
        network_data = []
        for net in networks:
            inspect = getattr(net, 'attrs', {}) or {}
            network_data.append({
                'Name': net.name,
                'Id': net.id,
                'Driver': inspect.get('Driver', 'N/A'),
                'Scope': inspect.get('Scope', 'N/A'),
                'IPAM': inspect.get('IPAM', {}),
                'Containers': list((inspect.get('Containers', {}) or {}).keys()),
                'Internal': inspect.get('Internal', False),
                'Attachable': inspect.get('Attachable', False),
                'Created': inspect.get('Created', 'Unknown')
            })
        return jsonify(network_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            client.close()
        except Exception:
            pass


@main.route('/api/networks', methods=['POST'])
def api_networks_create():
    data = request.get_json(silent=True) or {}
    name = (data.get('Name') or data.get('name') or '').strip()
    driver = (data.get('Driver') or data.get('driver') or 'bridge').strip() or 'bridge'
    if not name:
        return jsonify({'error': 'Network name is required'}), 400
    if driver not in ['bridge', None, '']:
        return jsonify({'error': "Only 'bridge' network driver is supported in standalone mode."}, 400)
    try:
        client = get_docker_client()
        network = client.networks.create(name=name, driver='bridge', attachable=True)
        return jsonify({
            'Name': network.name,
            'Id': network.id,
            'Driver': (getattr(network, 'attrs', {}) or {}).get('Driver'),
            'Created': (getattr(network, 'attrs', {}) or {}).get('Created')
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            client.close()
        except Exception:
            pass


@main.route('/api/networks/<network_name>', methods=['DELETE'])
def api_networks_delete(network_name):
    try:
        client = get_docker_client()
        network = client.networks.get(network_name)
        network.remove()
        return jsonify({'message': f'Network {network_name} deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            client.close()
        except Exception:
            pass


@main.route('/api/networks/prune', methods=['POST'])
def prune_networks():
    try:
        client = get_docker_client()
        result = client.api.prune_networks()
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        try:
            client.close()
        except Exception:
            pass


# ---------- Volumes ----------
@main.route('/api/volumes', methods=['GET'])
def api_list_volumes():
    try:
        print('[volumes][list] start')
        client = get_docker_client()
        volumes = client.volumes.list()
        print(f"[volumes][list] found {len(volumes)} volumes")
        volume_data = []
        for vol in volumes:
            inspect = getattr(vol, 'attrs', {}) or {}
            volume_data.append({
                'Name': vol.name,
                'Mountpoint': inspect.get('Mountpoint', 'N/A'),
                'Driver': inspect.get('Driver', 'local'),
                'Scope': inspect.get('Scope', 'local'),
                'CreatedAt': inspect.get('CreatedAt', 'Unknown')
            })
        print('[volumes][list] returning payload')
        return jsonify(volume_data)
    except Exception as e:
        print(f"[volumes][list] error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/volumes', methods=['POST'])
def api_create_volume():
    data = request.get_json(silent=True) or {}
    print(f"[volumes][create] payload: {data}")
    name = data.get('Name') or data.get('name')

    if not name:
        print('[volumes][create] missing name')
        return jsonify({'error': 'Volume name is required'}), 400

    try:
        client = get_docker_client()
        print(f"[volumes][create] creating volume {name}")
        volume = client.volumes.create(name=name)
        attrs = getattr(volume, 'attrs', {}) or {}
        resp = {
            'Name': volume.name,
            'Mountpoint': attrs.get('Mountpoint'),
            'Driver': attrs.get('Driver'),
            'CreatedAt': attrs.get('CreatedAt')
        }
        print('[volumes][create] success')
        return jsonify(resp)
    except Exception as e:
        print(f"[volumes][create] error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/volumes/<volume_name>', methods=['DELETE'])
def api_delete_volume(volume_name):
    try:
        print(f"[volumes][delete] deleting {volume_name}")
        client = get_docker_client()
        volume = client.volumes.get(volume_name)
        volume.remove()
        print('[volumes][delete] success')
        return jsonify({'message': f'Volume {volume_name} deleted'})
    except Exception as e:
        print(f"[volumes][delete] error: {e}")
        return jsonify({'error': str(e)}), 500


@main.route('/api/volumes/prune', methods=['POST'])
def api_prune_volumes():
    try:
        print('[volumes][prune] start')
        client = get_docker_client()
        result = client.api.prune_volumes()
        print(f"[volumes][prune] result: {result}")
        return jsonify(result)
    except Exception as e:
        print(f"[volumes][prune] error: {e}")
        return jsonify({'error': str(e)}), 500


# ---------- Containers ----------
@main.route('/api/containers', methods=['GET'])
def api_containers():
    client = None
    try:
        client = get_docker_client()
        containers = client.containers.list(all=True)
        container_data = []
        for container in containers:
            attrs = container.attrs
            state = attrs.get('State', {})

            # Format port mappings
            port_info = []
            port_settings = attrs.get('NetworkSettings', {}).get('Ports') or {}
            for container_port, host_bindings in port_settings.items():
                if host_bindings:
                    for binding in host_bindings:
                        host_ip = binding.get('HostIp', '0.0.0.0')
                        host_port = binding.get('HostPort', '')
                        port_info.append(f"{host_ip}:{host_port}->{container_port}")
                else:
                    port_info.append(f"{container_port}(unmapped)")

            container_data.append({
                "id": container.short_id,
                "name": container.name,
                "image": attrs.get('Config', {}).get('Image', 'unknown'),
                "status": attrs.get('Status', state.get('Status', 'unknown')),
                "created": attrs.get('Created'),
                "ports": ", ".join(port_info),
                "state": state.get('Status', 'unknown').lower()
            })
        return jsonify(container_data)
    except Exception as e:
        return jsonify({"error": "Failed to fetch containers", "details": str(e)}), 500
    finally:
        if client:
            client.close()


@main.route('/api/containers/create', methods=['POST'])
def create_container():
    client = None
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON payload"}), 400

        image = data.get('image')
        if not image:
            return jsonify({"error": "Image is a required field"}), 400

        # --- Prepare arguments for docker-py's create() method ---
        create_args = {
            'image': image,
            'name': data.get('name') or None,
            'command': data.get('command') or None,
            'detach': True,  # Always run in detached mode
        }

        # Environment variables: [{key: 'k', value: 'v'}] -> ['k=v']
        env_vars = data.get('env', [])
        if any(item.get('key') for item in env_vars):
            create_args['environment'] = [
                f"{item['key']}={item['value']}" for item in env_vars if item.get('key')
            ]

        # Port bindings: [{hostPort: '8080', containerPort: '80'}] -> {'80/tcp': 8080}
        ports = data.get('ports', [])
        if any(item.get('containerPort') for item in ports):
            port_bindings = {}
            for item in ports:
                if item.get('containerPort'):
                    container_port_str = str(item['containerPort'])
                    if '/tcp' not in container_port_str and '/udp' not in container_port_str:
                        container_port_str += '/tcp'
                    port_bindings[container_port_str] = int(item['hostPort']) if item.get('hostPort') else None
            create_args['ports'] = port_bindings

        # Volume mounts: [{hostPath: '/h', containerPath: '/c'}] -> {'/h': {'bind': '/c', 'mode': 'rw'}}
        volumes = data.get('volumes', [])
        if any(item.get('hostPath') for item in volumes):
            create_args['volumes'] = {
                item['hostPath']: {'bind': item['containerPath'], 'mode': 'rw'}
                for item in volumes if item.get('hostPath') and item.get('containerPath')
            }

        # Restart policy: 'on-failure' -> {'Name': 'on-failure'}
        restart_policy = data.get('restartPolicy')
        if restart_policy and restart_policy != 'no':
            create_args['restart_policy'] = {'Name': restart_policy}

        # Network
        if data.get('network'):
            create_args['network'] = data['network']

        # --- Create and start the container ---
        client = get_docker_client()
        container = client.containers.create(**create_args)
        container.start()

        return jsonify({"message": f"Container '{container.name}' created successfully.", "id": container.id}), 201

    except Exception as e:
        error_message = str(e)
        if "Conflict" in error_message and "is already in use by container" in error_message:
            error_message = "A container with this name already exists."
        return jsonify({"error": "Failed to create container", "details": error_message}), 500
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass


@main.route('/api/containers/<container_id>/start', methods=['POST'])
def start_container(container_id):
    client = None
    try:
        client = get_docker_client()
        container = client.containers.get(container_id)
        container.start()
        return jsonify({"message": f"Container '{container.name}' started successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if client:
            client.close()


@main.route('/api/containers/<container_id>/stop', methods=['POST'])
def stop_container(container_id):
    client = None
    try:
        client = get_docker_client()
        container = client.containers.get(container_id)
        container.stop()
        return jsonify({"message": f"Container '{container.name}' stopped successfully."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if client:
            client.close()


@main.route('/api/containers/<container_id>', methods=['DELETE'])
def delete_container(container_id):
    client = None
    try:
        client = get_docker_client()
        container = client.containers.get(container_id)
        container.remove(force=True)
        return jsonify({"message": f"Container '{container.name}' was removed."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if client:
            client.close()


@main.route('/api/containers/<container_id>/stats', methods=['GET'])
def stream_container_stats(container_id):
    docker_config = session.get('docker_config')
    if not docker_config:
        return jsonify({"error": "Not connected to any Docker host. Please connect first."} ), 401

    def generate(config):
        client = None
        try:
            client = get_docker_client(config=config)
            container = client.containers.get(container_id)
            for stat in container.stats(stream=True, decode=True):
                cpu_stats = stat.get('cpu_stats', {})
                pre_cpu_stats = stat.get('precpu_stats', {})
                
                cpu_usage = cpu_stats.get('cpu_usage', {})
                pre_cpu_usage = pre_cpu_stats.get('cpu_usage', {})

                cpu_delta = cpu_usage.get('total_usage', 0) - pre_cpu_usage.get('total_usage', 0)
                system_delta = cpu_stats.get('system_cpu_usage', 0) - pre_cpu_stats.get('system_cpu_usage', 0)
                
                cpu_percent = 0.0
                if system_delta > 0 and cpu_delta > 0:
                    online_cpus = cpu_stats.get('online_cpus', len(cpu_usage.get('percpu_usage', [])))
                    if online_cpus > 0:
                        cpu_percent = (cpu_delta / system_delta) * online_cpus * 100.0

                memory_stats = stat.get('memory_stats', {})
                mem_usage = memory_stats.get('usage', 0)
                mem_limit = memory_stats.get('limit', 1)
                mem_percent = (mem_usage / mem_limit) * 100 if mem_limit > 0 else 0

                networks = {}
                if 'networks' in stat:
                    for net_name, net_data in stat['networks'].items():
                        networks[net_name] = {
                            'rx': net_data.get('rx_bytes', 0),
                            'tx': net_data.get('tx_bytes', 0)
                        }

                output = {
                    "timestamp": stat.get('read'),
                    "cpu_percent": round(cpu_percent, 2),
                    "memory_mb": {
                        "usage": mem_usage // (1024 * 1024),
                        "limit": mem_limit // (1024 * 1024),
                        "percent": round(mem_percent, 2)
                    },
                    "network": networks,
                    "block_io": stat.get('blkio_stats', {}),
                    "pids": stat.get('pids_stats', {}).get('current', 0)
                }
                print(f"[Backend Stats] Raw stat: {stat}")
                yield f"data: {json.dumps(output)}\\n\n"
        except docker.errors.NotFound:
            yield f"data: {json.dumps({'error': 'Container not found'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': f'Stream failed: {str(e)}'})}\n\n"
        finally:
            if client:
                try:
                    client.close()
                except Exception:
                    pass

    return Response(
        generate(docker_config),
        mimetype='text/event-stream',
        headers={'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'}
    )


@main.route('/api/delete-image', methods=['POST'])
def api_delete_image():
    image_id = request.args.get('id', '').strip()
    if not image_id:
        return jsonify({"error": "Image ID is required"}), 400

    client = None
    try:
        client = get_docker_client()
        client.images.remove(image_id, force=True)
        return jsonify({"message": f"Image {image_id} deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass