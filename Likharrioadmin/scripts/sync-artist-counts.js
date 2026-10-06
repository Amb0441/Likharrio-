/**
 * Sync portfolioCount & listingsCount onto artist user documents.
 * Uses merge: true — only touches these two fields.
 *
 * Usage: node scripts/sync-artist-counts.js
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
  console.log('\n📊 Syncing portfolioCount & listingsCount to artist users\n');
  initFirebase();

  const db = admin.firestore();

  // 1) Load all portfolios and listings
  const [portSnap, listSnap] = await Promise.all([
    db.collection('portfolios').get(),
    db.collection('listings').get(),
  ]);

  console.log(`  Portfolios: ${portSnap.size}`);
  console.log(`  Listings:   ${listSnap.size}\n`);

  // 2) Count per artistId
  const counts = {}; // { [artistId]: { portfolioCount, listingsCount } }

  portSnap.forEach(doc => {
    const artistId = doc.data().artistId;
    if (!artistId) return;
    if (!counts[artistId]) counts[artistId] = { portfolioCount: 0, listingsCount: 0 };
    counts[artistId].portfolioCount++;
  });

  listSnap.forEach(doc => {
    const artistId = doc.data().artistId;
    if (!artistId) return;
    if (!counts[artistId]) counts[artistId] = { portfolioCount: 0, listingsCount: 0 };
    counts[artistId].listingsCount++;
  });

  const artistIds = Object.keys(counts);
  console.log(`  Artists with data: ${artistIds.length}\n`);

  if (artistIds.length === 0) {
    console.log('  Nothing to update.\n');
    process.exit(0);
  }

  // 3) Batch update artist user docs
  let updated = 0;
  const batchSize = 500;

  for (let i = 0; i < artistIds.length; i += batchSize) {
    const batch = db.batch();
    const chunk = artistIds.slice(i, i + batchSize);

    for (const artistId of chunk) {
      const ref = db.collection('users').doc(artistId);
      batch.set(ref, counts[artistId], { merge: true });
      updated++;
    }

    await batch.commit();
    console.log(`  Updated ${updated}/${artistIds.length}...`);
  }

  console.log(`\n✅ Done! Updated ${updated} artist users with portfolioCount & listingsCount.\n`);
  process.exit(0);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
