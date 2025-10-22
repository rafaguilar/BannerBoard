
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

// Function to extract ad size from meta tag or canvas
async function getAdSize(htmlPath: string): Promise<{ width: number; height: number } | null> {
    try {
        const htmlContent = await fs.readFile(htmlPath, 'utf-8');
        
        // 1. Try standard ad.size meta tag (with optional space)
        const metaMatch = htmlContent.match(/<meta\s+name=["']ad.size["']\s+content=["']width=(\d+),\s*height=(\d+)["']\s*\/?>/);
        if (metaMatch && metaMatch[1] && metaMatch[2]) {
            return {
                width: parseInt(metaMatch[1], 10),
                height: parseInt(metaMatch[2], 10),
            };
        }

        // 2. Fallback for Adobe Animate: check for authoring tool and find canvas
        const isAdobeAnimate = /<meta\s+name=["']authoring_tool["']\s+content=["']Adobe_Animate_CC["']/.test(htmlContent);
        if (isAdobeAnimate) {
            const canvasMatch = htmlContent.match(/<canvas\s+.*?width=["'](\d+)["']\s+height=["'](\d+)["']/);
             if (canvasMatch && canvasMatch[1] && canvasMatch[2]) {
                return {
                    width: parseInt(canvasMatch[1], 10),
                    height: parseInt(canvasMatch[2], 10),
                };
            }
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
          var lastReceivedAction = null;
          var timelinePollInterval;

          function findMasterTimeline() {
              var gsap = window.gsap || window.TweenLite || window.TweenMax;
              var timeline = window.TimelineLite || window.TimelineMax;

              // Do not cache the timeline instance; find it fresh each time.
              var mt = null;

              if (timeline && typeof timeline.exportRoot === 'function') {
                  mt = timeline.exportRoot();
              } else if (gsap && gsap.globalTimeline) {
                  mt = gsap.globalTimeline;
              }
              
              if (mt && !masterTimeline) {
                  // This block runs only once to fire the ready signal.
                  masterTimeline = mt;
                  clearInterval(timelinePollInterval);
                  // Pause the animation as soon as it's ready
                  masterTimeline.pause();
                  window.parent.postMessage({ action: 'bannerReady', bannerId: '%%BANNER_ID%%' }, '*');
                  if(lastReceivedAction) {
                    handleAction(lastReceivedAction.action, lastReceivedAction.bannerId, lastReceivedAction.groupId);
                    lastReceivedAction = null; // Clear after processing
                  }
              }
              return mt;
          }

          function handleAction(action, bannerId, groupId) {
              // Always get a fresh reference to the timeline.
              const mt = findMasterTimeline();

              // If timeline not ready yet, queue the action.
              if (!mt) {
                  lastReceivedAction = { action, bannerId, groupId };
                  return;
              }

              // Individual controls
              if (bannerId === '%%BANNER_ID%%') {
                  if (action === 'captureScreenshot' || action === 'captureScreenshotForAI') {
                       const eventData = window.event.data; // Need to get the data from the triggering event
                      html2canvas(document.body, {
                          allowTaint: true,
                          useCORS: true,
                          logging: false,
                          width: eventData.width,
                          height: eventData.height,
                          windowWidth: eventData.width,
                          windowHeight: eventData.height,
                      }).then(function(canvas) {
                          const dataUrl = canvas.toDataURL('image/png');
                          const responseAction = action === 'captureScreenshot' ? 'screenshotCaptured' : 'screenshotCapturedForAI';
                          window.parent.postMessage({
                              action: responseAction,
                              dataUrl: dataUrl,
                              bannerId: bannerId
                          }, '*');
                      }).catch(function(error) {
                          console.error('html2canvas error:', error);
                          window.parent.postMessage({
                              action: 'screenshotFailed',
                              error: 'html2canvas failed to execute.',
                              bannerId: bannerId
                          }, '*');
                      });
                  } else if (action === 'play') {
                        mt.play();
                        window.parent.postMessage({ action: 'playPauseSuccess', bannerId: bannerId, isPlaying: true }, '*');
                  } else if (action === 'pause') {
                        mt.pause();
                        window.parent.postMessage({ action: 'playPauseSuccess', bannerId: bannerId, isPlaying: false }, '*');
                  }
              }

              // Global controls for groups
              if (groupId && groupId === '%%GROUP_ID%%') {
                  if(action === 'global-play') {
                      mt.play();
                  } else if (action === 'global-pause') {
                      mt.pause();
                  } else if (action === 'global-restart') {
                      mt.play(0);
                  }
              }
          }

          window.addEventListener('message', function(event) {
              if (!event.data || !event.data.action) return;
              handleAction(event.data.action, event.data.bannerId, event.data.groupId);
          });
          
           window.addEventListener('load', function() {
                // Start polling for the master timeline
                timelinePollInterval = setInterval(findMasterTimeline, 100);
            }, false);

        };
        document.head.appendChild(script);
      })();
    <\/script>
`;

async function injectScreenshotScript(htmlPath: string, bannerId: string, groupId: string): Promise<void> {
    try {
        let htmlContent = await fs.readFile(htmlPath, 'utf-8');
        const finalScript = INJECTED_SCRIPT.replace(/%%BANNER_ID%%/g, bannerId).replace(/%%GROUP_ID%%/g, groupId);
        htmlContent = htmlContent.replace('</head>', `${finalScript}</head>`);
        await fs.writeFile(htmlPath, htmlContent, 'utf-8');
    } catch (error) {
        console.warn('Could not inject screenshot script:', error);
    }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const groupId = formData.get('groupId') as string | null;

    if (!file || !groupId) {
      return NextResponse.json({ error: 'Missing file or group ID' }, { status: 400 });
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
        return NextResponse.json({ error: 'Could not determine banner dimensions. Ensure a <meta name="ad.size"> tag or a valid canvas for Adobe Animate ads is present.' }, { status: 400 });
    }

    await injectScreenshotScript(fullHtmlPath, bannerId, groupId);

    const previewUrl = `/api/preview/${bannerId}/${htmlFile}`;

    return NextResponse.json({ 
        url: previewUrl,
        width: dimensions.width,
        height: dimensions.height,
        id: bannerId
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to process zip file' }, { status: 500 });
  }
}
