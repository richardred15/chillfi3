/**
 * Storage Service - Abstraction layer for file storage
 */
const config = require('../config');
const S3StorageProvider = require('./storage/s3Provider');
const LocalStorageProvider = require('./storage/localProvider');
const logger = require('../utils/logger');

class StorageService {
    constructor() {
        this.provider = null;
        this.init();
    }

    init() {
        const storageType = config.storage.type;
        
        logger.info('Initializing storage service', {
            storageType,
            localPath: config.storage.localPath,
            hasS3Config: !!(config.aws?.accessKeyId && config.aws?.secretAccessKey)
        });
        
        try {
            switch (storageType) {
                case 'local':
                    if (!config.storage.localPath) {
                        throw new Error('LOCAL_STORAGE_PATH is required for local storage');
                    }
                    this.provider = new LocalStorageProvider(config.storage.localPath);
                    logger.info('Local storage provider initialized', {
                        path: config.storage.localPath
                    });
                    break;
                case 's3':
                    if (!config.aws?.accessKeyId || !config.aws?.secretAccessKey || !config.aws?.s3Bucket) {
                        throw new Error('AWS credentials and S3 bucket are required for S3 storage');
                    }
                    this.provider = new S3StorageProvider(config.aws);
                    logger.info('S3 storage provider initialized', {
                        region: config.aws.region,
                        bucket: config.aws.s3Bucket
                    });
                    break;
                default:
                    throw new Error(`Invalid STORAGE_TYPE: ${storageType}. Must be 'local' or 's3'`);
            }
        } catch (error) {
            logger.error('Storage service initialization failed', {
                storageType,
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    async uploadFile(buffer, key, contentType) {
        const uploadId = `storage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        logger.info('Storage upload started', {
            uploadId,
            key,
            contentType,
            bufferSize: buffer?.length || 0,
            provider: this.provider?.constructor?.name || 'unknown'
        });
        
        try {
            if (!this.provider) {
                throw new Error('Storage provider not initialized');
            }
            
            if (!buffer || buffer.length === 0) {
                throw new Error('Buffer is empty or invalid');
            }
            
            if (!key) {
                throw new Error('Storage key is required');
            }
            
            const result = await this.provider.uploadFile(buffer, key, contentType);
            
            logger.info('Storage upload completed', {
                uploadId,
                key,
                result: typeof result === 'string' ? result.substring(0, 100) + '...' : result
            });
            
            return result;
        } catch (error) {
            logger.error('Storage upload failed', {
                uploadId,
                key,
                contentType,
                bufferSize: buffer?.length || 0,
                error: error.message,
                stack: error.stack,
                provider: this.provider?.constructor?.name || 'unknown'
            });
            throw error;
        }
    }

    async generateUrl(key, expiresIn = 900) {
        const requestId = `url-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        logger.debug('Generating storage URL', {
            requestId,
            key,
            expiresIn,
            provider: this.provider?.constructor?.name || 'unknown'
        });
        
        try {
            if (!this.provider) {
                throw new Error('Storage provider not initialized');
            }
            
            if (!key) {
                throw new Error('Storage key is required');
            }
            
            const url = await this.provider.generateUrl(key, expiresIn);
            
            logger.debug('Storage URL generated', {
                requestId,
                key,
                urlLength: url?.length || 0,
                urlPrefix: url?.substring(0, 50) || 'none'
            });
            
            return url;
        } catch (error) {
            logger.error('Storage URL generation failed', {
                requestId,
                key,
                expiresIn,
                error: error.message,
                stack: error.stack,
                provider: this.provider?.constructor?.name || 'unknown'
            });
            throw error;
        }
    }

    async deleteFile(key) {
        const deleteId = `delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        logger.info('Storage delete started', {
            deleteId,
            key,
            provider: this.provider?.constructor?.name || 'unknown'
        });
        
        try {
            if (!this.provider) {
                throw new Error('Storage provider not initialized');
            }
            
            if (!key) {
                throw new Error('Storage key is required');
            }
            
            const result = await this.provider.deleteFile(key);
            
            logger.info('Storage delete completed', {
                deleteId,
                key,
                result
            });
            
            return result;
        } catch (error) {
            logger.error('Storage delete failed', {
                deleteId,
                key,
                error: error.message,
                stack: error.stack,
                provider: this.provider?.constructor?.name || 'unknown'
            });
            throw error;
        }
    }

    initialize() {
        if (this.provider.initialize) {
            this.provider.initialize();
        }
    }
}

module.exports = new StorageService();