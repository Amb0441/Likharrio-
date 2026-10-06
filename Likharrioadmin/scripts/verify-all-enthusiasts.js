/**
 * Set emailVerified = true for all enthusiast users in Firestore.
 * Uses merge: true — only touches emailVerified, no other fields.
 *
 * Usage: node scripts/verify-all-enthusiasts.js
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
  console.log('\n✅ Setting emailVerified = true for all enthusiasts\n');
  initFirebase();

  const snap = await admin.firestore().collection('users')
    .where('role', '==', 'enthusiast')
    .get();

  console.log(`  Found ${snap.size} enthusiast users\n`);

  if (snap.size === 0) {
    console.log('  Nothing to update.\n');
    process.exit(0);
  }

  let updated = 0;
  const batchSize = 500;
  const docs = snap.docs;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = admin.firestore().batch();
    const chunk = docs.slice(i, i + batchSize);

    for (const doc of chunk) {
      batch.set(doc.ref, { emailVerified: true }, { merge: true });
      updated++;
    }

    await batch.commit();
    console.log(`  Updated ${updated}/${docs.length}...`);
  }

  console.log(`\n✅ Done! Updated ${updated} enthusiast users.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
