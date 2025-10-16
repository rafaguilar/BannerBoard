
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import mime from 'mime-types';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string[] } }
) {
  try {
    const [bannerId, ...filePathParts] = params.slug;
    const filePath = filePathParts.join('/');

    if (!bannerId || !filePath) {
      return new NextResponse('Invalid file path', { status: 400 });
    }

    const tempDir = path.join(os.tmpdir(), 'bannerboard-previews', bannerId);
    const absoluteFilePath = path.join(tempDir, filePath);
    
    // Security: Ensure the resolved path is within the temporary directory
    if (!absoluteFilePath.startsWith(tempDir)) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const fileContent = await fs.readFile(absoluteFilePath);
    const contentType = mime.lookup(absoluteFilePath) || 'application/octet-stream';

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return new NextResponse('File not found', { status: 404 });
    }
    console.error('File serving error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
