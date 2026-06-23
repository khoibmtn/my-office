import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { Readable } from 'stream'
import * as fs from 'fs'
import * as os from 'os'

export async function GET() {
  try {
    const creds = JSON.parse(fs.readFileSync(os.homedir() + '/.config/gcloud/application_default_credentials.json', 'utf8'));
    const oauth2Client = new google.auth.OAuth2(
      creds.client_id,
      creds.client_secret
    );
    oauth2Client.setCredentials({ refresh_token: creds.refresh_token });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const buffer = Buffer.from('Hello world test file');
    const media = { mimeType: 'text/plain', body: Readable.from(buffer) };
    
    const created = await drive.files.create({
      requestBody: { name: 'test_oauth_upload.txt', parents: [process.env.DRIVE_FOLDER_ID!] },
      media: media,
      fields: 'id',
    });
    return NextResponse.json({ success: true, id: created.data.id })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message })
  }
}
