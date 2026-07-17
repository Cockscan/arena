const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SPACES_ENDPOINT = process.env.SPACES_ENDPOINT || '';
const SPACES_ACCESS_KEY = process.env.SPACES_ACCESS_KEY || '';
const SPACES_SECRET_KEY = process.env.SPACES_SECRET_KEY || '';
const SPACES_BUCKET = process.env.SPACES_BUCKET || 'pixelplex';
const SPACES_REGION = process.env.SPACES_REGION || 'us-east-1';

let s3Client = null;

if (SPACES_ENDPOINT && SPACES_ACCESS_KEY && SPACES_SECRET_KEY) {
  // Use exact endpoint and region for Spaces
  s3Client = new S3Client({
    region: SPACES_REGION,
    endpoint: SPACES_ENDPOINT,
    credentials: {
      accessKeyId: SPACES_ACCESS_KEY,
      secretAccessKey: SPACES_SECRET_KEY,
    },
  });
  console.log('  DigitalOcean Spaces initialized');
}

function isStorageReady() {
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
  if (!s3Client) throw new Error('Storage not configured');

  const command = new PutObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return getPublicUrl(key);
}

async function uploadLargeFile(buffer, key, contentType) {
  if (!s3Client) throw new Error('Storage not configured');

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: SPACES_BUCKET,
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
  if (!s3Client) throw new Error('Storage not configured');

  const command = new GetObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: key,
  });

  const response = await s3Client.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Download only the first N bytes of a file (for thumbnail generation)
async function downloadPartial(key, bytes = 5 * 1024 * 1024) {
  if (!s3Client) throw new Error('Storage not configured');

  const command = new GetObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: key,
    Range: `bytes=0-${bytes - 1}`,
  });

  const response = await s3Client.send(command);
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Stream download to temp file
async function downloadToTempFile(key) {
  if (!s3Client) throw new Error('Storage not configured');

  const command = new GetObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: key,
  });

  const response = await s3Client.send(command);
  const tmpPath = path.join(os.tmpdir(), `dl_${crypto.randomUUID()}${path.extname(key)}`);
  const writeStream = fs.createWriteStream(tmpPath);

  await new Promise((resolve, reject) => {
    response.Body.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
    response.Body.on('error', reject);
  });

  return tmpPath;
}

async function deleteFile(key) {
  if (!s3Client) throw new Error('Storage not configured');

  const command = new DeleteObjectCommand({
    Bucket: SPACES_BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

function getPublicUrl(key) {
  try {
    const url = new URL(SPACES_ENDPOINT);
    return `https://${SPACES_BUCKET}.${url.host}/${key}`;
  } catch (err) {
    return `https://${SPACES_BUCKET}.digitaloceanspaces.com/${key}`;
  }
}

module.exports = {
  isStorageReady,
  generateUploadKey,
  uploadFile,
  uploadLargeFile,
  downloadFile,
  downloadPartial,
  downloadToTempFile,
  deleteFile,
  getPublicUrl,
};
