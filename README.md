# Docker-as-a-Service (DaaS)

This project provides a Docker-as-a-Service application with a Flask backend and an Angular frontend.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

*   **Python 3.8 or higher:**
    *   You can download Python from the official website: [python.org](https://www.python.org/downloads/)
    *   On Debian/Ubuntu: `sudo apt update && sudo apt install python3 python3-venv`
    *   On macOS (with Homebrew): `brew install python`
    *   Verify installation: `python3 --version`

*   **Node.js (LTS version) and npm:**
    *   Node.js includes npm. It is recommended to install the LTS (Long Term Support) version.
    *   You can download Node.js from the official website: [nodejs.org](https://nodejs.org/en/download/)
    *   On Debian/Ubuntu: Follow instructions on [nodejs.org](https://nodejs.org/en/download/package-manager/deb-based-linux) or use `nvm` (Node Version Manager).
    *   On macOS (with Homebrew): `brew install node`
    *   Verify installation: `node --version` and `npm --version`

## Installation

### Frontend (Angular)

1.  Navigate to the frontend directory:
    ```bash
    cd frontend/daas-frontend
    ```
2.  Install the Node.js dependencies using npm:
    ```bash
    npm install
    ```

### Backend (Flask)

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create a Python virtual environment to manage dependencies:
    ```bash
    python3 -m venv venv
    ```
3.  Activate the virtual environment:
    *   On Linux/macOS:
        ```bash
        source venv/bin/activate
        ```
    *   On Windows (Command Prompt):
        ```bash
        venv\Scripts\activate.bat
        ```
    *   On Windows (PowerShell):
        ```bash
        .\venv\Scripts\Activate.ps1
        ```
4.  Install the Python dependencies using pip:
    ```bash
    pip install -r requirements.txt
    ```

## Running the Application

### Frontend

To run the Angular development server:

1.  Navigate to the frontend directory:
    ```bash
    cd frontend/daas-frontend
    ```
2.  Start the server:
    ```bash
    ng serve
    ```
    The application will typically be available at `http://localhost:4200`.

### Backend

To run the Flask backend:

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Activate the virtual environment:
    *   On Linux/macOS:
        ```bash
        source venv/bin/activate
        ```
    *   On Windows (Command Prompt):
        ```bash
        venv\Scripts\activate.bat
        ```
    *   On Windows (PowerShell):
        ```bash
        .\venv\Scripts\Activate.ps1
        ```
3.  Start the Flask application:
    ```bash
    python3 run.py
    ```
    The backend will typically run on `http://0.0.0.0:5001`.

### SSH Backend

To run the SSH backend with Gunicorn (a WSGI HTTP server):

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Activate the virtual environment:
    *   On Linux/macOS:
        ```bash
        source venv/bin/activate
        ```
    *   On Windows (Command Prompt):
        ```bash
        venv\Scripts\activate.bat
        ```
    *   On Windows (PowerShell):
        ```bash
        .\venv\Scripts\Activate.ps1
        ```
3.  Start the Gunicorn server:
    ```bash
    gunicorn --worker-class gevent --bind 0.0.0.0:5002 test_backend:app
    ```
    This will run the SSH backend on `http://0.0.0.0:5002`.