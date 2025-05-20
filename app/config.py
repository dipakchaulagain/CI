# app/config.py
import os
from dotenv import load_dotenv
from cryptography.fernet import Fernet

load_dotenv()

class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', os.urandom(24).hex())
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///inventory.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = True
    TALISMAN_ENABLED = True
    TALISMAN_CSP = {
        'default-src': '\'self\'',
        'style-src': ['\'self\'', 'https://cdn.jsdelivr.net'],
        'script-src': ['\'self\'', 'https://cdn.jsdelivr.net']
    }
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    FERNET_KEY = os.getenv('FERNET_KEY', Fernet.generate_key().decode())
    RATE_LIMIT_STORAGE_URL = os.getenv('REDIS_URL', 'redis://redis:6379/0')