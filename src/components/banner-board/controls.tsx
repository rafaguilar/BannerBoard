"use client";

import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Trash2,
  BrainCircuit,
  Save,
  List,
  Upload,
  Download,
  Loader,
  X,
} from "lucide-react";
import type { Banner, Preset } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { detectBannerAnomalies } from "@/ai/flows/ai-anomaly-detection";
import html2canvas from "html2canvas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


// --- Banner Input Panel ---

const bannerInputSchema = z.object({
  urls: z.string().min(1, "Please enter at least one URL."),
  width: z.coerce.number().min(1, "Width must be at least 1."),
  height: z.coerce.number().min(1, "Height must be at least 1."),
  round: z.coerce.number().min(0, "Round must be non-negative."),
  version: z.coerce.number().min(0, "Version must be non-negative."),
});

function BannerInputPanel({ onAddBanners }: { onAddBanners: (banners: Omit<Banner, "id">[]) => void }) {
  const form = useForm<z.infer<typeof bannerInputSchema>>({
    resolver: zodResolver(bannerInputSchema),
    defaultValues: {
      urls: "",
      width: 300,
      height: 250,
      round: 1,
      version: 1,
    },
  });

  function onSubmit(values: z.infer<typeof bannerInputSchema>) {
    const urls = values.urls.split("\n").filter((url) => url.trim() !== "");
    const newBanners = urls.map((url) => ({
      url,
      width: values.width,
      height: values.height,
      round: values.round,
      version: values.version,
    }));
    onAddBanners(newBanners);
    form.reset({ ...values, urls: "" });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
        <FormField
          control={form.control}
          name="urls"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Banner URLs</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Paste one URL per line"
                  className="min-h-[150px] font-mono text-xs"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="width" render={({ field }) => (
            <FormItem>
              <FormLabel>Width</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="height" render={({ field }) => (
            <FormItem>
              <FormLabel>Height</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="round" render={({ field }) => (
            <FormItem>
              <FormLabel>Round</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="version" render={({ field }) => (
            <FormItem>
              <FormLabel>Version</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <Button type="submit" className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Add Banners
        </Button>
      </form>
    </Form>
  );
}

// --- AI Anomaly Panel ---

function AIPanel({ banners, selectedBanners }: { banners: Banner[], selectedBanners: Banner[] }) {
  const [referenceBanner, setReferenceBanner] = useState<Banner | null>(null);
  const [comparisonBanners, setComparisonBanners] = useState<Banner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  const handleRunDetection = async () => {
    if (!referenceBanner || comparisonBanners.length === 0) {
      toast({ variant: "destructive", title: "Selection required", description: "Please select a reference and at least one comparison banner." });
      return;
    }
    setIsLoading(true);
    setAnomalies([]);
    setIsModalOpen(true);

    try {
      const getBannerDataUri = async (bannerId: string): Promise<string> => {
        const element = document.querySelector(`[data-sortable-id="${bannerId}"] [data-banner-card-inner]`) as HTMLElement;
        if (!element) throw new Error(`Could not find element for banner ${bannerId}`);
        const canvas = await html2canvas(element, { allowTaint: true, useCORS: true, logging: false });
        return canvas.toDataURL("image/png");
      };

      const referenceBannerDataUri = await getBannerDataUri(referenceBanner.id);
      const comparisonBannerDataUris = await Promise.all(
        comparisonBanners.map(b => getBannerDataUri(b.id))
      );

      const result = await detectBannerAnomalies({
        referenceBannerDataUri,
        comparisonBannerDataUris,
      });

      setAnomalies(result.anomalies);
    } catch (error) {
      console.error("AI Anomaly detection failed:", error);
      toast({
        variant: "destructive",
        title: "AI Analysis Failed",
        description: "Could not perform anomaly detection. This can happen with banners from external domains due to security restrictions.",
      });
      setAnomalies(["Error: Could not process banners for AI analysis."]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const selectableBanners = selectedBanners;

  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold">AI Anomaly Detection</h3>
      <p className="text-sm text-muted-foreground">Select a reference banner and one or more comparison banners from your selected banners in the workspace.</p>
      
      <div>
        <h4 className="mb-2 text-sm font-medium">Reference Banner</h4>
        {selectableBanners.length === 0 ? <p className="text-xs text-muted-foreground">Select banners in workspace first.</p> :
        <div className="flex flex-wrap gap-2">
            {selectableBanners.map(b => (
                <Button key={b.id} variant={referenceBanner?.id === b.id ? "default" : "outline"} size="sm" onClick={() => setReferenceBanner(b)}>
                    {b.width}x{b.height}
                </Button>
            ))}
        </div>
        }
      </div>

       <div>
        <h4 className="mb-2 text-sm font-medium">Comparison Banners</h4>
        {selectableBanners.filter(b => b.id !== referenceBanner?.id).length === 0 ? <p className="text-xs text-muted-foreground">Select more banners to compare.</p> :
        <div className="flex flex-wrap gap-2">
            {selectableBanners.filter(b => b.id !== referenceBanner?.id).map(b => (
                <Button key={b.id} variant={comparisonBanners.some(cb => cb.id === b.id) ? "default" : "outline"} size="sm" onClick={() => {
                    setComparisonBanners(prev => prev.some(cb => cb.id === b.id) ? prev.filter(cb => cb.id !== b.id) : [...prev, b]);
                }}>
                    {b.width}x{b.height}
                </Button>
            ))}
        </div>
        }
      </div>
      
      <Button onClick={handleRunDetection} disabled={!referenceBanner || comparisonBanners.length === 0} className="w-full">
        <BrainCircuit className="mr-2 h-4 w-4" /> Run Detection
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Anomaly Detection Results</DialogTitle>
            <DialogDescription>
              {isLoading ? "Analyzing banners... This may take a moment." : `Analysis complete for reference banner and ${comparisonBanners.length} other(s).`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : (
                anomalies.length > 0 ? (
                  <ul className="space-y-3">
                    {anomalies.map((anomaly, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <BrainCircuit className="h-5 w-5 flex-shrink-0 text-primary mt-1" />
                        <span>{anomaly}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                   <Alert>
                    <BrainCircuit className="h-4 w-4" />
                    <AlertTitle>No Anomalies Found!</AlertTitle>
                    <AlertDescription>
                      The AI did not detect any significant visual inconsistencies between the reference and comparison banners.
                    </AlertDescription>
                  </Alert>
                )
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// --- Presets Panel ---

function PresetsPanel({ presets, onSavePreset, onLoadPreset, onDeletePreset }: { presets: Preset[], onSavePreset: (name: string) => void, onLoadPreset: (id: string) => void, onDeletePreset: (id: string) => void }) {
  const [presetName, setPresetName] = useState("");

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="New preset name..."
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
        />
        <Button onClick={() => { onSavePreset(presetName); setPresetName(""); }} size="icon" className="flex-shrink-0">
          <Save className="h-4 w-4" />
        </Button>
      </div>
      <h3 className="font-semibold pt-4">Saved Presets</h3>
      <ScrollArea className="h-64">
        <div className="space-y-2">
          {presets.length > 0 ? presets.map(preset => (
            <div key={preset.id} className="flex items-center justify-between rounded-md border p-2">
              <span className="text-sm font-medium">{preset.name}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onLoadPreset(preset.id)}><Download className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDeletePreset(preset.id)}><X className="h-4 w-4" /></Button>
              </div>
            </div>
          )) : <p className="text-sm text-muted-foreground text-center py-4">No presets saved.</p>}
        </div>
      </ScrollArea>
    </div>
  );
}


// --- Main Controls Component ---

interface MainControlsProps {
  onAddBanners: (banners: Omit<Banner, "id">[]) => void;
  onClearBanners: () => void;
  presets: Preset[];
  onSavePreset: (name: string) => void;
  onLoadPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  banners: Banner[];
  selectedBanners: Banner[];
}

export function MainControls(props: MainControlsProps) {
  return (
    <Tabs defaultValue="add" className="flex h-full flex-col">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="add"><Plus className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="ai"><BrainCircuit className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="presets"><List className="h-4 w-4" /></TabsTrigger>
      </TabsList>
      <ScrollArea className="flex-1">
        <TabsContent value="add">
          <BannerInputPanel onAddBanners={props.onAddBanners} />
        </TabsContent>
        <TabsContent value="ai">
          <AIPanel banners={props.banners} selectedBanners={props.selectedBanners} />
        </TabsContent>
        <TabsContent value="presets">
          <PresetsPanel {...props} />
        </TabsContent>
      </ScrollArea>
      <div className="border-t p-4">
         <Button variant="destructive" className="w-full" onClick={props.onClearBanners}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear Workspace
        </Button>
      </div>
    </Tabs>
  );
}
