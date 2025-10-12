"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { LogoIcon } from "./icons";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm">
      <SidebarTrigger className="md:hidden" />
      <div className="flex items-center gap-2">
        <LogoIcon className="h-7 w-7 text-primary" />
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          BannerBoard
        </h1>
      </div>
    </header>
  );
}
