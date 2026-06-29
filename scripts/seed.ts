/**
 * Dev seeder. Creates (or resets) a known test user, wipes its existing study data,
 * and inserts subjects + materials (with real text content) and a small question bank
 * so the AI-generation endpoints have something to work on. Finally signs in and
 * prints an access token + ready-to-run curl examples.
 *
 * Run with: pnpm seed
 *
 * Uses the service-role admin client (auth.admin + RLS-bypassing inserts), so it
 * needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + SUPABASE_ANON_KEY in .env.
 */
import { createClient } from '@supabase/supabase-js';
import { env } from '../src/config/env.js';
import { getSupabaseAdmin } from '../src/lib/supabase.js';

const EMAIL = process.env.SEED_EMAIL ?? 'test@studyai.dev';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';
const API_BASE = process.env.SEED_API_BASE ?? `http://localhost:${env.PORT}`;

const admin = getSupabaseAdmin();

/** Find an auth user by email, or create one. Always leaves the password = PASSWORD. */
async function findOrCreateUser(): Promise<string> {
  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const existing = list.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    console.log(`• Reusing existing user ${EMAIL} (${existing.id}) — password reset.`);
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Test Student' },
  });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');
  console.log(`• Created user ${EMAIL} (${data.user.id}).`);
  return data.user.id;
}

/** Best-effort: ensure a profiles row exists (a DB trigger may already create one). */
async function ensureProfile(userId: string): Promise<void> {
  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      full_name: 'Test Student',
      theme: 'system',
      language: 'en',
    },
    { onConflict: 'id' },
  );
  if (error) {
    console.warn(`  (profiles upsert skipped: ${error.message})`);
  }
}

type SeedMaterial = { title: string; content: string };
type SeedQuestion = {
  prompt: string;
  type: 'multiple_choice' | 'true_false';
  options: string[];
  correctAnswer: string;
};
type SeedSubject = {
  name: string;
  code: string;
  description: string;
  color: string;
  materials: SeedMaterial[];
  questions: SeedQuestion[];
};

const SUBJECTS: SeedSubject[] = [
  {
    name: 'Biology 101',
    code: 'BIO101',
    description: 'Introductory cell and molecular biology.',
    color: 'success',
    materials: [
      {
        title: 'The Cell',
        content: `The cell is the basic structural and functional unit of all living organisms.
Cells are broadly divided into two types: prokaryotic cells, which lack a membrane-bound
nucleus (such as bacteria), and eukaryotic cells, which contain a true nucleus and
membrane-bound organelles (such as plant and animal cells).

Key organelles in a eukaryotic cell include the nucleus, which stores genetic material
(DNA); the mitochondria, often called the powerhouse of the cell because they produce ATP
through cellular respiration; the ribosomes, which synthesize proteins; the endoplasmic
reticulum, which transports materials; and the Golgi apparatus, which modifies and packages
proteins. Plant cells additionally contain chloroplasts, where photosynthesis occurs, and a
rigid cell wall made of cellulose.

The cell membrane is a selectively permeable phospholipid bilayer that controls the movement
of substances in and out of the cell, maintaining homeostasis.`,
      },
      {
        title: 'Photosynthesis',
        content: `Photosynthesis is the process by which green plants, algae, and some bacteria convert
light energy into chemical energy stored in glucose. It occurs primarily in the chloroplasts,
which contain the pigment chlorophyll that absorbs sunlight.

The overall equation is: 6CO2 + 6H2O + light energy -> C6H12O6 + 6O2. The process has two main
stages. The light-dependent reactions take place in the thylakoid membranes and convert light
energy into ATP and NADPH while releasing oxygen as a byproduct of splitting water. The
light-independent reactions, known as the Calvin cycle, occur in the stroma and use ATP and
NADPH to fix carbon dioxide into glucose.

Photosynthesis is fundamental to life on Earth because it produces oxygen and forms the base of
most food chains.`,
      },
    ],
    questions: [
      {
        prompt: 'Which organelle is known as the powerhouse of the cell?',
        type: 'multiple_choice',
        options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'],
        correctAnswer: 'Mitochondria',
      },
      {
        prompt: 'Prokaryotic cells contain a membrane-bound nucleus.',
        type: 'true_false',
        options: ['True', 'False'],
        correctAnswer: 'False',
      },
      {
        prompt: 'Where does photosynthesis primarily occur in plant cells?',
        type: 'multiple_choice',
        options: ['Mitochondria', 'Chloroplast', 'Nucleus', 'Vacuole'],
        correctAnswer: 'Chloroplast',
      },
    ],
  },
  {
    name: 'World History',
    code: 'HIST210',
    description: 'Modern world history from the 18th century onward.',
    color: 'accent',
    materials: [
      {
        title: 'The Industrial Revolution',
        content: `The Industrial Revolution was a period of major industrialization and innovation that
began in Great Britain in the late 18th century and spread to the rest of the world. It marked
a shift from hand production methods to machines, new chemical manufacturing and iron production
processes, and the increasing use of steam power.

Key innovations included James Watt's improved steam engine, the spinning jenny and power loom
which transformed the textile industry, and the development of railways and canals that
revolutionized transportation. Factories concentrated production and labor in urban centers,
driving rapid urbanization as people moved from the countryside to cities for work.

The revolution had profound social consequences: it created a new industrial working class,
led to harsh working conditions and child labor, but also raised overall standards of living
over the long term and gave rise to labor movements and reforms.`,
      },
    ],
    questions: [
      {
        prompt: 'In which country did the Industrial Revolution begin?',
        type: 'multiple_choice',
        options: ['France', 'Great Britain', 'Germany', 'United States'],
        correctAnswer: 'Great Britain',
      },
      {
        prompt: 'The Industrial Revolution increased urbanization.',
        type: 'true_false',
        options: ['True', 'False'],
        correctAnswer: 'True',
      },
    ],
  },
];

