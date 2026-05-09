import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';
import fs from 'node:fs/promises';
import path from 'node:path';

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(process.cwd(), 'records.json');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

async function readDb() {
  try {
    return JSON.parse(await fs.readFile(DB_PATH, 'utf8'));
  } catch {
    return [];
  }
}

async function writeDb(records) {
  await fs.writeFile(DB_PATH, JSON.stringify(records, null, 2));
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'femvault-backend' });
});

app.post('/records', async (req, res) => {
  const { ownerWallet, encryptedPayload } = req.body;

  if (!ownerWallet || !encryptedPayload?.ciphertext || !encryptedPayload?.iv || !encryptedPayload?.salt) {
    return res.status(400).json({ error: 'ownerWallet and encryptedPayload are required' });
  }

  const records = await readDb();
  const record = {
    id: nanoid(10),
    ownerWallet,
    encryptedPayload,
    createdAt: new Date().toISOString()
  };

  records.push(record);
  await writeDb(records);

  res.status(201).json(record);
});

app.get('/records/:id', async (req, res) => {
  const records = await readDb();
  const record = records.find((item) => item.id === req.params.id);

  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }

  res.json(record);
});

app.listen(PORT, () => {
  console.log(`FemVault backend running on http://localhost:${PORT}`);
});
