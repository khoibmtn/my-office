require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY);
if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}

async function test() {
  const db = getFirestore();
  const snapshot = await db.collection('documents').limit(34).get();
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, data.mainFileUrl ? data.mainFileUrl.substring(0, 40) : 'NO URL');
  });
}
test();
