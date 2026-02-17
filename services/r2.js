const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const crypto = require('crypto');
const path = require('path');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'arena-sports';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

let s3Client = null;

if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  console.log('  Cloudflare R2 initialized');
}

function isR2Ready() {
  return s3Client !== null;
}

function generateUploadKey(folder, originalFilename) {
  const ext = path.extname(originalFilename).toLowerCase();
  const sanitized = path.basename(originalFilename, ext)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 50);
  return `${folder}/${crypto.randomUUID()}-${sanitized}${ext}`;
}

async function uploadFile(buffer, key, contentType) {
  if (!s3Client) throw new Error('R2 not configured');

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return getPublicUrl(key);
}

async function uploadLargeFile(buffer, key, contentType) {
  if (!s3Client) throw new Error('R2 not configured');

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    },
    queueSize: 4,
    partSize: 10 * 1024 * 1024, // 10MB parts
  });

  await upload.done();
  return getPublicUrl(key);
}

async function downloadFile(key) {
  if (!s3Client) throw new Error('R2 not configured');

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function deleteFile(key) {
  if (!s3Client) throw new Error('R2 not configured');

  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

function getPublicUrl(key) {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  return `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}

module.exports = {
  isR2Ready,
  generateUploadKey,
  uploadFile,
  uploadLargeFile,
  downloadFile,
  deleteFile,
  getPublicUrl,
};
