import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail
from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()


db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.getenv("REDIS_URL", "redis://localhost:6379/0")
)
mail = Mail()

def create_app(config_name="default"):
    app = Flask(__name__)
    
    from app.config import config
    app.config.from_object(config[config_name])

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    mail.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from app.routes.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")

    from app.routes.clients import clients_bp
    app.register_blueprint(clients_bp, url_prefix="/api/clients")

    from app.routes.invoices import invoices_bp
    app.register_blueprint(invoices_bp, url_prefix="/api/invoices")

    from app.routes.payments import payments_bp
    app.register_blueprint(payments_bp, url_prefix="/api/payments")

    from app.routes.team import team_bp
    app.register_blueprint(team_bp, url_prefix="/api/team")

    @app.before_request
    def set_tenant_context():
        from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
        from app.models.user import User
        try:
            verify_jwt_in_request(optional=True)
            current_user_id = get_jwt_identity()
            if current_user_id:
                user = User.query.get(int(current_user_id))
                if user:
                    business_id = user.get_business_owner_id()
                    db.session.execute(
                        db.text("SET LOCAL app.current_business_id = :bid"),
                        {"bid": str(business_id)}
                    )
        except Exception:
            pass
    @app.route("/api/health")
    def health():
        return {"status": "Wittle is Alive"}, 200

    

    return app
