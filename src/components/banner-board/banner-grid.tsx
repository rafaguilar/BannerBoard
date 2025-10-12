"use client";

import React from "react";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { BannerCard } from "./banner-card";
import type { Banner } from "@/lib/types";

interface BannerGridProps {
  banners: Banner[];
  selectedBannerIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onRemoveBanner: (id:string) => void;
  onUpdateBanner: (banner: Banner) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function BannerGrid({
  banners,
  selectedBannerIds,
  onToggleSelection,
  onRemoveBanner,
  onUpdateBanner,
  onSelectAll,
  onDeselectAll
}: BannerGridProps) {
  if (banners.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-muted-foreground">
          <h2 className="text-2xl font-semibold">Workspace is empty</h2>
          <p className="mt-2">Add banner URLs using the control panel to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
       <div className="mb-4 flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {selectedBannerIds.size} of {banners.length} selected
          </p>
          <Button size="sm" variant="outline" onClick={onSelectAll}>Select All</Button>
          <Button size="sm" variant="outline" onClick={onDeselectAll} disabled={selectedBannerIds.size === 0}>Deselect All</Button>
        </div>
      <SortableContext items={banners.map((b) => b.id)} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap items-start gap-4">
          {banners.map((banner) => (
            <BannerCard
              key={banner.id}
              banner={banner}
              isSelected={selectedBannerIds.has(banner.id)}
              onToggleSelection={onToggleSelection}
              onRemove={onRemoveBanner}
              onUpdate={onUpdateBanner}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
