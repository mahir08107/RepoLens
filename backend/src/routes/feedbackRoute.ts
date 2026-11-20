import { Router, Request, Response } from 'express';
import multer from 'multer';
import nodemailer, { Transporter } from 'nodemailer';

export const feedbackRouter = Router();

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per image
    files: 4,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPEG, WebP, and GIF images are allowed.'));
    }
  },
});

let cachedTransporter: Transporter | null = null;
let cachedKey = '';

function getPooledTransporter(user: string, pass: string): Transporter {
  const key = `${user}:${pass.slice(0, 6)}`;
  if (!cachedTransporter || cachedKey !== key) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
      auth: { user, pass },
    });
    cachedKey = key;
  }
  return cachedTransporter;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * POST /api/feedback
 * Accepts multipart/form-data (`title`, `description`, `senderEmail`, `repoContext`, `screenshots[]`)
 * and delivers a formatted HTML report with image attachments to contact.repolens@gmail.com.
 */
feedbackRouter.post('/feedback', (req: Request, res: Response) => {
  upload.array('screenshots', 4)(req, res, async (uploadErr: any) => {
    if (uploadErr) {
      const msg =
        uploadErr?.code === 'LIMIT_FILE_SIZE'
          ? 'Each screenshot must be under 5MB.'
          : uploadErr?.code === 'LIMIT_FILE_COUNT'
            ? 'You can attach up to 4 screenshots maximum.'
            : uploadErr?.message || 'Invalid file upload.';
      res.status(400).json({ error: msg });
      return;
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const senderEmail =
      typeof req.body?.senderEmail === 'string' ? req.body.senderEmail.trim() : '';
    const repoContext =
      typeof req.body?.repoContext === 'string' ? req.body.repoContext.trim() : '';

    if (!title || !description) {
      res.status(400).json({ error: 'Title and description are required.' });
      return;
    }

    const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
    const smtpUser = process.env.SMTP_USER || 'contact.repolens@gmail.com';
    const smtpPass = process.env.SMTP_APP_PASSWORD;

    if (!smtpPass) {
      console.warn('[feedbackRoute] SMTP_APP_PASSWORD is not set in backend/.env');
      res.status(503).json({
        error:
          'Email delivery is not configured yet (SMTP_APP_PASSWORD missing on backend). Please use the direct mailto link below.',
      });
      return;
    }

    const timestamp = new Date().toISOString();
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #09090B; max-width: 640px; margin: 0 auto; border: 1px solid #E4E4E7; border-radius: 14px; overflow: hidden;">
        <div style="background: #09090B; color: #FFFFFF; padding: 20px 24px;">
          <div style="font-family: monospace; font-size: 11px; letter-spacing: 0.08em; color: #A1A1AA; text-transform: uppercase;">RepoLens Feedback Report</div>
          <h2 style="margin: 6px 0 0; font-size: 20px; font-weight: 600;">${escapeHtml(title)}</h2>
        </div>
        <div style="padding: 24px; background: #FFFFFF;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
            <tr>
              <td style="padding: 6px 0; color: #71717A; width: 140px; font-family: monospace;">SENDER EMAIL</td>
              <td style="padding: 6px 0; color: #09090B; font-weight: 500;">${escapeHtml(senderEmail || 'Anonymous')}</td>
            </tr>
            ${
              repoContext
                ? `<tr>
              <td style="padding: 6px 0; color: #71717A; font-family: monospace;">REPO CONTEXT</td>
              <td style="padding: 6px 0; color: #09090B; font-family: monospace;">${escapeHtml(repoContext)}</td>
            </tr>`
                : ''
            }
            <tr>
              <td style="padding: 6px 0; color: #71717A; font-family: monospace;">TIMESTAMP</td>
              <td style="padding: 6px 0; color: #09090B; font-family: monospace;">${timestamp}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #71717A; font-family: monospace;">SCREENSHOTS</td>
              <td style="padding: 6px 0; color: #09090B;">${files.length} attached</td>
            </tr>
          </table>

          <div style="font-family: monospace; font-size: 11px; letter-spacing: 0.06em; color: #71717A; text-transform: uppercase; margin-bottom: 8px;">Issue Description</div>
          <div style="background: #FAFAFA; border: 1px solid #E4E4E7; border-radius: 10px; padding: 16px; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(description)}</div>
        </div>
      </div>
    `;

    try {
      const transporter = getPooledTransporter(smtpUser, smtpPass);

      // Respond immediately after validation & buffering; pooled SMTP delivers in background
      res.status(200).json({
        success: true,
        message: 'Feedback delivered to contact.repolens@gmail.com',
        attachmentsCount: files.length,
      });

      transporter
        .sendMail({
          from: `"RepoLens Feedback" <${smtpUser}>`,
          to: 'contact.repolens@gmail.com',
          replyTo: senderEmail || undefined,
          subject: `[RepoLens Feedback] ${title}`,
          html,
          attachments: files.map((file) => ({
            filename: file.originalname,
            content: file.buffer,
            contentType: file.mimetype,
          })),
        })
        .catch((err: any) => {
          console.error('[feedbackRoute] Background email delivery failed:', err);
        });
    } catch (err: any) {
      console.error('[feedbackRoute] Failed to queue email:', err);
      res.status(500).json({
        error: err?.message || 'Failed to deliver feedback email. Please try the direct mailto link.',
      });
    }
  });
});

