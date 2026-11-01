import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1x1 Emerald PNG fallback buffer for PWA icons so browsers receive valid image/png
const EMERALD_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const EMERALD_PNG_BUFFER = Buffer.from(EMERALD_PNG_BASE64, 'base64');

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  // Serve valid PNG icons for PWA compliance
  const pngIconPaths = [
    '/pwa-192x192.png',
    '/pwa-512x512.png',
    '/pwa-maskable-512x512.png',
    '/apple-touch-icon.png',
  ];
  for (const iconPath of pngIconPaths) {
    app.get(iconPath, (_req, res) => {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(EMERALD_PNG_BUFFER);
    });
  }

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timezone: 'Asia/Dhaka' });
  });

  // Server-side Gemini endpoint: Parse Bengali/English voice transcript into structured entry proposal
  app.post('/api/gemini/parse-voice', async (req, res) => {
    try {
      const { transcript, currentDate } = req.body || {};
      if (!transcript || typeof transcript !== 'string') {
        res.status(400).json({ error: 'Transcript is required' });
        return;
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(200).json({
          fallback: true,
          error: 'AI_UNAVAILABLE',
          message: 'Server AI key not configured; using local deterministic parser.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-argon',
        contents: `Parse this Bangladesh garment worker's voice note into a structured entry proposal. Today's date is ${currentDate || '2026-10-26'}. Voice note: "${transcript}"`,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          systemInstruction:
            'You are a precise data parser for Shromik Sathi, an app for garment workers in Bangladesh. Classify the spoken Bengali or English input into one of: "overtime", "expense", "payment", "attendance", or "reminder". Extract numerical amounts, hours, categories, and a clean Bengali summary.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              entryType: {
                type: Type.STRING,
                description: 'One of: overtime, expense, payment, attendance, reminder',
              },
              date: {
                type: Type.STRING,
                description: 'YYYY-MM-DD format',
              },
              amountOrHours: {
                type: Type.NUMBER,
                description: 'Hours for overtime, or BDT amount for expense/payment',
              },
              categoryOrStatus: {
                type: Type.STRING,
                description: 'Category for expense/reminder, paymentMethod for payment, or status for attendance',
              },
              notes: {
                type: Type.STRING,
                description: 'Clean summary note in Bengali',
              },
            },
            required: ['entryType', 'date', 'amountOrHours', 'categoryOrStatus', 'notes'],
          },
        },
      });

      const text = response.text;
      if (!text) {
        res.status(200).json({ fallback: true, error: 'Empty AI response' });
        return;
      }
      res.json(JSON.parse(text.trim()));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(200).json({ fallback: true, error: 'GEMINI_FALLBACK', message });
    }
  });

  // Server-side Gemini endpoint: Complex Salary & Overtime Audit / Labor Law Query (High Thinking Mode)
  app.post('/api/gemini/analyze-records', async (req, res) => {
    try {
      const { query, contextSummary } = req.body || {};
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Query is required' });
        return;
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(200).json({
          fallback: true,
          error: 'AI_UNAVAILABLE',
          message: 'AI key not configured.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-argon',
        contents: `Worker Context: ${JSON.stringify(contextSummary || {})}\n\nWorker Question: ${query}`,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
          systemInstruction:
            'You are a knowledgeable Bangladesh Labor Act (বাংলাদেশ শ্রম আইন ২০০৬) and garment worker financial calculation advisor. Always respond in clear, respectful Bengali (unless asked in English). Explain overtime formulas ((Basic / 208) * 2), leave entitlements, and salary breakdowns clearly, and remind the worker that calculated values are personal estimates and not official factory payroll slips.',
        },
      });

      res.json({ answer: response.text || '' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(200).json({ fallback: true, error: 'GEMINI_FALLBACK', message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shromik Sathi server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
