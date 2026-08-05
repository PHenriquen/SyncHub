# Security notes

`SYNCHUB.bat` creates `.env` with cryptographically random access and refresh secrets. The file and
the SQLite database are ignored by Git and must remain private.

Access tokens are short-lived. Refresh tokens are rotated, hashed in the database and consumed
atomically. GitHub webhooks require an HMAC signature and use delivery IDs for replay protection.

The demo password is intended only for local development and should be changed before any shared or
public deployment.
