# Gemini Project: Docker-as-a-Service (DaaS)

This file provides instructions and context for Gemini to work on this project.

## Project Overview

This is a Docker-as-a-Service (DaaS) application. It consists of a Python/Flask backend and an Angular frontend.

### Backend

- **Framework:** Flask
- **Location:** `/backend`
- **Entrypoint:** `run.py`
- **Dependencies:** The backend has a `package.json`, which is unusual for a Python project. It seems to be using some Node.js tooling. Any Python dependencies should be managed with `pip` and a `requirements.txt` file (which should be created).
- **Virtual Environment:** `backend/venv`

### Frontend

- **Framework:** Angular
- **Location:** `/frontend/daas-frontend`
- **Dependencies:** `package.json`
- **Configuration:** `angular.json`

## Instructions for Gemini

- **Commits:** Follow conventional commit standards.
- **Style:** Adhere to the existing code style. Use linters to maintain consistency.
- **Dependencies:**
    - For the backend, use `pip` for Python dependencies and create a `requirements.txt`. Use `npm` for any Node.js dependencies.
    - For the frontend, use `npm` and update `package.json`.
- **Testing:**
    - Backend tests are in `test_backend.py`. Use `pytest` to run them.
    - Frontend tests are co-located with the components (`*.spec.ts`). Use `ng test` to run them.
