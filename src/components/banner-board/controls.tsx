
"use client";

import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import JSZip from "jszip";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { detectBannerAnomalies } from "@/ai/flows/ai-anomaly-detection";
import html2canvas from "html2canvas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { VisuallyHidden } from "@/components/ui/visually-hidden";


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

// --- Local Upload Panel ---
const localUploadSchema = z.object({
  round: z.coerce.number().min(0, "Round must be non-negative."),
  version: z.coerce.number().min(0, "Version must be non-negative."),
});

function LocalUploadPanel({ onAddBanners }: { onAddBanners: (banners: Omit<Banner, "id">[]) => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof localUploadSchema>>({
    resolver: zodResolver(localUploadSchema),
    defaultValues: {
      round: 1,
      version: 1,
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
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
            description: "No valid image files were selected.",
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
      
    // Reset file input
    e.target.value = '';
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
              <div className="flex w-full items-center justify-center rounded-md border-2 border-dashed border-input px-6 py-10 text-center">
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
  width: z.coerce.number().min(1, "Width must be at least 1."),
  height: z.coerce.number().min(1, "Height must be at least 1."),
  round: z.coerce.number().min(0, "Round must be non-negative."),
  version: z.coerce.number().min(0, "Version must be non-negative."),
});

function HTML5UploadPanel({ onAddBanners }: { onAddBanners: (banners: Omit<Banner, "id">[]) => void }) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof html5UploadSchema>>({
    resolver: zodResolver(html5UploadSchema),
    defaultValues: {
      width: 300,
      height: 250,
      round: 1,
      version: 1,
    },
  });

  const getMimeType = (filename: string) => {
    const ext = `.${filename.split('.').pop()?.toLowerCase()}`;
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html', '.htm': 'text/html',
      '.css': 'text/css', '.js': 'application/javascript',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.svg': 'image/svg+xml',
      '.woff': 'font/woff', '.woff2': 'font/woff2',
      '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'font/otf'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    if (file.type !== "application/zip" && !file.name.endsWith('.zip')) {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: "Please upload a .zip file.",
      });
      return;
    }

    const { round, version, width, height } = form.getValues();

    try {
      const zip = await JSZip.loadAsync(file);
      const htmlFile = zip.file(/(\/)?(index|ad)\.html?$/i)[0];

      if (!htmlFile) {
        throw new Error("No index.html or ad.html file found in the zip archive.");
      }

      const assetContents: Map<string, string> = new Map();
      const assetDataUrls: Map<string, string> = new Map();
      const assetPromises: Promise<void>[] = [];

      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir || zipEntry.name.startsWith('__MACOSX')) return;

        const isText = zipEntry.name.match(/\.(css|js|svg|html|htm|json|xml)$/i);
        const outputType = isText ? "string" : "base64";
        
        const promise = zipEntry.async(outputType).then(content => {
          if (isText) {
            assetContents.set(zipEntry.name, content as string);
          }
          const mime = getMimeType(zipEntry.name);
          const dataUrl = `data:${mime}${isText ? `;charset=utf-8,${encodeURIComponent(content as string)}` : `;base64,${content}`}`;
          assetDataUrls.set(zipEntry.name, dataUrl);
        });
        assetPromises.push(promise);
      });

      await Promise.all(assetPromises);

      const processedContents: Map<string, string> = new Map();
      const assetPaths = Array.from(assetContents.keys());
      const dataUrlPaths = Array.from(assetDataUrls.keys()).sort((a,b) => b.length - a.length);

      for (const assetPath of assetPaths) {
        let content = assetContents.get(assetPath)!;
        for (const path of dataUrlPaths) {
          if(path === assetPath) continue;
          
          const dataUrl = assetDataUrls.get(path)!;
          // Look for src="...", href="..." and new Array(...)
          const pathParts = path.split('/');
          const filename = pathParts[pathParts.length-1];

          // More robust regex
          const regex = new RegExp(`(["'])(?:\\.\\/|\\/)?${filename}(["'])`, 'g');
          content = content.replace(regex, `$1${dataUrl}$2`);
        }
        processedContents.set(assetPath, content);
      }

      let finalHtmlContent = processedContents.get(htmlFile.name)!;
      
      onAddBanners([{
        url: finalHtmlContent,
        width,
        height,
        round,
        version,
      }]);

      toast({
        title: "HTML5 Banner Added",
        description: `Banner ${file.name} was successfully processed.`,
      });

    } catch (error) {
      console.error("Error processing zip file:", error);
      toast({
        variant: "destructive",
        title: "Zip Processing Error",
        description: (error as Error).message || "Could not read the zip file.",
      });
    }

    e.target.value = '';
  };
  
  return (
    <Form {...form}>
      <form className="space-y-4 p-4">
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
        <div>
          <FormLabel htmlFor="html5-file-upload">HTML5 Zip File</FormLabel>
          <div className="mt-2">
            <label htmlFor="html5-file-upload" className="relative cursor-pointer rounded-md bg-background font-medium text-primary hover:text-primary/90 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <div className="flex w-full items-center justify-center rounded-md border-2 border-dashed border-input px-6 py-10 text-center">
                <div className="text-center">
                  <FileArchive className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Click to upload a .zip file</p>
                </div>
              </div>
              <input id="html5-file-upload" name="html5-file-upload" type="file" className="sr-only" accept=".zip,application/zip" onChange={handleFileChange} />
            </label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Upload a zip file containing an HTML5 banner (with an index.html or ad.html).
        </p>
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
