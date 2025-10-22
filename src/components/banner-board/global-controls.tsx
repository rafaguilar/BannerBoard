
"use client";

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RefreshCw, Loader } from 'lucide-react';
import type { Banner } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';

interface GlobalControlsProps {
  banners: Banner[];
  readyBanners: Set<string>;
  onReloadGroup: (groupId: string) => void;
}

function findLargestGroupId(banners: Banner[]): string | null {
  if (!banners.length) {
    return null;
  }

  const groupCounts = banners.reduce((acc, banner) => {
    if (banner.groupId) {
      acc[banner.groupId] = (acc[banner.groupId] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  let largestGroupId: string | null = null;
  let maxCount = 0;

  for (const groupId in groupCounts) {
    if (groupCounts[groupId] > maxCount) {
      maxCount = groupCounts[groupId];
      largestGroupId = groupId;
    }
  }

  return largestGroupId;
}

export function GlobalControls({ banners, readyBanners, onReloadGroup }: GlobalControlsProps) {
  const largestGroupId = useMemo(() => findLargestGroupId(banners), [banners]);

  if (!largestGroupId) {
    return null; // Don't render controls if no groups are present
  }

  const groupBanners = banners.filter(b => b.groupId === largestGroupId);
  const allInGroupReady = groupBanners.every(b => readyBanners.has(b.id));

  const handleGlobalAction = (action: 'global-play' | 'global-pause') => {
    if (!allInGroupReady) return;
    
    // Post message to all iframes. The injected script will filter by groupId.
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({
          action,
          groupId: largestGroupId,
        }, '*');
      }
    });
  };

  const handleGlobalRestart = () => {
    if (largestGroupId) {
        onReloadGroup(largestGroupId);
    }
  }

  const firstBanner = groupBanners[0];

  return (
    <TooltipProvider>
      <div className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-3 py-2 transition-opacity",
        !allInGroupReady && "opacity-50"
      )}>
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {!allInGroupReady && <Loader className="h-4 w-4 animate-spin" />}
          Global Controls (R{firstBanner.round} V{firstBanner.version})
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleGlobalAction('global-play')} disabled={!allInGroupReady}>
              <Play className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Play All</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleGlobalAction('global-pause')} disabled={!allInGroupReady}>
              <Pause className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pause All</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleGlobalRestart}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Restart All</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
