

"use client";

import React, { useState, useEffect } from "react";
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
  FileUp,
  FileArchive,
} from "lucide-react";
import type { Banner, Preset } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { detectBannerAnomalies } from "@/ai/flows/ai-anomaly-detection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";


// --- Banner Input Panel ---

const bannerInputSchema = z.object({
  urls: z.string().min(1, "Please enter at least one URL."),
  width: z.coerce.number().min(1, "Width must be at least 1.").optional().or(z.literal('')),
  height: z.coerce.number().min(1, "Height must be at least 1.").optional().or(z.literal('')),
  round: z.coerce.number().min(0, "Round must be non-negative."),
  version: z.coerce.number().min(0, "Version must be non-negative."),
});

const extractSizeFromUrl = (url: string): { width: number; height: number } | null => {
    const match = url.match(/(\d+)[xX](\d+)/);
    if (match && match[1] && match[2]) {
      return {
        width: parseInt(match[1], 10),
        height: parseInt(match[2], 10),
      };
    }
    return null;
};


function BannerInputPanel({ onAddBanners }: { onAddBanners: (banners: Omit<Banner, "id">[]) => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof bannerInputSchema>>({
    resolver: zodResolver(bannerInputSchema),
    defaultValues: {
      urls: "",
      width: "",
      height: "",
      round: 1,
      version: 1,
    },
  });
  
  const handleUrlsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    form.setValue("urls", text);
    const firstUrl = text.split("\n")[0];
    if (firstUrl) {
        const dimensions = extractSizeFromUrl(firstUrl);
        if (dimensions) {
            form.setValue("width", dimensions.width);
            form.setValue("height", dimensions.height);
        } else {
             form.setValue("width", "");
             form.setValue("height", "");
        }
    }
  };


  function onSubmit(values: z.infer<typeof bannerInputSchema>) {
    const urls = values.urls.split("\n").filter((url) => url.trim() !== "");
    const newBanners = urls.map((url) => {
        const extractedSize = extractSizeFromUrl(url);
        const width = extractedSize?.width || values.width;
        const height = extractedSize?.height || values.height;

        if (!width || !height) {
            toast({
                variant: "destructive",
                title: "Missing Dimensions",
                description: `Could not determine dimensions for ${url}. Please set a fallback width and height.`
            });
            return null;
        }

        return {
          url,
          width: Number(width),
          height: Number(height),
          round: values.round,
          version: values.version,
        };
    }).filter(Boolean) as Omit<Banner, "id">[];

    if (newBanners.length > 0) {
      onAddBanners(newBanners);
      form.reset({ ...values, urls: "", width: "", height: "" });
    }
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
                  {...field}
                  placeholder="Paste one URL per line"
                  className="min-h-[150px] font-mono text-xs"
                  onChange={handleUrlsChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="width" render={({ field }) => (
            <FormItem>
              <FormLabel>Fallback Width</FormLabel>
              <FormControl><Input type="number" placeholder="e.g. 300" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="height" render={({ field }) => (
            <FormItem>
              <FormLabel>Fallback Height</FormLabel>
              <FormControl><Input type="number" placeholder="e.g. 250" {...field} /></FormControl>
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

// --- Local Upload Panel ---
const localUploadSchema = z.object({
  round: z.coerce.number().min(0, "Round must be non-negative."),
  version: z.coerce.number().min(0, "Version must be non-negative."),
});

function LocalUploadPanel({ onAddBanners }: { onAddBanners: (banners: Omit<Banner, "id">[]) => void }) {
  const { toast } = useToast();
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const form = useForm<z.infer<typeof localUploadSchema>>({
    resolver: zodResolver(localUploadSchema),
    defaultValues: {
      round: 1,
      version: 1,
    },
  });

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const { round, version } = form.getValues();
    const bannerPromises: Promise<Omit<Banner, "id">>[] = [];

    Array.from(files).forEach(file => {
      if (file.type.startsWith("image/")) {
        const promise = new Promise<Omit<Banner, "id">>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const img = new Image();
            img.onload = () => {
              resolve({
                url: dataUrl,
                width: img.width,
                height: img.height,
                round,
                version,
              });
            };
            img.onerror = reject;
            img.src = dataUrl;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        bannerPromises.push(promise);
      }
    });

    Promise.all(bannerPromises)
      .then(newBanners => {
        if (newBanners.length > 0) {
          onAddBanners(newBanners);
        } else {
          toast({
            variant: "destructive",
            title: "No Images Found",
            description: "No valid image files were selected or dropped.",
          });
        }
      })
      .catch(error => {
        console.error("Error processing local files:", error);
        toast({
          variant: "destructive",
          title: "File Processing Error",
          description: "There was an error reading the files.",
        });
      });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = ''; // Reset file input
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    handleFiles(e.dataTransfer.files);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  return (
    <Form {...form}>
      <form className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-4">
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
        <div>
          <FormLabel htmlFor="file-upload">Banner Files</FormLabel>
          <div className="mt-2">
            <label htmlFor="file-upload" className="relative cursor-pointer rounded-md bg-background font-medium text-primary hover:text-primary/90 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <div 
                className={cn(
                  "flex w-full items-center justify-center rounded-md border-2 border-dashed border-input px-6 py-10 text-center transition-colors",
                  isDraggingOver && "border-primary bg-accent"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="text-center">
                  <FileUp className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, GIF, etc.</p>
                </div>
              </div>
              <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple accept="image/*" onChange={handleFileChange} />
            </label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Select files to add them as banners. The banner dimensions will be detected automatically.
        </p>
      </form>
    </Form>
  );
}

// --- HTML5 Upload Panel ---
const html5UploadSchema = z.object({
    round: z.coerce.number().min(0, "Round must be non-negative."),
    version: z.coerce.number().min(0, "Version must be non-negative."),
});

function HTML5UploadPanel({ onAddBanners }: { onAddBanners: (banners: Omit<Banner, "id">[]) => void }) {
    const { toast } = useToast();
    const [isUploading, setIsUploading] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const form = useForm<z.infer<typeof html5UploadSchema>>({
        resolver: zodResolver(html5UploadSchema),
        defaultValues: {
            round: 1,
            version: 1,
        },
    });
    
    const processFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        const { round, version } = form.getValues();
        let filesProcessed = 0;
        
        setIsUploading(true);

        const uploadPromises = Array.from(files).map(async file => {
            if (file.type !== "application/zip" && !file.name.endsWith('.zip')) {
                toast({ variant: "destructive", title: "Invalid File Type", description: `Skipping non-zip file: ${file.name}.` });
                return;
            }

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('/api/preview/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Upload failed');
                }

                const { url, width, height } = await response.json();

                onAddBanners([{
                    url,
                    width,
                    height,
                    round,
                    version,
                }]);
                filesProcessed++;

            } catch (error) {
                console.error("Error uploading zip file:", error);
                toast({ variant: "destructive", title: "Upload Error", description: `Could not upload ${file.name}: ${(error as Error).message}` });
            }
        });

        await Promise.all(uploadPromises);

        setIsUploading(false);

        if (filesProcessed > 0) {
             toast({ title: "HTML5 Banners Added", description: `${filesProcessed} banner(s) are being prepared.` });
        }

        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
       processFiles(e.target.files);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      processFiles(e.dataTransfer.files);
    };
  
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
    };


    return (
        <Form {...form}>
            <form className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-4">
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
                <div>
                    <FormLabel htmlFor="html5-file-upload">HTML5 Zip File(s)</FormLabel>
                    <div className="mt-2">
                        <label htmlFor="html5-file-upload" className="relative cursor-pointer rounded-md bg-background font-medium text-primary hover:text-primary/90 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                            <div 
                              className={cn(
                                "flex w-full items-center justify-center rounded-md border-2 border-dashed border-input px-6 py-10 text-center transition-colors",
                                isDraggingOver && "border-primary bg-accent",
                                isUploading && "cursor-not-allowed opacity-50"
                              )}
                              onDrop={handleDrop}
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                            >
                                {isUploading ? (
                                    <div className="text-center">
                                        <Loader className="mx-auto h-12 w-12 animate-spin text-muted-foreground" />
                                        <p className="mt-2 text-sm text-muted-foreground">Uploading and processing...</p>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <FileArchive className="mx-auto h-12 w-12 text-muted-foreground" />
                                        <p className="mt-2 text-sm text-muted-foreground">Click or drag & drop .zip files</p>
                                    </div>
                                )}
                            </div>
                            <input ref={fileInputRef} id="html5-file-upload" name="html5-file-upload" type="file" className="sr-only" accept=".zip,application/zip" onChange={handleFileChange} disabled={isUploading} multiple />
                        </label>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    Upload one or more zip files containing HTML5 banners. Dimensions will be detected automatically from the ad.size meta tag.
                </p>
            </form>
        </Form>
    );
}

// --- AI Anomaly Panel ---

const getBannerDataUri = (banner: Banner): Promise<string> => {
  // Case 1: The banner is an uploaded image (data URL).
  if (banner.url.startsWith('data:')) {
    return Promise.resolve(banner.url);
  }

  // Case 2: The banner is an uploaded HTML5 ad.
  if (banner.url.startsWith('/api/preview')) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(`[data-sortable-id="${banner.id}"] iframe`) as HTMLIFrameElement;
      if (!element?.contentWindow) {
        return reject(new Error(`Could not find iframe content for banner ${banner.id}`));
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.bannerId !== banner.id) return;

        if (event.data?.action === 'screenshotCaptured') {
          window.removeEventListener('message', handleMessage);
          clearTimeout(timeoutId);
          resolve(event.data.dataUrl);
        }
        if (event.data?.action === 'screenshotFailed') {
          window.removeEventListener('message', handleMessage);
          clearTimeout(timeoutId);
          reject(new Error(event.data.error || 'Screenshot failed inside iframe'));
        }
      };

      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        reject(new Error('Screenshot request timed out.'));
      }, 10000); // 10 seconds timeout

      window.addEventListener('message', handleMessage);
      
      element.contentWindow.postMessage({
        action: 'captureScreenshot',
        bannerId: banner.id,
        width: banner.width,
        height: banner.height,
      }, '*');
    });
  }
  
  // Case 3: The banner is an external URL. Use html2canvas from the outside.
  return new Promise(async (resolve, reject) => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const innerElement = document.querySelector(`[data-sortable-id="${banner.id}"] [data-banner-card-inner]`) as HTMLElement;

      if (!innerElement) {
        return reject(new Error('Could not find inner element for screenshot.'));
      }
      
      const canvas = await html2canvas(innerElement, {
        allowTaint: true,
        useCORS: true,
        logging: false,
        width: banner.width,
        height: banner.height,
      });
      resolve(canvas.toDataURL("image/png"));
    } catch(e) {
      reject(new Error(`html2canvas failed: ${(e as Error).message}`));
    }
  });
};


