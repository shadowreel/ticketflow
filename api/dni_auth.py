"""
Función serverless de Python (Vercel) para la autenticación de
"Usuario final" por DNI del Sistema de Registro de Incidencias TI.

Un solo endpoint POST /api/dni_auth, enrutado por el campo "action"
del body JSON. Habla con la misma tabla genérica de Supabase que ya
usa el resto de la app (ticketflow_data: id, collection, record),
usando dos colecciones: "dni_whitelist" (DNIs autorizados por el
admin) y "users" (cuentas ya registradas, reutiliza la colección
existente agregando el campo "dni").

No depende de librerías externas: solo biblioteca estándar.
"""

import binascii
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://kpzliroisikcvckfiqqx.supabase.co")
SUPABASE_KEY = os.environ.get(
    "SUPABASE_ANON_KEY", "sb_publishable_AZdk14DpmphNXFBrjAYdBA_Pp05IC5D"
)
TABLE = "ticketflow_data"
PBKDF2_ITERATIONS = 260000


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


# --- Supabase REST helpers ---------------------------------------------


def _headers(extra=None):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    if extra:
        headers.update(extra)
    return headers


def sb_get(collection):
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}?collection=eq.{collection}&select=record"
    req = urllib.request.Request(url, headers=_headers())
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
    except urllib.error.URLError as err:
        raise ApiError(f"No se pudo conectar con la base de datos: {err}", 502)
    return [row["record"] for row in rows]


def sb_insert(collection, record_id, fields):
    record = dict(fields)
    record["id"] = record_id
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    body = json.dumps({"id": record_id, "collection": collection, "record": record}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers=_headers({"Prefer": "return=minimal"}))
    try:
        urllib.request.urlopen(req, timeout=10).read()
    except urllib.error.URLError as err:
        raise ApiError(f"No se pudo guardar en la base de datos: {err}", 502)
    return record


def sb_update(collection, record_id, fields):
    current = None
    for item in sb_get(collection):
        if item.get("id") == record_id:
            current = item
            break
    if current is None:
        raise ApiError("Registro no encontrado.", 404)
    merged = dict(current)
    merged.update(fields)
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}?collection=eq.{collection}&id=eq.{record_id}"
    body = json.dumps({"record": merged}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="PATCH", headers=_headers({"Prefer": "return=minimal"}))
    try:
        urllib.request.urlopen(req, timeout=10).read()
    except urllib.error.URLError as err:
        raise ApiError(f"No se pudo actualizar la base de datos: {err}", 502)
    return merged


def sb_delete(collection, record_id):
    url = f"{SUPABASE_URL}/rest/v1/{TABLE}?collection=eq.{collection}&id=eq.{record_id}"
    req = urllib.request.Request(url, method="DELETE", headers=_headers())
    try:
        urllib.request.urlopen(req, timeout=10).read()
    except urllib.error.URLError as err:
        raise ApiError(f"No se pudo eliminar de la base de datos: {err}", 502)


# --- Contraseñas (pbkdf2 + salt, formato propio de esta colección) -----


def hash_password(password):
    salt = os.urandom(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2${PBKDF2_ITERATIONS}${binascii.hexlify(salt).decode()}${binascii.hexlify(derived).decode()}"


def verify_password(password, stored):
    try:
        scheme, iterations, salt_hex, hash_hex = stored.split("$")
        if scheme != "pbkdf2":
            return False
        salt = binascii.unhexlify(salt_hex)
        expected = binascii.unhexlify(hash_hex)
        derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations))
        return hmac.compare_digest(derived, expected)
    except Exception:
        return False


# --- Lógica de negocio ---------------------------------------------------


def normalize_dni(raw):
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    if len(digits) != 8:
        raise ApiError("El DNI debe tener 8 dígitos.")
    return digits


def find_whitelist_entry(dni):
    for entry in sb_get("dni_whitelist"):
        if entry.get("dni") == dni:
            return entry
    return None


def find_user_by_dni(dni):
    for user in sb_get("users"):
        if user.get("dni") == dni:
            return user
    return None


def full_name(entry):
    """Nombre para mostrar: primero los nombres, luego los apellidos."""
    nombres = (entry.get("nombres") or "").strip()
    apellidos = (entry.get("apellidos") or "").strip()
    return f"{nombres} {apellidos}".strip()


def action_check(payload):
    dni = normalize_dni(payload.get("dni"))
    entry = find_whitelist_entry(dni)
    if not entry:
        return {"status": "not_found"}
    user = find_user_by_dni(dni)
    if user:
        return {"status": "has_account", "nombre": full_name(entry)}
    return {"status": "needs_password", "nombre": full_name(entry)}


