import express from 'express';
import { UploadResponse, ListUploadsResponse, UploadedAsset } from '../shared/types/api';
import { createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { media, redis } from '@devvit/web/server';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());
// Middleware for raw binary parsing for image uploads
app.use(
  // Only parse raw bodies when an image content-type is provided
  express.raw({
    type: (req) => {
      const ct = req.headers['content-type'];
      return ct === 'image/png' || ct === 'image/jpeg' || ct === 'image/gif' || ct === 'image/webp';
    },
    // Reasonable limit for image uploads in this demo
    limit: '4mb',
  })
);

const router = express.Router();

// Removed counter routes (/api/init, /api/increment, /api/decrement)

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.get<Record<string, never>, ListUploadsResponse | { status: string; message: string }>(
  '/api/my-images',
  async (_req, res): Promise<void> => {
    try {
      if (!context.userId) {
        res.status(401).json({ status: 'error', message: 'Unauthorized' });
        return;
      }
      const entries = await redis.hGetAll(context.userId);
      const assets: UploadedAsset[] = Object.values(entries || {})
        .map((raw) => {
          try {
            return JSON.parse(raw) as UploadedAsset;
          } catch {
            return null;
          }
        })
        .filter((a): a is UploadedAsset => Boolean(a))
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      res.json({ type: 'listUploads', assets });
    } catch (error) {
      console.error('List uploads error:', error);
      res.status(400).json({ status: 'error', message: 'Failed to fetch uploads' });
    }
  }
);

// Simple magic number checks to validate image formats
const isPng = (buf: Buffer): boolean =>
  buf.length >= 8 &&
  buf[0] === 0x89 &&
  buf[1] === 0x50 &&
  buf[2] === 0x4e &&
  buf[3] === 0x47 &&
  buf[4] === 0x0d &&
  buf[5] === 0x0a &&
  buf[6] === 0x1a &&
  buf[7] === 0x0a;

const isJpeg = (buf: Buffer): boolean =>
  buf.length >= 4 &&
  buf[0] === 0xff &&
  buf[1] === 0xd8 &&
  buf[buf.length - 2] === 0xff &&
  buf[buf.length - 1] === 0xd9;

const isGif = (buf: Buffer): boolean =>
  buf.length >= 6 &&
  buf[0] === 0x47 && // G
  buf[1] === 0x49 && // I
  buf[2] === 0x46 && // F
  buf[3] === 0x38 && // 8
  (buf[4] === 0x37 || buf[4] === 0x39) && // 7 or 9
  buf[5] === 0x61; // a

const isWebp = (buf: Buffer): boolean =>
  buf.length >= 12 &&
  // RIFF
  buf[0] === 0x52 &&
  buf[1] === 0x49 &&
  buf[2] === 0x46 &&
  buf[3] === 0x46 &&
  // skip 4 bytes (file size)
  buf[8] === 0x57 && // W
  buf[9] === 0x45 && // E
  buf[10] === 0x42 && // B
  buf[11] === 0x50; // P

router.post<Record<string, never>, UploadResponse | { status: string; message: string }>(
  '/api/upload-image',
  async (req, res): Promise<void> => {
    if (!context.userId) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }

    try {
      const contentType = req.headers['content-type'];
      if (
        contentType !== 'image/png' &&
        contentType !== 'image/jpeg' &&
        contentType !== 'image/gif' &&
        contentType !== 'image/webp'
      ) {
        res.status(415).json({ status: 'error', message: 'Unsupported Content-Type' });
        return;
      }

      const body = req.body as Buffer | undefined;
      if (!body || !Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ status: 'error', message: 'Empty or invalid request body' });
        return;
      }

      const validByMagic =
        (contentType === 'image/png' && isPng(body)) ||
        (contentType === 'image/jpeg' && isJpeg(body)) ||
        (contentType === 'image/gif' && isGif(body)) ||
        (contentType === 'image/webp' && isWebp(body));

      if (!validByMagic) {
        res.status(415).json({ status: 'error', message: 'Invalid image format' });
        return;
      }

      const fileNameHeader = req.headers['x-file-name'];
      const fileName = Array.isArray(fileNameHeader) ? fileNameHeader[0] : fileNameHeader;

      const baseResponse = {
        type: 'upload' as const,
        mimeType: contentType as UploadResponse['mimeType'],
        bytes: body.length,
      };

      const mediaType: 'image' | 'gif' | 'video' = contentType === 'image/gif' ? 'gif' : 'image';
      const dataUrl = `data:${contentType};base64,${body.toString('base64')}`;
      const asset = await media.upload({
        type: mediaType,
        url: dataUrl,
      });

      const assetData = {
        mediaType: mediaType,
        mediaUrl: asset.mediaUrl,
        mediaId: asset.mediaId,
        date: new Date().toISOString(),
      };

      await redis.hSet(context.userId, {
        [asset.mediaUrl]: JSON.stringify(assetData),
      });

      if (fileName) {
        res.json({ ...baseResponse, fileName });
      } else {
        res.json(baseResponse);
      }
    } catch (error) {
      console.error('Upload error:', error);
      res.status(400).json({ status: 'error', message: 'Failed to process image upload' });
    }
  }
);

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
