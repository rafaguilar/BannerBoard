
"use client";

import React, { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  Trash2,
  Camera,
  Expand,
  Loader,
  AlertTriangle,
} from "lucide-react";
import type { Banner } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface BannerCardProps {
  banner: Banner;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (banner: Banner) => void;
}

export function BannerCard({
  banner,
  isSelected,
  onToggleSelection,
  onRemove,
}: BannerCardProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: banner.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };
  
  const isDataUrl = banner.url.startsWith('data:');

  const handleReload = () => {
    if (iframeRef.current) {
      console.log(`Reloading banner: ${banner.id}`);
      setIsLoading(true);
      setIsError(false);
      // Using a key to force re-mount is cleaner, but changing src also works.
      // Set to blank first to ensure it fully reloads from the new src.
      iframeRef.current.src = "about:blank";
      setTimeout(() => {
        if(iframeRef.current) {
          console.log(`Setting src for banner ${banner.id}`);
          iframeRef.current.src = banner.url;
        }
      }, 50);
    }
  };

  const handleScreenshot = async () => {
    if (cardRef.current) {
      try {
        const canvas = await html2canvas(cardRef.current, {
          allowTaint: true,
          useCORS: true,
          logging: false,
          onclone: (doc) => {
            const iframe = doc.querySelector('iframe');
            if (iframe) {
              try {
                // This approach has limitations due to cross-origin policies
                // For same-origin or data URLs, it might work.
                const iframeContentDoc = iframe.contentDocument;
                 if (iframeContentDoc) {
                    const newDiv = doc.createElement('div');
                    newDiv.style.width = `${banner.width}px`;
                    newDiv.style.height = `${banner.height}px`;
                    newDiv.style.overflow = 'hidden';
                    newDiv.innerHTML = iframeContentDoc.body.innerHTML;
                    // Attempt to copy styles
                     const style = doc.createElement('style');
                     style.textContent = Array.from(iframeContentDoc.styleSheets).map(s => {
                       try {
                         return Array.from(s.cssRules).map(r => r.cssText).join('\n');
                       } catch (e) {
                         return '';
                       }
                     }).join('\n');
                     newDiv.appendChild(style);
                    iframe.replaceWith(newDiv);
                 }
              } catch (e) {
                 console.error("Could not access iframe content for screenshot:", e);
              }
            }
          }
        });
        canvas.toBlob((blob) => {
          if (blob) {
            saveAs(blob, `banner_${banner.round}_${banner.version}_${banner.width}x${banner.height}.png`);
          }
        });
        toast({ title: "Screenshot captured!" });
      } catch (error) {
        console.error("Screenshot failed:", error);
        toast({
          variant: "destructive",
          title: "Screenshot Failed",
          description: "Could not capture screenshot. The banner might be from an external domain or have content restrictions.",
        });
      }
    }
  };
  
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    
    console.log(`Setting up listeners for banner: ${banner.id}`);

    const handleLoad = () => {
      console.log(`Banner ${banner.id} finished loading.`);
      setIsLoading(false);
      setIsError(false);
    };

    const handleError = (e: ErrorEvent) => {
      console.error(`Banner ${banner.id} failed to load.`, e);
      setIsLoading(false);
      setIsError(true);
    };

    const timeoutId = setTimeout(() => {
        if (isLoading && !isDataUrl) { // Only timeout remote URLs
            console.warn(`Banner ${banner.id} timed out.`);
            handleError(new ErrorEvent('timeout', { message: 'Banner loading timed out' }));
        }
    }, 10000); // 10s timeout

    iframe.addEventListener("load", handleLoad);
    iframe.addEventListener("error", handleError);

    return () => {
      console.log(`Cleaning up listeners for banner: ${banner.id}`);
      clearTimeout(timeoutId);
      if (iframe) {
        iframe.removeEventListener("load", handleLoad);
        iframe.removeEventListener("error", handleError);
      }
    };
  }, [banner.id, banner.url, isLoading, isDataUrl]);


  return (
    <div
      ref={setNodeRef}
      style={style}
      data-sortable-id={banner.id}
      className={cn(
        "group/card relative rounded-lg border bg-card p-2 shadow-md transition-shadow hover:shadow-primary/20",
        isSelected && "border-primary ring-2 ring-primary",
        isDragging && "opacity-50"
      )}
    >
      <div
        ref={cardRef}
        data-banner-card-inner
        className="overflow-hidden rounded-md bg-muted"
        style={{ width: banner.width, height: banner.height }}
      >
        <div className="absolute inset-0 z-10 flex cursor-move items-center justify-center bg-transparent" {...attributes} {...listeners} />

        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/80 text-card-foreground">
            <Loader className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading Banner...</p>
          </div>
        )}
        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-destructive/20 text-destructive-foreground">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="px-4 text-center text-sm font-medium">
              Failed to load banner.
            </p>
            <Button size="sm" variant="destructive" onClick={handleReload}>
              <RefreshCw className="mr-2 h-4 w-4" /> Try Again
            </Button>
          </div>
        )}
        <iframe
          key={banner.id}
          ref={iframeRef}
          src={banner.url}
          width={banner.width}
          height={banner.height}
          scrolling="no"
          className={cn(
            "pointer-events-none border-0 transition-opacity",
            (isLoading || isError) && "opacity-0"
          )}
          sandbox="allow-scripts allow-same-origin"
          title={`Banner ${banner.width}x${banner.height}`}
        />
      </div>

      <div className="absolute left-2 top-2 z-20">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelection(banner.id)}
          aria-label="Select banner"
          className="h-5 w-5 rounded-full border-2 bg-card"
        />
      </div>

      <div className="absolute right-2 top-2 z-20 flex flex-col gap-2 opacity-0 transition-opacity group-hover/card:opacity-100">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="secondary" className="h-8 w-8" onClick={handleReload}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reload</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="secondary" className="h-8 w-8" onClick={handleScreenshot}>
              <Camera className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Screenshot</TooltipContent>
        </Tooltip>
        <Dialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button size="icon" variant="secondary" className="h-8 w-8">
                  <Expand className="h-4 w-4" />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Fullscreen</TooltipContent>
          </Tooltip>
          <DialogContent className="max-w-none w-auto h-auto bg-transparent border-none shadow-none p-0">
            <iframe
              src={banner.url}
              className="border-0"
              style={{ width: banner.width, height: banner.height }}
              scrolling="no"
              sandbox="allow-scripts allow-same-origin"
            />
          </DialogContent>
        </Dialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => onRemove(banner.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove</TooltipContent>
        </Tooltip>
      </div>

      <div className="absolute bottom-2 left-2 z-20 rounded-sm bg-black/50 px-1.5 py-0.5 text-xs text-white">
        R{banner.round} V{banner.version}
      </div>
      <div className="absolute bottom-2 right-2 z-20 rounded-sm bg-black/50 px-1.5 py-0.5 text-xs text-white">
        {banner.width}x{banner.height}
      </div>
    </div>
  );
}
