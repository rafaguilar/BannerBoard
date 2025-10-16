
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bannerId = uuidv4();
    const tempDir = path.join(os.tmpdir(), 'bannerboard-previews', bannerId);
    await fs.mkdir(tempDir, { recursive: true });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    const zip = new AdmZip(fileBuffer);
    zip.extractAllTo(tempDir, true);

    const manifest = {
      id: bannerId,
      path: tempDir,
      timestamp: Date.now(),
    };
    
    let htmlFile = 'index.html';
    const entries = await fs.readdir(tempDir);
    const htmlEntry = entries.find(e => e.match(/\.html?$/i) && !e.startsWith('__MACOSX'));
    
    // Check if index.html is inside a subdirectory
    if (!htmlEntry) {
        for (const entry of entries) {
            const entryPath = path.join(tempDir, entry);
            if ((await fs.stat(entryPath)).isDirectory()) {
                const subEntries = await fs.readdir(entryPath);
                const subHtmlEntry = subEntries.find(e => e.match(/\.html?$/i));
                if (subHtmlEntry) {
                    htmlFile = `${entry}/${subHtmlEntry}`;
                    break;
                }
            }
        }
    } else {
        htmlFile = htmlEntry;
    }


    const previewUrl = `/api/preview/${bannerId}/${htmlFile}`;

    return NextResponse.json({ url: previewUrl });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to process zip file' }, { status: 500 });
  }
}
