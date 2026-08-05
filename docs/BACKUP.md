# Backup and restore

Run `CRIAR_BACKUP_SYNCHUB.bat` while the development server is stopped.

The backup contains:

- the embedded SQLite database;
- local `.env` configuration and secrets;
- a clean source snapshot;
- version metadata;
- SHA-256 checksums.

Store the generated ZIP privately because `.env` contains local authentication secrets.

To restore, run `RESTAURAR_BACKUP_SYNCHUB.bat`, select the ZIP and then run `SYNCHUB.bat`.
