require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const { Readable } = require('stream');

async function test() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });
    const buffer = Buffer.from('Hello world test file');
    const media = {
      mimeType: 'text/plain',
      body: Readable.from(buffer),
    };
    console.log("Attempting to upload to", process.env.DRIVE_FOLDER_ID);
    const created = await drive.files.create({
      requestBody: { name: 'test_upload.txt', parents: [process.env.DRIVE_FOLDER_ID] },
      media: media,
      fields: 'id',
    });
    console.log("SUCCESS! File ID:", created.data.id);
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
test();
