import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { folderId: process.env.DRIVE_FOLDER_ID },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  )
}
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  })
}
