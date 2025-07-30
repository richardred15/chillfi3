/**
 * CLI Commands Module - Shared between server.js and cli.js
 */
const readline = require('readline');
const bcrypt = require('bcrypt');
const database = require('../database');
const config = require('../config');

class CLICommands {
    constructor() {
        this.imageUploadSessions = null;
        this.initUploadSessions();
    }

    initUploadSessions() {
        try {
            const uploadService = require('../services/uploadService');
            this.imageUploadSessions = uploadService.imageUploadSessions;
        } catch (error) {
            console.log('Upload service not available');
            this.imageUploadSessions = new Map();
        }
    }

    async addUser(username, password, isAdmin = 'false') {
        if (!username) {
            console.log('Usage: add-user <username> [password] [admin]');
            return;
        }

        const existing = await database.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        if (existing.length > 0) {
            console.log('User already exists');
            return;
        }

        let passwordHash = null;
        if (password) {
            passwordHash = await bcrypt.hash(password, 10);
        }

        const result = await database.query(
            'INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)',
            [username, passwordHash, isAdmin === 'true']
        );

        console.log(`User '${username}' created with ID ${result.insertId}`);
        if (!password) {
            console.log('No password set - user must set password via web interface');
        }
    }

    async listUsers() {
        const users = await database.query(`
            SELECT u.id, u.username, u.display_name, u.is_admin, u.created_at, u.last_login,
                   COUNT(s.id) as song_count
            FROM users u
            LEFT JOIN songs s ON u.id = s.uploaded_by
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        console.log('\n=== Users ===');
        console.log('ID | Username | Display Name | Admin | Songs | Created | Last Login');
        console.log('---|----------|--------------|-------|-------|---------|------------');

        users.forEach((user) => {
            const created = new Date(user.created_at).toLocaleDateString();
            const lastLogin = user.last_login
                ? new Date(user.last_login).toLocaleDateString()
                : 'Never';
            const admin = user.is_admin ? 'Yes' : 'No';

            console.log(
                `${user.id.toString().padEnd(2)} | ${user.username.padEnd(8)} | ${(user.display_name || '').padEnd(12)} | ${admin.padEnd(5)} | ${user.song_count.toString().padEnd(5)} | ${created.padEnd(9)} | ${lastLogin}`
            );
        });
    }

    async resetPassword(username, newPassword) {
        if (!username || !newPassword) {
            console.log('Usage: reset-password <username> <new-password>');
            return;
        }

        const users = await database.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        if (users.length === 0) {
            console.log('User not found');
            return;
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await database.query(
            'UPDATE users SET password = ? WHERE username = ?',
            [passwordHash, username]
        );

        // Clear all sessions for this user
        await database.query('DELETE FROM sessions WHERE user_id = ?', [
            users[0].id,
        ]);

        console.log(`Password reset for user '${username}'`);
    }

    async makeAdmin(username, isAdmin = 'true') {
        if (!username) {
            console.log('Usage: make-admin <username> [true|false]');
            return;
        }

        const result = await database.query(
            'UPDATE users SET is_admin = ? WHERE username = ?',
            [isAdmin === 'true', username]
        );

        if (result.affectedRows === 0) {
            console.log('User not found');
            return;
        }

        console.log(
            `User '${username}' ${isAdmin === 'true' ? 'granted' : 'revoked'} admin privileges`
        );
    }

    async showStatus() {
        const [userCount] = await database.query('SELECT COUNT(*) as count FROM users');
        const [songCount] = await database.query('SELECT COUNT(*) as count FROM songs');
        const [albumCount] = await database.query('SELECT COUNT(*) as count FROM albums');
        const [artistCount] = await database.query('SELECT COUNT(*) as count FROM artists');
        const [playlistCount] = await database.query('SELECT COUNT(*) as count FROM playlists');
        const [listenCount] = await database.query('SELECT COUNT(*) as count FROM song_listens');

        console.log('\n=== ChillFi3 Server Status ===');
        console.log(`Users: ${userCount.count}`);
        console.log(`Songs: ${songCount.count}`);
        console.log(`Albums: ${albumCount.count}`);
        console.log(`Artists: ${artistCount.count}`);
        console.log(`Playlists: ${playlistCount.count}`);
        console.log(`Total Listens: ${listenCount.count}`);

        let activeUploads;
        try {
            const uploadService = require('../services/uploadService');
            activeUploads = uploadService.getActiveUploads();
        } catch (error) {
            activeUploads = new Map();
        }

        console.log(`Active Song Uploads: ${activeUploads ? activeUploads.size : 0}`);
        console.log(`Active Image Uploads: ${this.imageUploadSessions ? this.imageUploadSessions.size : 0}`);

        // Memory usage
        const memUsage = process.memoryUsage();
        console.log(
            `Memory Usage: ${Math.round(memUsage.rss / 1024 / 1024)}MB RSS, ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB Heap`
        );
    }

    showUploads() {
        console.log('\n=== Active Song Uploads ===');

        let activeUploads;
        try {
            const uploadService = require('../services/uploadService');
            activeUploads = uploadService.getActiveUploads();
        } catch (error) {
            activeUploads = new Map();
        }

        if (!activeUploads || activeUploads.size === 0) {
            console.log('No active song uploads');
        } else {
            console.log('ID | User | Files | Progress | Current File');
            console.log('---|------|-------|----------|-------------');

            for (const [uploadId, session] of activeUploads.entries()) {
                const shortId = uploadId.substring(0, 8);
                const progress = `${session.processedFiles}/${session.totalFiles}`;
                const currentFile = session.currentFile || 'Processing...';
                const elapsed = Math.round((Date.now() - session.startTime) / 1000);

                console.log(
                    `${shortId} | ${session.username.padEnd(8)} | ${session.totalFiles.toString().padEnd(5)} | ${progress.padEnd(8)} | ${currentFile} (${elapsed}s)`
                );
            }
        }

        console.log('\n=== Active Image Uploads ===');

        if (!this.imageUploadSessions || this.imageUploadSessions.size === 0) {
            console.log('No active image uploads');
        } else {
            console.log('ID | User | Chunks | Progress');
            console.log('---|------|--------|----------');

            for (const [uploadId, session] of this.imageUploadSessions.entries()) {
                const shortId = uploadId.substring(0, 8);
                const progress = `${session.receivedCount}/${session.totalChunks}`;

                console.log(
                    `${shortId} | ${session.userId.toString().padEnd(4)} | ${session.totalChunks.toString().padEnd(6)} | ${progress}`
                );
            }
        }
    }

    async debugUsers() {
        try {
            const users = await database.query(
                'SELECT id, username, password IS NOT NULL as has_password, is_admin, created_at FROM users'
            );
            console.log('\n=== User Debug Info ===');
            console.log('Total users:', users.length);

            if (users.length > 0) {
                console.log('ID | Username | Has Password | Admin | Created');
                console.log('---|----------|--------------|-------|--------');
                users.forEach((user) => {
                    const created = new Date(user.created_at).toLocaleDateString();
                    console.log(
                        `${user.id} | ${user.username} | ${user.has_password ? 'Yes' : 'No'} | ${user.is_admin ? 'Yes' : 'No'} | ${created}`
                    );
                });
            } else {
                console.log('No users found. Creating test user...');
                await this.addUser('admin', 'password', 'true');
            }
        } catch (error) {
            console.error('Debug users error:', error);
        }
    }

    async setupDatabase() {
        console.log('Setting up database with schema...');
        try {
            const { generateSchemaSQL } = require('../database');
            const schema = require('../schema.json');
            const sql = generateSchemaSQL(schema);
            await database.query(sql);
            console.log('✅ Database setup completed!');
        } catch (error) {
            console.error('❌ Database setup failed:', error.message);
        }
    }

    async migrateDatabase() {
        console.log('Migrating database...');
        try {
            // Check current version
            let currentVersion = '0.0.0';
            try {
                const result = await database.query(
                    'SELECT version FROM schema_version ORDER BY applied_at DESC LIMIT 1'
                );
                if (result.length > 0) currentVersion = result[0].version;
            } catch (error) {
                await database.query(
                    'CREATE TABLE IF NOT EXISTS schema_version (id INT AUTO_INCREMENT PRIMARY KEY, version VARCHAR(20) NOT NULL, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)'
                );
            }

            const schema = require('../schema.json');
            if (currentVersion === schema.version) {
                console.log('✅ Database is up to date!');
                return;
            }

            const { generateSchemaSQL } = require('../database');
            const sql = generateSchemaSQL(schema);
            await database.query(sql);
            await database.query('INSERT INTO schema_version (version) VALUES (?)', [schema.version]);
            console.log('✅ Database migration completed!');
        } catch (error) {
            console.error('❌ Migration failed:', error.message);
        }
    }

    async backupDatabase(filename) {
        const { spawnSync } = require('child_process');
        const fs = require('fs');
        const backupFile = filename || `chillfi3_backup_${new Date().toISOString().slice(0, 10)}.sql`;
        console.log(`Creating backup: ${backupFile}`);
        try {
            const mysqldumpArgs = [
                '-h', config.database.host,
                '-u', config.database.user,
                `-p${config.database.password}`,
                '--single-transaction',
                '--set-gtid-purged=OFF',
                config.database.database,
            ];
            const out = fs.openSync(backupFile, 'w');
            const dump = spawnSync('mysqldump', mysqldumpArgs, {
                stdio: ['ignore', out, 'ignore'],
            });
            fs.closeSync(out);
            if (dump.error) throw dump.error;
            if (dump.status !== 0) throw new Error('mysqldump failed');
            console.log('✅ Backup completed!');
        } catch (error) {
            console.error('❌ Backup failed:', error.message);
        }
    }

    async restoreDatabase(filename) {
        const { execSync } = require('child_process');
        if (!filename) {
            console.log('Usage: restore <filename>');
            return;
        }
        console.log(`Restoring from: ${filename}`);
        try {
            execSync(
                `mysql -h ${config.database.host} -u ${config.database.user} -p${config.database.password} ${config.database.database} < ${filename} 2>/dev/null`
            );
            console.log('✅ Restore completed!');
        } catch (error) {
            console.error('❌ Restore failed:', error.message);
        }
    }

    async createAdmin(username, password) {
        if (!username || !password) {
            console.log('Usage: create-admin <username> <password>');
            return;
        }

        try {
            const existing = await database.query(
                'SELECT id FROM users WHERE username = ?',
                [username]
            );
            if (existing.length > 0) {
                console.log('❌ User already exists!');
                return;
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const result = await database.query(
                'INSERT INTO users (username, password, is_admin) VALUES (?, ?, TRUE)',
                [username, passwordHash]
            );
            console.log(`✅ Admin user '${username}' created with ID ${result.insertId}`);
        } catch (error) {
            console.error('❌ Error creating admin:', error.message);
        }
    }

    showHelp() {
        console.log('\nDatabase Commands:');
        console.log('  setup-database                          - Initialize database with schema');
        console.log('  migrate                                  - Migrate database to latest schema');
        console.log('  backup [filename]                       - Create database backup');
        console.log('  restore <filename>                      - Restore database from backup');
        console.log('\nUser Management:');
        console.log('  create-admin <username> <password>      - Create admin user');
        console.log('  add-user <username> [password] [admin]  - Add user');
        console.log('  list-users                              - List users');
        console.log('  reset-password <username> <password>    - Reset password');
        console.log('  make-admin <username> [true|false]      - Toggle admin');
        console.log('\nSystem Information:');
        console.log('  status                                   - Server status');
        console.log('  uploads                                  - Active uploads');
        console.log('  clear                                    - Clear screen');
        console.log('  debug-users                              - Debug user table');
        console.log('  help                                     - Show this help');
    }

    async executeCommand(command, args) {
        try {
            switch (command) {
                case 'help':
                    this.showHelp();
                    break;
                case 'add-user':
                    await this.addUser(args[0], args[1], args[2]);
                    break;
                case 'list-users':
                    await this.listUsers();
                    break;
                case 'reset-password':
                    await this.resetPassword(args[0], args[1]);
                    break;
                case 'make-admin':
                    await this.makeAdmin(args[0], args[1]);
                    break;
                case 'status':
                    await this.showStatus();
                    break;
                case 'uploads':
                    this.showUploads();
                    break;
                case 'clear':
                    console.clear();
                    break;
                case 'setup-database':
                    await this.setupDatabase();
                    break;
                case 'migrate':
                    await this.migrateDatabase();
                    break;
                case 'backup':
                    await this.backupDatabase(args[0]);
                    break;
                case 'restore':
                    await this.restoreDatabase(args[0]);
                    break;
                case 'create-admin':
                    await this.createAdmin(args[0], args[1]);
                    console.log('Admin creation completed');
                    break;
                case 'debug-users':
                    await this.debugUsers();
                    break;
                case '':
                    break;
                default:
                    console.log(`Unknown command: ${command}. Type "help" for available commands.`);
            }
        } catch (error) {
            console.error(error.message);
        }
    }
}

module.exports = CLICommands;