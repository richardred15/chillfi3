/**
 * Storage Service - Abstraction layer for file storage
 */
const config = require('../config');
const S3StorageProvider = require('./storage/s3Provider');
const LocalStorageProvider = require('./storage/localProvider');

class StorageService {
    constructor() {
        this.provider = null;
        this.init();
    }

    init() {
        const storageType = config.storage.type;
        
        switch (storageType) {
            case 'local':
                this.provider = new LocalStorageProvider(config.storage.localPath);
                break;
            case 's3':
            default:
                this.provider = new S3StorageProvider(config.aws);
                break;
        }
    }

    async uploadFile(buffer, key, contentType) {
        return await this.provider.uploadFile(buffer, key, contentType);
    }

    async generateUrl(key, expiresIn = 900) {
        return await this.provider.generateUrl(key, expiresIn);
    }

    async deleteFile(key) {
        return await this.provider.deleteFile(key);
    }

    async initialize() {
        if (this.provider.initialize) {
            await this.provider.initialize();
        }
    }
}

module.exports = new StorageService();