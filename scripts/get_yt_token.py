#!/usr/bin/env python3
"""
Generate YouTube OAuth2 refresh token.

Usage:
  cd ~/workspace/automation-youtube
  source venv/bin/activate
  python scripts/get_yt_token.py

You'll need:
  - YouTube Data API v3 enabled in Google Cloud Console
  - OAuth 2.0 Client ID (Desktop app type)
  - Client ID and Client Secret from the downloaded JSON

The script opens a browser for consent, then prints the refresh token
to paste into the Settings → YouTube tab.
"""

import json
import sys
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

try:
    from google_auth_oauthlib.flow import Flow
except ImportError:
    print("ERROR: google-auth-oauthlib not installed.")
    print("Run: pip install google-auth-oauthlib")
    sys.exit(1)

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
REDIRECT_URI = "http://localhost:8888/callback"

_code: str | None = None


class _Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        global _code
        qs = parse_qs(urlparse(self.path).query)
        _code = qs.get("code", [None])[0]
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"<h2>Autorizado! Pode fechar esta aba.</h2>")

    def log_message(self, *_):
        pass


def main():
    print("=== YouTube OAuth2 Token Generator ===\n")
    client_id = input("Client ID: ").strip()
    client_secret = input("Client Secret: ").strip()

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uris": [REDIRECT_URI],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }

    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

    auth_url, _ = flow.authorization_url(
        access_type="offline",
        prompt="consent",
        include_granted_scopes="true",
    )

    print(f"\nAbrindo navegador para autorização...")
    print(f"Se não abrir, acesse:\n{auth_url}\n")
    webbrowser.open(auth_url)

    # Temporary local server to capture callback
    server = HTTPServer(("localhost", 8888), _Handler)
    server.handle_request()

    if not _code:
        print("ERROR: Authorization code not received.")
        sys.exit(1)

    flow.fetch_token(code=_code)
    creds = flow.credentials

    print("\n" + "=" * 50)
    print("REFRESH TOKEN (salve nas Configurações → YouTube):")
    print("=" * 50)
    print(creds.refresh_token)
    print("=" * 50)

    # Also save to file
    out = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": creds.refresh_token,
    }
    with open("yt_credentials.json", "w") as f:
        json.dump(out, f, indent=2)
    print("\nSalvo em: yt_credentials.json (não commite este arquivo!)")


if __name__ == "__main__":
    main()
