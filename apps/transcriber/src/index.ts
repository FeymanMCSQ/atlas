import express, { Request, Response } from 'express';
import multer from 'multer';
import cors from 'cors';
import { resolve } from 'path';
import fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: resolve(__dirname, '../../../.env') });

import { createClient } from '@deepgram/sdk';
import { db } from '@atlas/db';
import { EventTypes } from '@atlas/domain';
import { emitEvent } from '@atlas/queue';
import { cleanTranscriptText } from './normalizer';

const app = express();
const PORT = process.env.PORT || 4000;

const deepgram = createClient(process.env.DEEPGRAM_API_KEY || '');

// Set up storage logic for Multer
const UPLOADS_DIR = resolve(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${safeOriginalName}`);
  },
});

const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json());

// ─── Routes ─────────────────────────────────────────────────────────────────

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'transcriber' });
});

/**
 * Handle audio uploads and run them through Deepgram.
 */
// Ignore specific types for the express handler to bypass typescript complaints about async void output
app.post('/upload', upload.single('audio'), async (req: any, res: any): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    console.log(`[Transcriber] Received audio file: ${file.originalname} (${file.size} bytes)`);
    console.log(`[Transcriber] Sending to Deepgram...`);

    // 1. Send to Deepgram API
    const audioBuffer = fs.readFileSync(file.path);
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-3',
        smart_format: true,
      }
    );

    if (error) {
      console.error('[Transcriber] Deepgram error:', error);
      return res.status(500).json({ error: 'Failed to transcribe audio with Deepgram.' });
    }

    let transcriptText = result?.results?.channels[0]?.alternatives[0]?.transcript || '';
    const confidence = result?.results?.channels[0]?.alternatives[0]?.confidence || 0;

    console.log(`[Transcriber] Deepgram raw processing complete (Confidence: ${confidence})`);

    // Normalize: Remove fillers and timestamps
    transcriptText = cleanTranscriptText(transcriptText);

    // 2. Save Transcript to DB
    const transcript = await db.transcript.create({
      data: {
        audioFileReference: file.filename,
        transcriptText,
        confidence,
      },
    });

    // 3. Save ContentItem to DB
    const contentItem = await db.contentItem.create({
      data: {
        source: 'transcript',
        title: `Transcription - ${file.originalname}`,
        url: `transcript://${transcript.id}`,
        sourceData: { transcriptId: transcript.id, confidence, originalName: file.originalname },
      },
    });
    console.log(`[Transcriber] Saved Transcript ${transcript.id} and ContentItem ${contentItem.id}`);

    // 4. Emit the content.transcribed Event
    await emitEvent(EventTypes.CONTENT_TRANSCRIBED, {
      contentItemId: contentItem.id,
      transcriptId: transcript.id,
      timestamp: new Date().toISOString(),
    });
    console.log(`[Transcriber] Emitted ${EventTypes.CONTENT_TRANSCRIBED} event to the queue.`);

    // 5. Respond
    res.status(200).json({
      message: 'Audio file transcribed and stored successfully.',
      transcriptId: transcript.id,
      contentItemId: contentItem.id,
      text: transcriptText,
    });
  } catch (error: any) {
    console.error('[Transcriber] Upload error:', error);
    res.status(500).json({ error: 'Failed to process audio upload.' });
  }
});

// ─── Initialization ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[Transcriber] 🚀 Audio Intake Server running on http://localhost:${PORT}`);
});
