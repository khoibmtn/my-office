require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert } = require('firebase-admin/app');
const { getStorage } = require('firebase-admin/storage');

const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY);
initializeApp({
  credential: cert(serviceAccount),
  storageBucket: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`
});

async function test() {
  try {
    const bucket = getStorage().bucket();
    const file = bucket.file('test.txt');
    await file.save('Hello World', { contentType: 'text/plain' });
    const [url] = await file.getSignedUrl({ action: 'read', expires: '01-01-2030' });
    console.log("SUCCESS:", url);
    await file.delete();
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
test();
