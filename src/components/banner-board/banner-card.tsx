
"use client";

import React from 'react';
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
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { VisuallyHidden } from "@/components/ui/visually-hidden";

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
  const isDataUrl = banner.url.startsWith('data:');
  const isApiUrl = banner.url.startsWith('/api/preview');
  
  const [isLoading, setIsLoading] = React.useState(true);
  const [isError, setIsError] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [iframeKey, setIframeKey] = React.useState(banner.id);

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
  
  const handleReload = () => {
    setIsError(false);
    setIsLoading(true);
    setIframeKey(oldKey => oldKey + '-reload');
  };

  const handleScreenshot = async () => {
    if (cardRef.current) {
      try {
        const canvas = await html2canvas(cardRef.current, {
          allowTaint: true,
          useCORS: true,
          logging: true,
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
          description: "Could not capture screenshot. This can happen with complex HTML5 content.",
        });
      }
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  }

  const handleError = () => {
    setIsLoading(false);
    setIsError(true);
  }
  
  const iframeProps = {
    width: banner.width,
    height: banner.height,
    scrolling: "no" as const,
    className: cn(
        "pointer-events-none border-0 transition-opacity",
        (isLoading || isError) && "opacity-0"
    ),
    title: `Banner ${banner.width}x${banner.height}`,
    onLoad: handleLoad,
    onError: handleError,
  };

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
        
        {isDataUrl ? (
           <iframe {...iframeProps} key={iframeKey} src={banner.url} />
        ) : (
             <iframe {...iframeProps} key={iframeKey} src={banner.url} sandbox={isApiUrl ? "allow-scripts allow-same-origin" : undefined} />
        )}
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
            <VisuallyHidden>
              <DialogTitle>Fullscreen Banner Preview</DialogTitle>
            </VisuallyHidden>
             {isDataUrl ? (
                <iframe
                    key={iframeKey}
                    className="border-0"
                    style={{ width: banner.width, height: banner.height }}
                    scrolling="no"
                    title="Fullscreen Banner"
                    src={banner.url}
                />
            ) : (
                <iframe
                    src={banner.url}
                    className="border-0"
                    style={{ width: banner.width, height: banner.height }}
                    scrolling="no"
                    title="Fullscreen Banner"
                    sandbox={isApiUrl ? "allow-scripts allow-same-origin" : undefined}
                />
            )}
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
