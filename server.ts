import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { requireAdminAuth } from './server/firebaseAuthVerify.ts';
import {
  fetchAndScoreLiveNews,
  generateDraftWithGemini,
} from './server/liveNewsCore.ts';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/live-news', requireAdminAuth, async (req, res) => {
    const force = req.query.force === '1' || req.query.force === 'true';
    try {
      const payload = await fetchAndScoreLiveNews({ force });
      res.json(payload);
    } catch (err) {
      console.error('Failed to serve /api/live-news:', err);
      res.status(502).json({
        error: 'تعذر جلب الأخبار المباشرة من المصادر حالياً. يرجى المحاولة بعد قليل.',
      });
    }
  });

  app.post('/api/generate-draft', requireAdminAuth, async (req, res) => {
    const body = (req.body || {}) as {
      story?: {
        story_id?: string;
        title?: string;
        link?: string;
        summary?: string;
        legal_angle?: string;
        category?: string;
        source_name?: string;
      };
      draftType?: string;
    };

    const draftType = body.draftType === 'post' || body.draftType === 'script' ? body.draftType : null;
    const rawTitle = typeof body.story?.title === 'string' ? body.story.title.trim() : '';

    if (!draftType || !rawTitle) {
      res.status(400).json({
        error: 'بيانات الخبر أو نوع المحتوى غير مكتملة.',
      });
      return;
    }

    try {
      const draft = await generateDraftWithGemini({
        draftType,
        story: {
          story_id: typeof body.story?.story_id === 'string' ? body.story.story_id : undefined,
          title: rawTitle.slice(0, 500),
          link: typeof body.story?.link === 'string' ? body.story.link.slice(0, 2000) : undefined,
          summary:
            typeof body.story?.summary === 'string' ? body.story.summary.slice(0, 2000) : undefined,
          legal_angle:
            typeof body.story?.legal_angle === 'string'
              ? body.story.legal_angle.slice(0, 2000)
              : undefined,
          category:
            typeof body.story?.category === 'string' ? body.story.category.slice(0, 100) : undefined,
          source_name:
            typeof body.story?.source_name === 'string'
              ? body.story.source_name.slice(0, 200)
              : undefined,
        },
      });
      res.json(draft);
    } catch (err) {
      const anyErr = err as { status?: number; message?: string };
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'MISSING_GEMINI_KEY') {
        res.status(503).json({
          error: 'مفتاح GEMINI_API_KEY غير مُعد على الخادم لتوليد المسودات.',
        });
        return;
      }
      const statusTag = anyErr?.status ? ` (${anyErr.status})` : '';
      console.error(`Failed to generate draft with Gemini${statusTag}:`, msg);
      res.status(502).json({
        error: 'تعذر توليد المسودة عبر Gemini حالياً. يرجى المحاولة مرة أخرى.',
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
}

void startServer();
