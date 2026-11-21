import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NO_CACHE_EXACT_PATHS = new Set([
  '/',
  '/index.html',
  '/sw.js',
  '/alarm-sw-helper.js',
  '/manifest.webmanifest',
]);

function resolveStaticCachePolicy(urlPath: string): 'no-cache' | 'immutable' | 'default' {
  const cleanPath = (urlPath || '/').split('?')[0].split('#')[0].trim() || '/';
  if (NO_CACHE_EXACT_PATHS.has(cleanPath)) {
    return 'no-cache';
  }
  if (cleanPath.startsWith('/assets/')) {
    return 'immutable';
  }
  return 'default';
}

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
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '8mb' }));

  // Serve real compressed PNG icons from dist/ or public/ (fallback to 1x1 PNG only if missing)
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
      const fileName = iconPath.replace(/^\//, '');
      const distCandidate = path.join(__dirname, 'dist', fileName);
      const publicCandidate = path.join(__dirname, 'public', fileName);
      if (fs.existsSync(distCandidate)) {
        res.sendFile(distCandidate);
        return;
      }
      if (fs.existsSync(publicCandidate)) {
        res.sendFile(publicCandidate);
        return;
      }
      res.send(EMERALD_PNG_BUFFER);
    });
  }

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timezone: 'Asia/Dhaka' });
  });

  // Server-side Gemini Vision endpoint: Parse Bangladesh garment worker payslip photo into structured fields
  app.post('/api/gemini/parse-payslip', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body || {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'IMAGE_REQUIRED' });
        return;
      }

      const safeMime =
        typeof mimeType === 'string' && /^image\/(jpeg|jpg|png|webp)$/i.test(mimeType)
          ? mimeType
          : 'image/jpeg';

      // Strip optional data URI prefix
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
      if (!cleanBase64 || cleanBase64.length < 100) {
        res.status(400).json({ error: 'INVALID_IMAGE' });
        return;
      }

      const ai = getGenAIClient();
      if (!ai) {
        res.status(200).json({
          ok: false,
          error: 'AI_UNAVAILABLE',
          messageBn: 'স্বয়ংক্রিয় ছবি পড়া এখন উপলব্ধ নয়। নিচে পে-স্লিপের সংখ্যাগুলো হাতে লিখে যাচাই করুন।',
          messageEn: 'Automatic photo reading is currently unavailable. Please enter the payslip numbers manually below.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: safeMime,
                  data: cleanBase64,
                },
              },
              {
                text: 'Extract all visible salary payslip numbers from this Bangladesh garment factory payslip image. Convert Bengali numerals to standard numbers. If this image is NOT a payslip or is too blurry to read any numbers, set isPayslip=false. For any field not clearly visible, return null — NEVER guess or invent values.',
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            'You are an accurate OCR extractor for Bangladesh garment factory salary payslips (in Bengali or English). Never guess missing numbers; return null for unreadable or absent fields.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isPayslip: { type: Type.BOOLEAN },
              grossSalary: { type: Type.NUMBER, nullable: true },
              basicSalary: { type: Type.NUMBER, nullable: true },
              houseRentAllowance: { type: Type.NUMBER, nullable: true },
              medicalAllowance: { type: Type.NUMBER, nullable: true },
              transportAllowance: { type: Type.NUMBER, nullable: true },
              foodAllowance: { type: Type.NUMBER, nullable: true },
              presentDays: { type: Type.NUMBER, nullable: true },
              absentDays: { type: Type.NUMBER, nullable: true },
              otHours: { type: Type.NUMBER, nullable: true },
              otAmount: { type: Type.NUMBER, nullable: true },
              attendanceBonus: { type: Type.NUMBER, nullable: true },
              otherAllowances: { type: Type.NUMBER, nullable: true },
              advanceDeduction: { type: Type.NUMBER, nullable: true },
              absentDeduction: { type: Type.NUMBER, nullable: true },
              otherDeductions: { type: Type.NUMBER, nullable: true },
              netPayable: { type: Type.NUMBER, nullable: true },
            },
            required: ['isPayslip'],
          },
        },
      });

      const text = response.text?.trim();
      if (!text) {
        res.status(200).json({
          ok: false,
          error: 'UNREADABLE',
          messageBn: 'ছবি থেকে সংখ্যা পড়া যায়নি। পরিষ্কার ছবি তুলুন অথবা হাতে সংখ্যা লিখুন।',
          messageEn: 'Could not read numbers from the image. Try a clearer photo or enter manually.',
        });
        return;
      }

      const parsedRaw = JSON.parse(text);
      if (!parsedRaw.isPayslip) {
        res.status(200).json({
          ok: false,
          error: 'NOT_A_PAYSLIP',
          messageBn: 'ছবিটি পে-স্লিপ মনে হচ্ছে না বা ঝাপসা। পরিষ্কার পে-স্লিপের ছবি দিন অথবা হাতে লিখুন।',
          messageEn: 'This image does not look like a readable payslip. Upload a clearer photo or enter numbers manually.',
        });
        return;
      }

      const toNumOrNull = (val: unknown): number | null => {
        if (val === null || val === undefined || val === '') return null;
        const n = Number(val);
        return Number.isFinite(n) && n >= 0 ? n : null;
      };

      res.json({
        ok: true,
        parsed: {
          grossSalary: toNumOrNull(parsedRaw.grossSalary),
          basicSalary: toNumOrNull(parsedRaw.basicSalary),
          houseRentAllowance: toNumOrNull(parsedRaw.houseRentAllowance),
          medicalAllowance: toNumOrNull(parsedRaw.medicalAllowance),
          transportAllowance: toNumOrNull(parsedRaw.transportAllowance),
          foodAllowance: toNumOrNull(parsedRaw.foodAllowance),
          presentDays: toNumOrNull(parsedRaw.presentDays),
          absentDays: toNumOrNull(parsedRaw.absentDays),
          otHours: toNumOrNull(parsedRaw.otHours),
          otAmount: toNumOrNull(parsedRaw.otAmount),
          attendanceBonus: toNumOrNull(parsedRaw.attendanceBonus),
          otherAllowances: toNumOrNull(parsedRaw.otherAllowances),
          advanceDeduction: toNumOrNull(parsedRaw.advanceDeduction),
          absentDeduction: toNumOrNull(parsedRaw.absentDeduction),
          otherDeductions: toNumOrNull(parsedRaw.otherDeductions),
          netPayable: toNumOrNull(parsedRaw.netPayable),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(200).json({
        ok: false,
        error: 'OCR_ERROR',
        messageBn: 'ছবি বিশ্লেষণে সমস্যা হয়েছে। নিচে হাতে সংখ্যা লিখে যাচাই করতে পারেন।',
        messageEn: 'Failed to analyze image. You can enter the numbers manually below.',
        detail: message,
      });
    }
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
        model: 'gemini-4-hydrogen',
        contents: `Parse this Bangladesh garment worker's voice note into a structured entry proposal. Today's date is ${currentDate || '2026-10-26'}. Voice note: "${transcript}"`,
        config: {
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

  // Server-side Gemini endpoint: Complex Salary & Overtime Audit / Labor Law Query
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
        model: 'gemini-4-hydrogen',
        contents: `Worker Context: ${JSON.stringify(contextSummary || {})}\n\nWorker Question: ${query}`,
        config: {
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
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          const relPath = '/' + path.relative(distPath, filePath).replace(/\\/g, '/');
          const policy = resolveStaticCachePolicy(relPath);
          if (policy === 'no-cache') {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (policy === 'immutable') {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shromik Sathi server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
