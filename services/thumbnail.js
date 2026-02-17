const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate a thumbnail from a video buffer.
 * Writes video to temp file, extracts frame at ~2s, returns JPEG buffer.
 * Returns null if ffmpeg is not available or fails.
 */
async function generateThumbnail(videoBuffer) {
  const tmpDir = os.tmpdir();
  const videoTmpPath = path.join(tmpDir, `arena_vid_${uuidv4()}.mp4`);
  const thumbFilename = `arena_thumb_${uuidv4()}.jpg`;
  const thumbTmpPath = path.join(tmpDir, thumbFilename);

  try {
    // Write video buffer to temp file
    fs.writeFileSync(videoTmpPath, videoBuffer);

    // Generate thumbnail using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(videoTmpPath)
        .on('end', resolve)
        .on('error', (err) => {
          console.error('ffmpeg thumbnail error:', err.message);
          reject(err);
        })
        .screenshots({
          timestamps: ['2'],
          filename: thumbFilename,
          folder: tmpDir,
          size: '1280x720',
        });
    });

    // Read generated thumbnail
    if (fs.existsSync(thumbTmpPath)) {
      const thumbBuffer = fs.readFileSync(thumbTmpPath);
      return thumbBuffer;
    }

    return null;
  } catch (err) {
    console.error('Thumbnail generation failed:', err.message);
    return null;
  } finally {
    // Cleanup temp files
    try { if (fs.existsSync(videoTmpPath)) fs.unlinkSync(videoTmpPath); } catch (e) { /* ignore */ }
    try { if (fs.existsSync(thumbTmpPath)) fs.unlinkSync(thumbTmpPath); } catch (e) { /* ignore */ }
  }
}

/**
 * Get video duration in seconds from a video buffer.
 * Returns null if ffprobe is not available.
 */
async function getVideoDuration(videoBuffer) {
  const tmpDir = os.tmpdir();
  const videoTmpPath = path.join(tmpDir, `arena_dur_${uuidv4()}.mp4`);

  try {
    fs.writeFileSync(videoTmpPath, videoBuffer);

    return await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoTmpPath, (err, metadata) => {
        if (err) {
          console.error('ffprobe error:', err.message);
          resolve(null);
        } else {
          resolve(Math.round(metadata.format.duration || 0));
        }
      });
    });
  } catch (err) {
    console.error('Duration detection failed:', err.message);
    return null;
  } finally {
    try { if (fs.existsSync(videoTmpPath)) fs.unlinkSync(videoTmpPath); } catch (e) { /* ignore */ }
  }
}

module.exports = { generateThumbnail, getVideoDuration };
