/**
 * Firebase Auth → Firestore User Sync Script
 *
 * Finds Firebase Auth users who don't have a corresponding Firestore
 * user document and creates one for each. Also reports orphans (users
 * deleted from Auth but still in Firestore) and provides stats.
 *
 * Usage:
 *   1. Go to Firebase Console → Project Settings → Service Accounts
 *   2. Click "Generate new private key" → save as serviceAccountKey.json
 *   3. Place the file in this project root (it's in .gitignore)
 *   4. Run: npm run sync-auth
 */

const admin = require('firebase-admin');
const path = require('path');

// ── Config ──────────────────────────────────────────────────
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
    console.error('Make sure serviceAccountKey.json exists in the project root.');
    console.error('Get it from: Firebase Console → Project Settings → Service Accounts');
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// ── List all Auth users (handles pagination) ────────────────
async function listAllAuthUsers() {
  const users = [];
  let pageToken;

  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    users.push(...result.users.map(u => ({
      uid: u.uid,
      email: u.email || '',
      displayName: u.displayName || '',
      photoURL: u.photoURL || '',
      phoneNumber: u.phoneNumber || '',
      disabled: u.disabled,
      createdAt: u.metadata.creationTime,
    })));
    pageToken = result.pageToken;
    console.log(`  Fetched ${users.length} auth users so far...`);
  } while (pageToken);

  return users;
}

// ── List all Firestore user docs ────────────────────────────
async function listAllFirestoreUsers() {
  const snap = await admin.firestore().collection('users').get();
  const users = {};
  snap.docs.forEach(doc => {
    users[doc.id] = { id: doc.id, ...doc.data() };
  });
  return users;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log('\n🔍 Firebase Auth → Firestore User Sync\n');
  console.log(`Project: ${PROJECT_ID}\n`);

  initFirebase();

  // 1. Fetch all Auth users
  console.log('📋 Fetching Firebase Auth users...');
  const authUsers = await listAllAuthUsers();
  console.log(`  ✅ ${authUsers.length} auth users found.\n`);

  // 2. Fetch all Firestore user docs
  console.log('📋 Fetching Firestore user documents...');
  const fsUsers = await listAllFirestoreUsers();
  console.log(`  ✅ ${Object.keys(fsUsers).length} Firestore user docs found.\n`);

  // 3. Compare
  const authUids = new Set(authUsers.map(u => u.uid));
  const fsUids = new Set(Object.keys(fsUsers));

  // Auth users missing from Firestore
  const missingFromFs = authUsers.filter(u => !fsUids.has(u.uid));
  // Firestore docs missing from Auth (orphans)
  const orphans = Object.keys(fsUsers).filter(id => !authUids.has(id));

  console.log('═══════════════════════════════════════════');
  console.log('📊 SYNC REPORT');
  console.log('═══════════════════════════════════════════');
  console.log(`  Firebase Auth users:        ${authUsers.length}`);
  console.log(`  Firestore user documents:   ${Object.keys(fsUsers).length}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Missing from Firestore:     ${missingFromFs.length}`);
  console.log(`  Orphans (no Auth account):   ${orphans.length}`);
  console.log('═══════════════════════════════════════════\n');

  // 4. Create missing Firestore docs
  if (missingFromFs.length > 0) {
    console.log(`🚀 Creating ${missingFromFs.length} missing Firestore user documents...\n`);

    const batchSize = 500;
    let created = 0;

    for (let i = 0; i < missingFromFs.length; i += batchSize) {
      const batch = admin.firestore().batch();
      const chunk = missingFromFs.slice(i, i + batchSize);

      for (const authUser of chunk) {
        const docRef = admin.firestore().collection('users').doc(authUser.uid);
        batch.set(docRef, {
          uid: authUser.uid,
          email: authUser.email,
          displayName: authUser.displayName || authUser.email?.split('@')[0] || 'User',
          profileImage: authUser.photoURL || '',
          phoneNumber: authUser.phoneNumber || '',
          emailVerified: authUser.emailVerified || false,
          role: determineRole(authUser),
          isVerified: false,
          verified: false,
          artistStatus: 'unsubmitted',
          createdAt: authUser.createdAt
            ? admin.firestore.Timestamp.fromDate(new Date(authUser.createdAt))
            : admin.firestore.FieldValue.serverTimestamp(),
          syncedAt: admin.firestore.FieldValue.serverTimestamp(),
          syncedFromAuth: true,
        });
      }

      await batch.commit();
      created += chunk.length;
      console.log(`  Created ${created}/${missingFromFs.length} documents...`);
    }

    console.log(`\n  ✅ ${created} missing Firestore documents created.\n`);
  } else {
    console.log('✅ All Auth users have Firestore documents. Nothing to create.\n');
  }

  // 5. Report orphans
  if (orphans.length > 0) {
    console.log('⚠️  ORPHANED FIRESTORE DOCUMENTS (no corresponding Auth account):');
    console.log('   These users exist in Firestore but their Auth account was deleted.\n');
    orphans.slice(0, 20).forEach((id, i) => {
      const u = fsUsers[id];
      console.log(`   ${i + 1}. ${id} — ${u.displayName || '?'} (${u.email || 'no email'})`);
    });
    if (orphans.length > 20) {
      console.log(`   ... and ${orphans.length - 20} more`);
    }
    console.log('');
    console.log('   ⚠  These users will still show in the admin panel but cannot log in.');
    console.log('   ⚠  To delete them, use the admin panel or run the cleanup option.\n');
  } else {
    console.log('✅ No orphaned Firestore documents found.\n');
  }

  console.log('✅ Sync complete!\n');
  process.exit(0);
}

function determineRole(authUser) {
  if (authUser.email && authUser.email.endsWith('@likharrio.com')) {
    return 'enthusiast';
  }
  return 'enthusiast';
}

main().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
