
"use client";

import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import html2canvas from "html2canvas";
import { v4 as uuidv4 } from "uuid";
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
  Info,
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

  const processFiles = (files: FileList | null) => {
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
    processFiles(e.target.files);
    e.target.value = ''; // Reset file input
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

function HTML5UploadPanel({ banners, onAddBanners }: { banners: Banner[], onAddBanners: (banners: Omit<Banner, "id">[]) => void }) {
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

        const alreadyHasGroup = banners.some(b => b.groupId);
        if (alreadyHasGroup) {
            const proceed = window.confirm(
                "A group of banners with global controls already exists.\n\nAdding new banners will create a separate group that won't be affected by the current global controls.\n\nDo you want to continue?"
            );
            if (!proceed) {
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
        }

        const { round, version } = form.getValues();
        const groupId = uuidv4(); // Create a single group ID for this batch
        let filesProcessed = 0;
        
        setIsUploading(true);

        const newBanners: Omit<Banner, "id">[] = [];

        const uploadPromises = Array.from(files).map(async file => {
            if (file.type !== "application/zip" && !file.name.endsWith('.zip')) {
                toast({ variant: "destructive", title: "Invalid File Type", description: `Skipping non-zip file: ${file.name}.` });
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('groupId', groupId);

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

                newBanners.push({
                    url,
                    width,
                    height,
                    round,
                    version,
                    groupId,
                });
                filesProcessed++;

            } catch (error) {
                console.error("Error uploading zip file:", error);
                toast({ variant: "destructive", title: "Upload Error", description: `Could not upload ${file.name}: ${(error as Error).message}` });
            }
        });

        await Promise.all(uploadPromises);

        setIsUploading(false);
        
        if (newBanners.length > 0) {
            onAddBanners(newBanners);
        }

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
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Global Controls</AlertTitle>
                  <AlertDescription>
                    To use the global Play/Pause/Restart controls, upload all related banners in a single drag & drop action.
                  </AlertDescription>
                </Alert>
            </form>
        </Form>
    );
}

// --- AI Anomaly Panel ---

const getBannerDataUri = (banner: Banner): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Case 1: Data URL (already a base64 image from local upload)
    if (banner.url.startsWith('data:image')) {
      resolve(banner.url);
      return;
    }

    // Case 2: External URL (e.g., http://.../banner.jpg)
    // Find the banner card's inner element to capture it
    const element = document.querySelector(`[data-sortable-id="${banner.id}"] [data-banner-card-inner]`) as HTMLElement;
    if (!element) {
      reject(new Error(`Could not find banner card element for banner ${banner.id}`));
      return;
    }

    html2canvas(element, {
      allowTaint: true,
      useCORS: true,
      logging: false,
      width: banner.width,
      height: banner.height,
    }).then(canvas => {
      resolve(canvas.toDataURL('image/png'));
    }).catch(error => {
        console.error('html2canvas error:', error);
        reject(new Error(`Failed to capture banner with html2canvas for banner ${banner.id}.`));
    });
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
    if (!referenceBanner && comparisonBanners.length === 0 && !customPrompt) {
      toast({ variant: "destructive", title: "Input required", description: "Please select banners to analyze or provide a custom prompt." });
      return;
    }

    const allBannersForAI = [referenceBanner, ...comparisonBanners].filter(Boolean) as Banner[];
    const hasHTML5Banner = allBannersForAI.some(b => b.url.startsWith('/api/preview'));

    if (hasHTML5Banner) {
        toast({
            variant: "destructive",
            title: "Unsupported Banner Type",
            description: "AI Anomaly Detection currently only supports static images (JPG, PNG, GIF). Please deselect any HTML5 banners.",
        });
        return;
    }
    
    setIsLoading(true);
    setAnomalies([]);
    setIsModalOpen(true);

    try {
      let refDataUri = "";
      if (referenceBanner) {
        refDataUri = await getBannerDataUri(referenceBanner);
      }
      
      const compDataUris = await Promise.all(comparisonBanners.map(getBannerDataUri));
      
      const result = await detectBannerAnomalies({
        referenceBannerDataUri: refDataUri,
        comparisonBannerDataUris: compDataUris,
        customPrompt: customPrompt || undefined,
      });

      setAnomalies(result.anomalies);
    } catch (error) {
      console.error("AI Anomaly detection failed:", error);
      const errorMessage = (error instanceof Error) ? error.message : "An unknown error occurred during AI analysis.";
      toast({
        variant: "destructive",
        title: "AI Analysis Failed",
        description: errorMessage,
      });
      setAnomalies([`Error: ${errorMessage}`]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const selectableBanners = selectedBanners;

  const handleSetReference = (banner: Banner) => {
    setReferenceBanner(banner);
    // A banner cannot be a reference and a comparison at the same time
    setComparisonBanners(prev => prev.filter(cb => cb.id !== banner.id));
  };

  const handleToggleComparison = (banner: Banner) => {
    setComparisonBanners(prev => 
      prev.some(cb => cb.id === banner.id) 
        ? prev.filter(cb => cb.id !== banner.id) 
        : [...prev, banner]
    );
  };

  const isRunDisabled = () => {
    if (isLoading) return true;
    if (customPrompt && selectedBanners.length > 0) return false;
    if (!referenceBanner) return true;
    return false;
  };

  return (
    <div className="space-y-4 p-4">
      <h3 className="font-semibold">AI Anomaly Detection</h3>
      <p className="text-sm text-muted-foreground">Select banners to compare, or just ask the AI a question about them. <strong className="text-primary/80">Only static images supported.</strong></p>
      
      <div>
        <h4 className="mb-2 text-sm font-medium">Reference Banner</h4>
        {selectableBanners.length === 0 ? <p className="text-xs text-muted-foreground">Select banners in workspace first.</p> :
        <div className="flex flex-wrap gap-2">
            {selectableBanners.map(b => (
                <Button key={b.id} variant={referenceBanner?.id === b.id ? "default" : "outline"} size="sm" onClick={() => handleSetReference(b)}>
                    R{b.round} V{b.version} - {b.width}x{b.height}
                </Button>
            ))}
        </div>
        }
      </div>

       <div>
        <h4 className="mb-2 text-sm font-medium">Comparison Banners</h4>
        {selectableBanners.filter(b => b.id !== referenceBanner?.id).length === 0 && (!referenceBanner) ? <p className="text-xs text-muted-foreground">Select a reference banner first.</p> :
         selectableBanners.filter(b => b.id !== referenceBanner?.id).length === 0 && (referenceBanner) ? <p className="text-xs text-muted-foreground">No other banners selected to compare.</p> :
        <div className="flex flex-wrap gap-2">
            {selectableBanners.filter(b => b.id !== referenceBanner?.id).map(b => (
                <Button key={b.id} variant={comparisonBanners.some(cb => cb.id === b.id) ? "default" : "outline"} size="sm" onClick={() => handleToggleComparison(b)}>
                    R{b.round} V{b.version} - {b.width}x{b.height}
                </Button>
            ))}
        </div>
        }
      </div>

      <div>
        <Label htmlFor="ai-prompt" className="text-sm font-medium">Custom Prompt</Label>
        <Textarea
          id="ai-prompt"
          placeholder="e.g., 'Do all banners have the same copy?'"
          className="mt-2"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
        />
      </div>
      
      <Button onClick={handleRunDetection} disabled={isRunDisabled()} className="w-full">
        {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
        {isLoading ? "Analyzing..." : "Run Detection"}
      </Button>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI Anomaly Detection Results</DialogTitle>
            <DialogDescription>
              {isLoading ? "Analyzing... This may take a moment." : `Analysis complete.`}
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
                      The AI did not detect any significant visual inconsistencies based on your request.
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
          <HTML5UploadPanel banners={props.banners} onAddBanners={props.onAddBanners} />
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
