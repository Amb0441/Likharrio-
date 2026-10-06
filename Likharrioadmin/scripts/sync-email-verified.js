/**
 * Safely sync emailVerified from Firebase Auth → Firestore users
 * Uses merge: true so it ONLY touches the emailVerified field.
 * No other fields are modified.
 *
 * Usage: node scripts/sync-email-verified.js
 */

const admin = require('firebase-admin');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
const PROJECT_ID = 'likharrio-82864';

function initFirebase() {
  try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK.');
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function main() {
  console.log('\n🔍 Syncing emailVerified from Auth → Firestore (safe mode)\n');
  initFirebase();

  const authUsers = {};
  let pageToken;
  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    result.users.forEach(u => { authUsers[u.uid] = u.emailVerified; });
    pageToken = result.pageToken;
  } while (pageToken);

  const authCount = Object.keys(authUsers).length;
  console.log(`  Found ${authCount} Auth users\n`);

  const snap = await admin.firestore().collection('users').get();
  let updated = 0;
  let skipped = 0;

  const batchSize = 500;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = admin.firestore().batch();
    const chunk = docs.slice(i, i + batchSize);

    for (const doc of chunk) {
      const uid = doc.id;
      const emailVerified = authUsers[uid];

      if (emailVerified === undefined) {
        skipped++;
        continue;
      }

      batch.set(doc.ref, { emailVerified }, { merge: true });
      updated++;
    }

    await batch.commit();
    console.log(`  Updated ${updated}/${docs.length} docs...`);
  }

  console.log(`\n✅ Done! Updated: ${updated}, Skipped (no Auth user): ${skipped}\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
