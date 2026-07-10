-- Autenticación: código por correo (OTP) + passkeys (Face ID / WebAuthn)
-- Se aplica sobre el esquema existente; NO borra nada.

-- Códigos de acceso de un solo uso. Se guarda el hash, nunca el código.
CREATE TABLE IF NOT EXISTS codigos_acceso (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  codigo_hash TEXT NOT NULL,
  expira_en TEXT NOT NULL,          -- ISO UTC
  intentos INTEGER DEFAULT 0,
  usado INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_codigos_email ON codigos_acceso(email);
CREATE INDEX IF NOT EXISTS idx_codigos_created ON codigos_acceso(created_at);

-- Passkeys registradas por dispositivo (llave pública; la privada nunca sale del iPhone).
CREATE TABLE IF NOT EXISTS credenciales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,          -- base64url
  counter INTEGER DEFAULT 0,
  transports TEXT,
  dispositivo TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cred_usuario ON credenciales(usuario_id);

-- Retos (challenges) temporales de WebAuthn. Se borran al usarse.
CREATE TABLE IF NOT EXISTS retos_webauthn (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  challenge TEXT NOT NULL,
  tipo TEXT NOT NULL,                -- 'registro' | 'login'
  expira_en TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_retos_email ON retos_webauthn(email);
