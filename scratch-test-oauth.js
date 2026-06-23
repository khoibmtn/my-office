require('dotenv').config({ path: '.env.local' });
const { google } = require('googleapis');
const { Readable } = require('stream');
const fs = require('fs');

async function test() {
  try {
    const creds = JSON.parse(fs.readFileSync(require('os').homedir() + '/.config/gcloud/application_default_credentials.json'));
    const oauth2Client = new google.auth.OAuth2(
      creds.client_id,
      creds.client_secret
    );
    oauth2Client.setCredentials({ refresh_token: creds.refresh_token });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const buffer = Buffer.from('Hello world test file');
    const media = { mimeType: 'text/plain', body: Readable.from(buffer) };
    
    console.log("Attempting to upload...");
    const created = await drive.files.create({
      requestBody: { name: 'test_oauth_upload.txt', parents: [process.env.DRIVE_FOLDER_ID] },
      media: media,
      fields: 'id',
    });
    console.log("SUCCESS! File ID:", created.data.id);
  } catch (e) {
    console.error("ERROR:", e.message);
  }
}
test();
