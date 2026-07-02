# API « catalogue d'applications » pour Sésame — à installer côté SENTINELLE
#
# 1. Copier ce fichier dans app/api_assets.py du projet Sentinelle
# 2. Dans app/__init__.py (create_app), enregistrer le blueprint :
#        from .api_assets import api_assets
#        app.register_blueprint(api_assets)
# 3. Définir la variable d'environnement SESAME_API_TOKEN (chaîne aléatoire
#    longue), et renseigner la même valeur dans Sésame :
#    Paramètres → Sentinelle → Jeton d'API
#
# Sésame appelle :  GET /api/assets?type=application
#                   Authorization: Bearer <SESAME_API_TOKEN>
# et attend une liste JSON : [{"id", "name", "description", "is_active"}, …]

import hmac
import os

from flask import Blueprint, jsonify, request

from .models import Asset

api_assets = Blueprint("api_assets", __name__)


@api_assets.get("/api/assets")
def list_assets():
    token = os.environ.get("SESAME_API_TOKEN", "")
    provided = request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token or not hmac.compare_digest(provided, token):
        return jsonify({"error": "unauthorized"}), 401

    query = Asset.query
    asset_type = request.args.get("type")
    if asset_type:
        query = query.filter_by(asset_type=asset_type)

    return jsonify(
        [
            {
                "id": a.id,
                "name": a.name,
                "description": a.description,
                "is_active": a.is_active,
            }
            for a in query.order_by(Asset.name).all()
        ]
    )
