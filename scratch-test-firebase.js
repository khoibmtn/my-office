require('dotenv').config({ path: '.env.local' });
const token = "dummy";
fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken: token })
}).then(res => res.json()).then(console.log);