function AIPanel({ banners, selectedBanners }: { banners: Banner[], selectedBanners: Banner[] }) {
  const [referenceBanner, setReferenceBanner] = useState<Banner | null>(null);
  const [comparisonBanners, setComparisonBanners] = useState<Banner[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
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

      const referenceBannerDataUri = await getBannerDataUri(referenceBanner);
      const comparisonBannerDataUris = await Promise.all(
        comparisonBanners.map(b => getBannerDataUri(b))
      );

      const result = await detectBannerAnomalies({
        referenceBannerDataUri,
        comparisonBannerDataUris,
        customPrompt: customPrompt || undefined,
      });

      setAnomalies(result.anomalies);
    } catch (error) {
      console.error("AI Anomaly detection failed:", error);
      toast({
        variant: "destructive",
        title: "AI Analysis Failed",
        description: (error as Error).message || "Could not perform anomaly detection.",
      });
      setAnomalies([`Error: ${(error as Error).message || 'Could not process banners for AI analysis.'}`]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const selectableBanners = selectedBanners;

  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold">AI Anomaly Detection</h3>
      <p className="text-sm text-muted-foreground">Select banners, then optionally provide a prompt to guide the AI analysis.</p>
      
      <div>
        <h4 className="mb-2 text-sm font-medium">Reference Banner</h4>
        {selectableBanners.length === 0 ? <p className="text-xs text-muted-foreground">Select banners in workspace first.</p> :
        <div className="flex flex-wrap gap-2">
            {selectableBanners.map(b => (
                <Button key={b.id} variant={referenceBanner?.id === b.id ? "default" : "outline"} size="sm" onClick={() => setReferenceBanner(b)}>
                    R{b.round} V{b.version} - {b.width}x{b.height}
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
                    R{b.round} V{b.version} - {b.width}x{b.height}
                </Button>
            ))}
        </div>
        }
      </div>

      <div>
        <Label htmlFor="ai-prompt" className="text-sm font-medium">Custom Prompt (Optional)</Label>
        <Textarea
          id="ai-prompt"
          placeholder="e.g., 'Check if all banners have the same copy.'"
          className="mt-2"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
        />
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
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="add"><Plus className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="upload"><Upload className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="html5"><FileArchive className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="ai"><BrainCircuit className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="presets"><List className="h-4 w-4" /></TabsTrigger>
      </TabsList>
      <ScrollArea className="flex-1">
        <TabsContent value="add">
          <BannerInputPanel onAddBanners={props.onAddBanners} />
        </TabsContent>
         <TabsContent value="upload">
          <LocalUploadPanel onAddBanners={props.onAddBanners} />
        </TabsContent>
        <TabsContent value="html5">
          <HTML5UploadPanel onAddBanners={props.onAddBanners} />
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
