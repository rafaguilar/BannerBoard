
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';

// Function to find the main HTML file
async function findHtmlFile(dir: string): Promise<string | null> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    // Prioritize index.html
    const indexFile = entries.find(e => e.isFile() && e.name === 'index.html');
    if (indexFile) return indexFile.name;

    // Look for any .html file
    const anyHtmlFile = entries.find(e => e.isFile() && /\.html?$/.test(e.name));
    if (anyHtmlFile) return anyHtmlFile.name;

    // Look in subdirectories (one level deep)
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const subDirPath = path.join(dir, entry.name);
            const subEntries = await fs.readdir(subDirPath, { withFileTypes: true });
            const htmlInSubDir = subEntries.find(e => e.isFile() && /\.html?$/.test(e.name));
            if (htmlInSubDir) {
                return path.join(entry.name, htmlInSubDir.name);
            }
        }
    }

    return null;
}

// Function to extract ad size from meta tag
async function getAdSize(htmlPath: string): Promise<{ width: number; height: number } | null> {
    try {
        const htmlContent = await fs.readFile(htmlPath, 'utf-8');
        const match = htmlContent.match(/<meta\s+name=["']ad.size["']\s+content=["']width=(\d+),height=(\d+)["']\s*\/?>/);
        if (match && match[1] && match[2]) {
            return {
                width: parseInt(match[1], 10),
                height: parseInt(match[2], 10),
            };
        }
        return null;
    } catch (error) {
        console.warn('Could not read HTML to determine size:', error);
        return null;
    }
}

const INJECTED_SCRIPT = `
    <script>
      (function() {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.crossOrigin = "anonymous";
        script.referrerPolicy = "no-referrer";
        script.onload = function() {
          var masterTimeline;

          window.addEventListener('message', function(event) {
              if (event.data && event.data.action === 'captureScreenshot') {
                  html2canvas(document.body, {
                      allowTaint: true,
                      useCORS: true,
                      logging: false,
                      width: event.data.width,
                      height: event.data.height,
                      windowWidth: event.data.width,
                      windowHeight: event.data.height,
                  }).then(function(canvas) {
                      const dataUrl = canvas.toDataURL('image/png');
                      window.parent.postMessage({
                          action: 'screenshotCaptured',
                          dataUrl: dataUrl,
                          bannerId: event.data.bannerId
                      }, '*');
                  }).catch(function(error) {
                      console.error('html2canvas error:', error);
                      window.parent.postMessage({
                          action: 'screenshotFailed',
                          error: 'html2canvas failed to execute.',
                          bannerId: event.data.bannerId
                      }, '*');
                  });
              } else if (event.data && event.data.action === 'play') {
                  if (masterTimeline) {
                    masterTimeline.resume();
                  } else if (typeof window.play === 'function') {
                    window.play();
                  } else if (window.timeline && typeof window.timeline.play === 'function') {
                    window.timeline.play();
                  }
              } else if (event.data && event.data.action === 'pause') {
                  var gsap = window.gsap || window.TweenLite || window.TweenMax;
                  var timeline = window.TimelineLite || window.TimelineMax;

                  if (timeline && typeof timeline.exportRoot === 'function') {
                    masterTimeline = timeline.exportRoot();
                    masterTimeline.pause();
                  } else if (gsap && gsap.globalTimeline) {
                    masterTimeline = gsap.globalTimeline;
                    masterTimeline.pause();
                  } else if (typeof window.pause === 'function') {
                    window.pause();
                  } else if (window.timeline && typeof window.timeline.pause === 'function') {
                    window.timeline.pause();
                  }
              }
          });
        };
        document.head.appendChild(script);
      })();
    <\/script>
`;

async function injectScreenshotScript(htmlPath: string): Promise<void> {
    try {
        let htmlContent = await fs.readFile(htmlPath, 'utf-8');
        htmlContent = htmlContent.replace('</head>', `${INJECTED_SCRIPT}</head>`);
        await fs.writeFile(htmlPath, htmlContent, 'utf-8');
    } catch (error) {
        console.warn('Could not inject screenshot script:', error);
    }
}

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

    const htmlFile = await findHtmlFile(tempDir);

    if (!htmlFile) {
        return NextResponse.json({ error: 'No HTML file found in the zip archive' }, { status: 400 });
    }

    const fullHtmlPath = path.join(tempDir, htmlFile);
    const dimensions = await getAdSize(fullHtmlPath);

    if (!dimensions) {
        return NextResponse.json({ error: 'Could not determine banner dimensions from <meta name="ad.size"> tag.' }, { status: 400 });
    }

    await injectScreenshotScript(fullHtmlPath);

    const previewUrl = `/api/preview/${bannerId}/${htmlFile}`;

    return NextResponse.json({ 
        url: previewUrl,
        width: dimensions.width,
        height: dimensions.height,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to process zip file' }, { status: 500 });
  }
}
