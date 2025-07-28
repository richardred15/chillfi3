# Production Secrets

This directory contains example files for production secrets used by Docker Compose.

## Setup for Production

1. Copy the example files:
```bash
cp db_root_password.txt.example db_root_password.txt
cp db_password.txt.example db_password.txt
```

2. Edit the files with your secure passwords:
```bash
# Generate secure passwords
openssl rand -base64 32 > db_root_password.txt
openssl rand -base64 32 > db_password.txt
```

3. Ensure proper permissions:
```bash
chmod 600 *.txt
```

## Security Notes

- **Never commit actual password files to git**
- Use strong, randomly generated passwords
- Rotate passwords regularly
- Limit file permissions to owner only
- Consider using a proper secrets management system for production

## Files

- `db_root_password.txt.example` - Example MySQL root password
- `db_password.txt.example` - Example MySQL user password
- `README.md` - This file

The actual `.txt` files are ignored by git via `.gitignore`.