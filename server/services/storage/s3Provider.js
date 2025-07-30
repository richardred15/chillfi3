/**
 * S3 Storage Provider
 */
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

class S3StorageProvider {
    constructor(awsConfig) {
        this.client = new S3Client({
            region: awsConfig.region,
            credentials: {
                accessKeyId: awsConfig.accessKeyId,
                secretAccessKey: awsConfig.secretAccessKey,
            },
        });
        this.bucketName = awsConfig.s3Bucket;
        this.region = awsConfig.region;
    }

    async uploadFile(buffer, key, contentType) {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        });

        await this.client.send(command);
        return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
    }

    async generateUrl(key, expiresIn = 900) {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key
        });
        
        return await getSignedUrl(this.client, command, { expiresIn });
    }

    async deleteFile(key) {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key
        });

        await this.client.send(command);
    }
}

module.exports = S3StorageProvider;