
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
} from "@dnd-kit/sortable";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import type { Banner, Preset } from "@/lib/types";
import {
  loadWorkspaceFromStorage,
  saveWorkspaceToStorage,
  loadPresetsFromStorage,
  savePresetsToStorage,
} from "@/lib/workspace";
import { BannerGrid } from "./banner-grid";
import { AppHeader } from "./header";
import { MainControls } from "./controls";

export function BannerBoard() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selectedBannerIds, setSelectedBannerIds] = useState<Set<string>>(
    new Set()
  );
  const [readyBanners, setReadyBanners] = useState<Set<string>>(new Set());
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    const savedBanners = loadWorkspaceFromStorage();
    if (savedBanners) {
      setBanners(savedBanners);
      // Assume all loaded banners are ready initially
      setReadyBanners(new Set(savedBanners.map(b => b.id)));
    }
    setPresets(loadPresetsFromStorage());
  }, []);

  useEffect(() => {
    if (isClient) {
      saveWorkspaceToStorage(banners);
    }
  }, [banners, isClient]);

  useEffect(() => {
    if (isClient) {
      savePresetsToStorage(presets);
    }
  }, [presets, isClient]);

  const handleSetBannerAsReady = useCallback((bannerId: string) => {
    setReadyBanners(prev => {
      const newSet = new Set(prev);
      newSet.add(bannerId);
      return newSet;
    });
  }, []);

  const handleAddBanners = useCallback(
    (newBanners: Omit<Banner, "id" | "isReady">[]) => {
      const bannersToAdd = newBanners.map((b) => ({ ...b, id: b.id || uuidv4() }));
      setBanners((prev) => [...prev, ...bannersToAdd]);
      
      // We don't mark them as ready yet; the banner card will do that
      bannersToAdd.forEach(b => {
        if (!b.url.startsWith('/api/preview')) {
            handleSetBannerAsReady(b.id);
        }
      });

      toast({
        title: "Banners Added",
        description: `${bannersToAdd.length} new banners have been added to the workspace.`,
      });
    },
    [toast, handleSetBannerAsReady]
  );

  const handleUpdateBanner = useCallback((updatedBanner: Banner) => {
    setBanners((prev) =>
      prev.map((b) => (b.id === updatedBanner.id ? updatedBanner : b))
    );
  }, []);

  const handleReloadGroup = useCallback((groupId: string) => {
    setBanners(prevBanners => 
        prevBanners.map(banner => 
            banner.groupId === groupId ? { ...banner, key: uuidv4() } : banner
        )
    );
    setReadyBanners(prevReady => {
      const newReadyBanners = new Set(prevReady);
      banners.forEach(banner => {
        if (banner.groupId === groupId) {
          newReadyBanners.delete(banner.id);
        }
      });
      return newReadyBanners;
    });
  }, [banners]);

  const handleRemoveBanner = useCallback((bannerId: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== bannerId));
    setSelectedBannerIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(bannerId);
      return newSet;
    });
    setReadyBanners(prev => {
      const newSet = new Set(prev);
      newSet.delete(bannerId);
      return newSet;
    });
  }, []);

  const handleRemoveSelectedBanners = useCallback(() => {
    const originalCount = banners.length;
    const selectedCount = selectedBannerIds.size;
    setBanners((prev) => prev.filter((b) => !selectedBannerIds.has(b.id)));
    setReadyBanners((prev) => {
        const newSet = new Set(prev);
        selectedBannerIds.forEach(id => newSet.delete(id));
        return newSet;
    });
    setSelectedBannerIds(new Set());
    toast({
        title: "Banners Removed",
        description: `${selectedCount} banner(s) have been removed from the workspace.`,
    });
  }, [banners.length, selectedBannerIds, toast]);


  const handleClearBanners = useCallback(() => {
    setBanners([]);
    setSelectedBannerIds(new Set());
    setReadyBanners(new Set());
    toast({
      title: "Workspace Cleared",
      description: "All banners have been removed.",
    });
  }, [toast]);

  const handleToggleSelection = useCallback((bannerId: string) => {
    setSelectedBannerIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(bannerId)) {
        newSet.delete(bannerId);
      } else {
        newSet.add(bannerId);
      }
      return newSet;
    });
  }, []);
  
  const handleSelectAll = useCallback(() => {
    setSelectedBannerIds(new Set(banners.map(b => b.id)));
  }, [banners]);

  const handleDeselectAll = useCallback(() => {
    setSelectedBannerIds(new Set());
  }, []);

  const handleSavePreset = useCallback((name: string) => {
    if (!name.trim()) {
      toast({
        variant: "destructive",
        title: "Invalid Name",
        description: "Preset name cannot be empty.",
      });
      return;
    }
    const newPreset: Preset = { id: uuidv4(), name, banners: [...banners] };
    setPresets((prev) => [...prev, newPreset]);
    toast({
      title: "Preset Saved",
      description: `Preset "${name}" has been saved.`,
    });
  }, [banners, toast]);

  const handleLoadPreset = useCallback((presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (preset) {
      setBanners(preset.banners);
      setReadyBanners(new Set(preset.banners.map(b => b.id))); // Assume ready on load
      toast({
        title: "Preset Loaded",
        description: `Preset "${preset.name}" has been loaded.`,
      });
    }
  }, [presets, toast]);

  const handleDeletePreset = useCallback((presetId: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== presetId));
    toast({
      title: "Preset Deleted",
    });
  }, [toast]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setBanners((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const selectedBanners = banners.filter(b => selectedBannerIds.has(b.id));

  return (
    <SidebarProvider>
      <Sidebar side="left" collapsible="icon" className="z-20">
        <SidebarContent>
          <MainControls
            onAddBanners={handleAddBanners}
            onClearBanners={handleClearBanners}
            presets={presets}
            onSavePreset={handleSavePreset}
            onLoadPreset={handleLoadPreset}
            onDeletePreset={handleDeletePreset}
            banners={banners}
            selectedBanners={selectedBanners}
          />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <AppHeader />
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <BannerGrid
            banners={banners}
            selectedBannerIds={selectedBannerIds}
            readyBanners={readyBanners}
            onToggleSelection={handleToggleSelection}
            onRemoveBanner={handleRemoveBanner}
            onUpdateBanner={handleUpdateBanner}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onSetBannerAsReady={handleSetBannerAsReady}
            onRemoveSelectedBanners={handleRemoveSelectedBanners}
            onReloadGroup={handleReloadGroup}
          />
        </DndContext>
      </SidebarInset>
    </SidebarProvider>
  );
}
