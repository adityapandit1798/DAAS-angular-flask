# Docker-as-a-Service (DaaS)

This project provides a Docker-as-a-Service application with a Flask backend and an Angular frontend.

## Installation

### Frontend (Angular)

1.  Navigate to the frontend directory:
    ```bash
    cd frontend/daas-frontend
    ```
2.  Install the Node.js dependencies:
    ```bash
    npm install
    ```

### Backend (Flask)

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create a Python virtual environment:
    ```bash
    python3 -m venv venv
    ```
3.  Activate the virtual environment:
    ```bash
    source venv/bin/activate
    ```
4.  Install the Python dependencies:
    ```bash
    pip install -r requirements.txt
    ```

## Running the Application

### Frontend

To run the Angular development server:

```bash
cd frontend/daas-frontend
ng serve
```

### Backend

To run the Flask backend:

```bash
cd backend
source venv/bin/activate
python3 run.py
```

### SSH Backend

To run the SSH backend with Gunicorn:

```bash
cd backend
source venv/bin/activate
gunicorn --worker-class gevent --bind 0.0.0.0:5002 test_backend:app
```
