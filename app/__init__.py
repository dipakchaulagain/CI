# app/__init__.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_talisman import Talisman
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from .config import Config
from .extensions import db, login_manager, csrf, talisman, limiter

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)
    talisman.init_app(app)
    limiter.init_app(app)

    # Register blueprints
    from .auth.routes import auth_bp
    from .api.auth import auth_api
    from .api.clients import clients_api
    from .api.networks import networks_api
    from .api.projects import projects_api
    from .api.users import users_api

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(auth_api, url_prefix='/api/auth')
    app.register_blueprint(clients_api, url_prefix='/api/clients')
    app.register_blueprint(networks_api, url_prefix='/api/networks')
    app.register_blueprint(projects_api, url_prefix='/api/projects')
    app.register_blueprint(users_api, url_prefix='/api/users')

    # Create database tables
    with app.app_context():
        db.create_all()

    return app