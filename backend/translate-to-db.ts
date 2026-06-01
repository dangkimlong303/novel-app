/**
 * Translate chapters EN → VI and save to DB (content_vi column).
 * Usage: GEMINI_API_KEY=... npx ts-node translate-to-db.ts <start> <end>
 * Example: GEMINI_API_KEY=... npx ts-node translate-to-db.ts 2099 2109
 *
 * - Title stays in English (Option A).
 * - Uses Gemini 2.5 Flash Lite (free tier).
 * - Skips chapters that already have content_vi.
 * - Passes last paragraph of previous chapter as context for consistency.
 */
import { PrismaClient } from '@prisma/client';

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error('Set GEMINI_API_KEY'); process.exit(1); }

const start = parseInt(process.argv[2] || '0', 10);
const end = parseInt(process.argv[3] || '0', 10);
if (!start || !end || start > end) {
  console.error('Usage: translate-to-db.ts <start> <end>');
  process.exit(1);
}

const MODEL = 'gemini-2.5-flash';
const prisma = new PrismaClient();

const GLOSSARY = [
  'Sunny', 'Sunless', 'Rain', 'Nephis', 'Cassie', 'Effie', 'Kai', 'Jet', 'Mordret', 'Lia', 'Doran', 'Cassia',
  'Bastion', 'Outskirts', 'Dream Realm', 'Hungering Dark', 'Antarctic Citadel',
  'Nightmare Spell', 'Awakened', 'Aspect', 'Memory', 'Echo', 'Aspect Ability',
  'Attribute', 'Nightmare Creature', 'Sleeper', 'Saint', 'Champion',
  'Mistress of the Tower', 'Master of the Tower', 'Shadow', 'Soul Core',
  'First Nightmare', 'Trial', 'Aspirant', 'Spell',
];

function buildPrompt(previousContext: string | null): string {
  return `You are a professional literary translator specializing in fantasy web novels.
Translate the following English novel chapter (Shadow Slave by Guiltythree) to Vietnamese.

CRITICAL RULE #1 — PROPER NOUNS MUST STAY IN ENGLISH:

You MUST keep ALL of the following in English. Do NOT translate. Do NOT transliterate.

a) Any word starting with a CAPITAL LETTER (other than sentence-start) is likely a proper noun → KEEP IN ENGLISH.

b) Specifically keep in English:
   - Character names (e.g., Sunny, Nephis, ANY personal name)
   - Place names (e.g., Bastion, Dream Realm, ANY location)
   - Skill / ability / spell names (e.g., Star Sword Dance, Shadow Step)
   - Item / artifact names (e.g., Shadow Sword, Soul Core)
   - Title / rank / class (e.g., Awakened, Sleeper, Saint, Master of the Tower)
   - Organization / faction (e.g., Cloud Kingdom, Spires)
   - System terms (e.g., Nightmare Spell, Aspect, Memory, Echo, Trial, Attribute)
   - Epithets and character titles (e.g., Mountain King, Sovereign of Shadows)

c) Confirmed glossary (never translate):
${GLOSSARY.map((g) => `   - ${g}`).join('\n')}

d) When uncertain → KEEP IN ENGLISH.

CONSISTENCY RULES:
- Sunny (main character, young male) → narration uses "cậu" / "anh"
- Nephis (young female) → "cô" / "nàng"
- Maintain the same Vietnamese term for recurring concepts across chapters

OTHER RULES:
1. Translate idiomatically — natural literary Vietnamese, NOT word-by-word.
2. Preserve paragraph structure (one VN paragraph per EN paragraph).
3. Keep dialogue quotes "..." formatting.
4. Maintain dark fantasy tone, occasionally humorous.
5. Do NOT use archaic Wuxia language ("ta", "ngươi", "tỷ tỷ", "ca ca") unless dialogue clearly calls for it.
6. Output ONLY the Vietnamese translation. No commentary, no explanations.
7. Do not skip or summarize content.

${previousContext ? `PREVIOUS CHAPTER CONTEXT (for consistency only, do NOT translate this):\n---\n${previousContext}\n---\n` : ''}`;
}

async function translate(englishContent: string, previousContext: string | null): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
  const body = {
    systemInstruction: { parts: [{ text: buildPrompt(previousContext) }] },
    contents: [{ parts: [{ text: englishContent }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 32768 },
  };

  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error(`No translation: ${JSON.stringify(data).substring(0, 500)}`);
      return text.trim();
    }

    if (res.status === 503 || res.status === 429) {
      const wait = 10000 * attempt;
      console.log(`  ${res.status} — retry in ${wait / 1000}s (attempt ${attempt}/5)`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }
  throw new Error('Max retries exceeded');
}

async function main() {
  console.log(`Translating chapters ${start}-${end}...`);
  let previousVi: string | null = null;

  for (let num = start; num <= end; num++) {
    const chapter = await prisma.chapter.findUnique({ where: { chapter_number: num } });
    if (!chapter) {
      console.log(`Ch.${num}: not found in DB, skipping`);
      continue;
    }
    if (chapter.content_vi) {
      console.log(`Ch.${num}: already translated, using as context for next`);
      // Keep last 1000 chars as context for next chapter
      previousVi = chapter.content_vi.split('\n\n').slice(-2).join('\n\n').substring(0, 1500);
      continue;
    }

    console.log(`\nCh.${num}: "${chapter.title}" — ${chapter.content.length} chars EN`);
    const startTime = Date.now();
    const contentVi = await translate(chapter.content, previousVi);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  → ${contentVi.length} chars VI in ${elapsed}s`);

    await prisma.chapter.update({
      where: { chapter_number: num },
      data: { content_vi: contentVi },
    });
    console.log(`  ✓ Saved to DB`);

    // Keep last paragraphs as context for next chapter
    previousVi = contentVi.split('\n\n').slice(-2).join('\n\n').substring(0, 1500);
  }

  console.log('\nDone!');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERROR:', e);
  await prisma.$disconnect();
  process.exit(1);
});
