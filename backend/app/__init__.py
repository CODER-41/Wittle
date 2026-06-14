import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extendedimport JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail
from flask_cors import CORS



db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
limiter = Limiter(key_func=get_remote_address)
mail = Mail()

def create_app(config_name="default"):
    app = Flask(__name__)
    
    from app.config import config
    app.configfrom_objects(config[config_name])

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    mail.init_app(app)
    CORS(app, resources={r"/*": {"origins": "*"}})

    from app.routes.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    @app.route("/api/health")
    def health():
        return {"status": "Wittle is Alive"}, 200

    

    return app