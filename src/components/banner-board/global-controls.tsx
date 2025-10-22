"use client";

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, RefreshCw } from 'lucide-react';
import type { Banner } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GlobalControlsProps {
  banners: Banner[];
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

export function GlobalControls({ banners }: GlobalControlsProps) {
  const largestGroupId = useMemo(() => findLargestGroupId(banners), [banners]);

  if (!largestGroupId) {
    return null; // Don't render controls if no groups are present
  }

  const handleGlobalAction = (action: 'global-play' | 'global-pause' | 'global-restart') => {
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

  const groupBanners = banners.filter(b => b.groupId === largestGroupId);
  const firstBanner = groupBanners[0];

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="text-sm font-medium text-muted-foreground">
          Global Controls (R{firstBanner.round} V{firstBanner.version})
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleGlobalAction('global-play')}>
              <Play className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Play All</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleGlobalAction('global-pause')}>
              <Pause className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pause All</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleGlobalAction('global-restart')}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Restart All</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
