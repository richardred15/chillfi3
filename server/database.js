/**
 * Database Connection and Schema Management
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const config = require('./config');
const schema = require('./schema.json');
const {
    validateQueryParams,
} = require('./middleware/sqlSecurity');

const dbConfig = {
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    charset: 'utf8mb4',
};

let pool;

// Initialize database connection pool and schema
async function init() {
    try {
        console.log('Database config:', {
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.user,
            password: dbConfig.password ? 'SET' : 'NOT SET',
            database: dbConfig.database,
        });

        // Create connection without database first
        const tempConnection = await mysql.createConnection({
            ...dbConfig,
            database: undefined,
        });

        // Create database if it doesn't exist
        // Validate database name as an identifier (alphanumeric and underscores only)
        if (!/^[a-zA-Z0-9_]+$/.test(dbConfig.database)) {
            throw new Error('Invalid database name in config');
        }
        await tempConnection.execute(
            `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
        await tempConnection.end();

        // Create connection pool with valid options only
        pool = mysql.createPool({
            ...dbConfig,
            connectionLimit: 10,
            queueLimit: 0,
        });

        // Create tables using schema
        await createTablesFromSchema();

        console.log('Database pool established');
        return pool;
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    }
}

// Create tables from schema.json
async function createTablesFromSchema() {
    const sql = generateSchemaSQL(schema);

    // Split SQL into individual statements and execute
    const statements = sql.split(';').filter((stmt) => stmt.trim());

    for (const statement of statements) {
        try {
            await pool.execute(statement.trim());
        } catch (error) {
            // Ignore duplicate key/index errors and table exists errors
            if (
                error.code !== 'ER_DUP_KEYNAME' &&
                error.code !== 'ER_TABLE_EXISTS_ERROR' &&
                error.code !== 'ER_DUP_KEY' &&
                !error.message.includes('Duplicate key name')
            ) {
                console.error(
                    'Error executing statement:',
                    statement.substring(0, 50) + '...',
                    error.message
                );
            }
        }
    }

    // Run schema migrations for existing tables
    await runSchemaMigrations();

    console.log('Database tables created/verified from schema');
}

// Run schema migrations for existing tables
async function runSchemaMigrations() {
    try {
        // Get current database structure
        const currentSchema = await getCurrentDatabaseSchema();
        
        // Compare with target schema and generate migrations
        const migrations = generateMigrations(currentSchema, schema);
        
        // Execute migrations
        for (const migration of migrations) {
            try {
                console.log('Running migration:', migration.description);
                await pool.execute(migration.sql);
                console.log('Migration completed:', migration.description);
            } catch (error) {
                console.error('Migration failed:', migration.description, error.message);
                // Continue with other migrations
            }
        }
    } catch (error) {
        console.error('Schema migration error:', error.message);
        // Don't throw - continue with startup
    }
}

// Get current database schema
async function getCurrentDatabaseSchema() {
    const [tables] = await pool.execute(
        'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?',
        [dbConfig.database]
    );
    
    const currentSchema = {};
    
    for (const table of tables) {
        const tableName = table.TABLE_NAME;
        const [columns] = await pool.execute(
            'SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
            [dbConfig.database, tableName]
        );
        
        currentSchema[tableName] = {
            columns: {}
        };
        
        for (const column of columns) {
            currentSchema[tableName].columns[column.COLUMN_NAME] = {
                type: column.DATA_TYPE,
                nullable: column.IS_NULLABLE === 'YES',
                default: column.COLUMN_DEFAULT
            };
        }
    }
    
    return currentSchema;
}

// Generate migrations by comparing schemas
function generateMigrations(currentSchema, targetSchema) {
    const migrations = [];
    
    for (const [tableName, tableSchema] of Object.entries(targetSchema.tables)) {
        if (!currentSchema[tableName]) {
            // Table doesn't exist - will be created by CREATE TABLE IF NOT EXISTS
            continue;
        }
        
        // Check for missing columns
        for (const [columnName, columnSchema] of Object.entries(tableSchema.columns)) {
            if (!currentSchema[tableName].columns[columnName]) {
                // Column is missing - add it
                let columnDef = `${columnSchema.type}`;
                
                if (columnSchema.notNull || columnSchema.nullable === false) {
                    columnDef += ' NOT NULL';
                }
                if (columnSchema.default !== undefined) {
                    columnDef += ` DEFAULT ${columnSchema.default}`;
                }
                
                migrations.push({
                    description: `Add column ${columnName} to table ${tableName}`,
                    sql: `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`
                });
            }
        }
    }
    
    return migrations;
}

function generateSchemaSQL(schema) {
    let sql = '';

    for (const [tableName, tableSchema] of Object.entries(schema.tables)) {
        sql += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;

        const columnDefs = [];
        for (const [columnName, columnSchema] of Object.entries(
            tableSchema.columns
        )) {
            let columnDef = `  ${columnName} ${columnSchema.type}`;

            if (columnSchema.autoIncrement) columnDef += ' AUTO_INCREMENT';
            if (columnSchema.notNull || columnSchema.nullable === false)
                columnDef += ' NOT NULL';
            if (columnSchema.unique) columnDef += ' UNIQUE';
            if (columnSchema.default !== undefined)
                columnDef += ` DEFAULT ${columnSchema.default}`;

            columnDefs.push(columnDef);
        }

        sql += columnDefs.join(',\n');

        // Add primary key
        if (tableSchema.primaryKey) {
            if (Array.isArray(tableSchema.primaryKey)) {
                sql += `,\n  PRIMARY KEY (${tableSchema.primaryKey.join(
                    ', '
                )})`;
            }
        } else {
            for (const [columnName, columnSchema] of Object.entries(
                tableSchema.columns
            )) {
                if (columnSchema.primaryKey) {
                    sql += `,\n  PRIMARY KEY (${columnName})`;
                    break;
                }
            }
        }

        // Add foreign keys
        if (tableSchema.foreignKeys) {
            for (const fk of tableSchema.foreignKeys) {
                sql += `,\n  FOREIGN KEY (${fk.column}) REFERENCES ${fk.references}`;
                if (fk.onDelete) sql += ` ON DELETE ${fk.onDelete}`;
            }
        }

        sql += '\n);\n\n';

        // Add indexes (handled separately to avoid IF NOT EXISTS issues)
        if (tableSchema.indexes) {
            for (const index of tableSchema.indexes) {
                const indexType = index.unique ? 'UNIQUE INDEX' : 'INDEX';
                sql += `CREATE ${indexType} ${
                    index.name
                } ON ${tableName} (${index.columns.join(', ')});\n`;
            }
            sql += '\n';
        }
    }

    return sql;
}

// Get database connection pool
function getConnection() {
    if (!pool) {
        throw new Error('Database not initialized');
    }
    return pool;
}

// Execute query with security validation and error handling
async function query(sql, params = []) {
    let connection;
    try {
        // Only validate parameters for SQL injection, not the query itself
        // Pass context for auth-related queries
        const context =
            sql.includes('sessions') || sql.includes('users') ? 'auth' : '';
        if (!validateQueryParams(params, context)) {
            console.error(
                'Potential SQL injection detected in parameters:',
                params
            );
            throw new Error('Invalid parameters detected');
        }

        connection = await pool.getConnection();
        const [results] = await connection.execute(sql, params);
        return results;
    } catch (error) {
        // Don't expose database details in error messages
        console.error('Database query error:', error.message);
        throw new Error('Database operation failed');
    } finally {
        if (connection) connection.release();
    }
}

// Cleanup function
async function cleanup() {
    if (pool) {
        await pool.end();
        console.log('Database pool closed');
    }
}

// Transaction support
async function beginTransaction() {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    return connection;
}

async function commitTransaction(connection) {
    await connection.commit();
    connection.release();
}

async function rollbackTransaction(connection) {
    await connection.rollback();
    connection.release();
}

module.exports = {
    init,
    getConnection,
    query,
    cleanup,
    generateSchemaSQL,
    runSchemaMigrations,
    beginTransaction,
    commitTransaction,
    rollbackTransaction,
};
