import 'dotenv/config';
import { google } from 'googleapis';

async function test() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    console.log(token.token ? 'Token acquired' : 'No token');

    const folderId = process.env.DRIVE_FOLDER_ID;
    
    // Create Resumable Upload Session
    const res = await client.request({
      url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      method: 'POST',
      headers: {
        'X-Upload-Content-Type': 'application/pdf',
      },
      data: {
        name: 'Test-Resumable.pdf',
        parents: [folderId]
      }
    });

    console.log('Status:', res.status);
    console.log('Location:', res.headers.location);
  } catch(e) {
    console.error(e);
  }
}
test();