async function seedData(userId: string) {
  // Wipe existing study data for this user. Deleting subjects cascades to
  // materials, questions, exams and flashcards via ON DELETE CASCADE.
  const { error: delError } = await admin.from('subjects').delete().eq('user_id', userId);
  if (delError) throw delError;

  const created: {
    subject: string;
    subjectId: string;
    materials: { title: string; id: string }[];
  }[] = [];

  for (const s of SUBJECTS) {
    const { data: subject, error: subjErr } = await admin
      .from('subjects')
      .insert({
        user_id: userId,
        name: s.name,
        code: s.code,
        description: s.description,
        color: s.color,
        progress: 0,
      })
      .select('id')
      .single();
    if (subjErr) throw subjErr;
    const subjectId = subject.id as string;

    const materialRows = s.materials.map((m) => ({
      user_id: userId,
      subject_id: subjectId,
      title: m.title,
      type: 'note' as const,
      content: m.content,
    }));
    const { data: materials, error: matErr } = await admin
      .from('materials')
      .insert(materialRows)
      .select('id, title');
    if (matErr) throw matErr;

    const questionRows = s.questions.map((q) => ({
      user_id: userId,
      subject_id: subjectId,
      prompt: q.prompt,
      type: q.type,
      options: q.options,
      correct_answer: q.correctAnswer,
    }));
    const { error: qErr } = await admin.from('questions').insert(questionRows);
    if (qErr) throw qErr;

    created.push({
      subject: s.name,
      subjectId,
      materials: (materials as { id: string; title: string }[]).map((m) => ({
        title: m.title,
        id: m.id,
      })),
    });
    console.log(
      `• Seeded "${s.name}" — ${s.materials.length} material(s), ${s.questions.length} question(s).`,
    );
  }

  return created;
}

async function getAccessToken(): Promise<string | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const { data, error } = await anon.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) {
    console.warn(`  (could not sign in for a token: ${error.message})`);
    return null;
  }
  return data.session?.access_token ?? null;
}

async function main() {
  console.log('Seeding dev data...\n');
  const userId = await findOrCreateUser();
  await ensureProfile(userId);
  const created = await seedData(userId);
  const token = await getAccessToken();

  const firstMaterialId = created[0]?.materials[0]?.id;

  console.log('\n──────────────────────────────────────────────');
  console.log('Seed complete. Login credentials:');
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log(`  user id:  ${userId}`);

  if (token) {
    console.log('\nAccess token (expires ~1h — re-run the seed to refresh):');
    console.log(token);

    console.log('\nQuick test commands:');
    console.log(`\n# List your subjects`);
    console.log(
      `curl -s ${API_BASE}/api/subjects -H "Authorization: Bearer ${token}" | jq`,
    );

    if (firstMaterialId) {
      console.log(`\n# One-shot AI processing (summary + key concepts + flashcards + questions)`);
      console.log(
        `curl -s -X POST ${API_BASE}/api/ai/process-material \\\n` +
          `  -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" \\\n` +
          `  -d '{"materialId":"${firstMaterialId}","questionCount":5,"flashcardCount":5}' | jq`,
      );
      console.log(`\n# Generate a summary from the material`);
      console.log(
        `curl -s -X POST ${API_BASE}/api/ai/summarize \\\n` +
          `  -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" \\\n` +
          `  -d '{"materialId":"${firstMaterialId}","persist":true}' | jq`,
      );
      console.log(`\n# Generate exam questions from the material`);
      console.log(
        `curl -s -X POST ${API_BASE}/api/ai/generate-questions \\\n` +
          `  -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" \\\n` +
          `  -d '{"subjectId":"${created[0]?.subjectId}","materialId":"${firstMaterialId}","count":5}' | jq`,
      );
    }
  } else {
    console.log('\n(No access token printed — sign in manually with the credentials above.)');
  }
  console.log('──────────────────────────────────────────────');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSeed failed:', err);
    process.exit(1);
  });