def action_register(payload):
    dni = normalize_dni(payload.get("dni"))
    password = str(payload.get("password") or "")
    email = str(payload.get("email") or "").strip().lower()
    if len(password) < 6:
        raise ApiError("La contraseña debe tener al menos 6 caracteres.")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise ApiError("Ingresa un correo válido.")

    entry = find_whitelist_entry(dni)
    if not entry:
        raise ApiError("Este DNI no está autorizado. Contacta al administrador.", 403)
    if find_user_by_dni(dni):
        raise ApiError("Ya existe una cuenta con ese DNI. Inicia sesión.", 409)

    record_id = str(uuid.uuid4())
    fields = {
        "dni": dni,
        "name": full_name(entry),
        "email": email,
        "passwordHash": hash_password(password),
        "active": True,
        "avatar": None,
        "createdAt": int(time.time() * 1000),
    }
    sb_insert("users", record_id, fields)
    return {"id": record_id, "name": fields["name"], "dni": dni}


def action_login(payload):
    dni = normalize_dni(payload.get("dni"))
    password = str(payload.get("password") or "")

    user = find_user_by_dni(dni)
    if not user:
        raise ApiError("No existe una cuenta con ese DNI.", 404)
    if user.get("active") is False:
        raise ApiError("Esta cuenta está desactivada. Contacta al administrador.", 403)
    if not verify_password(password, user.get("passwordHash", "")):
        raise ApiError("Contraseña incorrecta.", 401)

    return {"id": user["id"], "name": user.get("name"), "dni": dni}


def action_change_password(payload):
    dni = normalize_dni(payload.get("dni"))
    current_password = str(payload.get("currentPassword") or "")
    new_password = str(payload.get("newPassword") or "")
    if len(new_password) < 6:
        raise ApiError("La nueva contraseña debe tener al menos 6 caracteres.")

    user = find_user_by_dni(dni)
    if not user:
        raise ApiError("No existe una cuenta con ese DNI.", 404)
    if not verify_password(current_password, user.get("passwordHash", "")):
        raise ApiError("Contraseña actual incorrecta.", 401)

    sb_update("users", user["id"], {"passwordHash": hash_password(new_password)})
    return {"ok": True}


def action_add_dni(payload):
    dni = normalize_dni(payload.get("dni"))
    nombres = str(payload.get("nombres") or "").strip()
    apellidos = str(payload.get("apellidos") or "").strip()
    if not nombres or not apellidos:
        raise ApiError("Nombres y apellidos son obligatorios.")
    if find_whitelist_entry(dni):
        raise ApiError("Ese DNI ya está autorizado.", 409)

    record_id = str(uuid.uuid4())
    fields = {"dni": dni, "nombres": nombres, "apellidos": apellidos, "createdAt": int(time.time() * 1000)}
    sb_insert("dni_whitelist", record_id, fields)
    return {"id": record_id, "dni": dni, "nombres": nombres, "apellidos": apellidos}


def action_list_dni(payload):
    entries = sb_get("dni_whitelist")
    entries.sort(key=lambda e: e.get("createdAt", 0), reverse=True)
    return {"items": entries}


def action_remove_dni(payload):
    record_id = payload.get("id")
    if not record_id:
        raise ApiError("Falta el id a eliminar.")
    sb_delete("dni_whitelist", record_id)
    return {"ok": True}


ACTIONS = {
    "check": action_check,
    "register": action_register,
    "login": action_login,
    "change_password": action_change_password,
    "add_dni": action_add_dni,
    "list_dni": action_list_dni,
    "remove_dni": action_remove_dni,
}


# --- Handler HTTP (formato nativo soportado por Vercel, sin dependencias) -


class handler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._send_json(200, {"ok": True, "service": "dni_auth"})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0) or 0)
            raw = self.rfile.read(length) if length else b"{}"
            payload = json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            self._send_json(400, {"error": "JSON inválido."})
            return

        action_fn = ACTIONS.get(payload.get("action"))
        if not action_fn:
            self._send_json(400, {"error": "Acción no reconocida."})
            return

        try:
            result = action_fn(payload)
            self._send_json(200, result)
        except ApiError as err:
            self._send_json(err.status, {"error": str(err)})
        except Exception as err:
            self._send_json(500, {"error": f"Error interno: {err}"})

    def log_message(self, format, *args):
        pass
