from flask import Flask
from flask_cors import CORS
from flask_sock import Sock
import os

def create_app():
    app = Flask(__name__)
    sock = Sock(app)
    # A secret key is required for session management
    app.secret_key = os.environ.get('FLASK_SECRET_KEY', os.urandom(24))
    CORS(app)  # Allow frontend to communicate

    from .routes import main
    app.register_blueprint(main)

    return app