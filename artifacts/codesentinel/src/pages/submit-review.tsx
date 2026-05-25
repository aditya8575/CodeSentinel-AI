import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateReview, getListReviewsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Github, Send, Code, Download, ClipboardCopy,
  AlertCircle, CheckCircle2, Loader2, Sparkles, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const formSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(100),
    prUrl: z.string().optional().or(z.literal("")),
    diffContent: z.string().optional().or(z.literal("")),
    language: z.string().optional(),
  })
  .refine(
    (v) => {
      const hasPr = Boolean(v.prUrl && v.prUrl.includes("github.com") && v.prUrl.includes("/pull/"));
      const hasDiff = Boolean(v.diffContent && v.diffContent.length >= 10);
      return hasPr || hasDiff;
    },
    { message: "Provide a GitHub PR URL or paste a diff below", path: ["prUrl"] }
  );

type FormValues = z.infer<typeof formSchema>;

function parseGitHubPrUrl(url: string): { owner: string; repo: string; number: string } | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname !== "github.com") return null;
    const match = u.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) return null;
    return { owner: match[1]!, repo: match[2]!, number: match[3]! };
  } catch {
    return null;
  }
}

function isDiffContent(text: string, contentType: string): boolean {
  if (contentType.includes("text/html")) return false;
  return text.includes("diff --git") || (text.includes("---") && text.includes("+++") && text.includes("@@"));
}

async function fetchDiffForPr(pr: { owner: string; repo: string; number: string }): Promise<string> {
  const apiUrl = `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}`;
  const apiRes = await fetch(apiUrl, { headers: { Accept: "application/vnd.github.diff" } });
  if (apiRes.ok) {
    const ct = apiRes.headers.get("content-type") ?? "";
    const text = await apiRes.text();
    if (isDiffContent(text, ct)) return text;
  }
  if (apiRes.status === 404) {
    throw new Error(
      `PR #${pr.number} not found in ${pr.owner}/${pr.repo}. It may be an issue, not a pull request.`
    );
  }
  const cdnUrl = `https://patch-diff.githubusercontent.com/raw/${pr.owner}/${pr.repo}/pull/${pr.number}.diff`;
  const cdnRes = await fetch(cdnUrl);
  if (cdnRes.ok) {
    const ct = cdnRes.headers.get("content-type") ?? "";
    const text = await cdnRes.text();
    if (isDiffContent(text, ct)) return text;
  }
  throw new Error(`Could not fetch a valid diff for PR #${pr.number}. Try pasting the diff manually.`);
}

export default function SubmitReview() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [prUrl, setPrUrl] = useState("");
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [fetchError, setFetchError] = useState("");
  const [showManual, setShowManual] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", prUrl: "", diffContent: "", language: "javascript" },
  });

  const createReview = useCreateReview();
  const parsedPr = parseGitHubPrUrl(prUrl);
  const diffContent = form.watch("diffContent");
  const hasDiff = Boolean(diffContent && diffContent.length >= 10);
  const hasValidPr = Boolean(parsedPr);
  const canSubmit = hasValidPr || hasDiff;

  async function loadDiffPreview() {
    if (!parsedPr) return;
    setFetchState("loading");
    setFetchError("");
    try {
      const text = await fetchDiffForPr(parsedPr);
      form.setValue("diffContent", text, { shouldValidate: true });
      setShowManual(true);
      setFetchState("success");
      toast({
        title: "Diff previewed",
        description: `${(text.length / 1024).toFixed(1)} KB loaded from PR #${parsedPr.number}.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not load diff. Try pasting it manually.";
      setFetchError(msg);
      setFetchState("error");
    }
  }

  const onSubmit = (values: FormValues) => {
    createReview.mutate(
      {
        data: {
          title: values.title,
          language: values.language,
          prUrl: values.prUrl || undefined,
          diffContent: values.diffContent || undefined,
        },
      },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey() });
          toast({ title: "Analysis started!", description: "Reviewing your code now…" });
          setLocation(`/reviews/${data.id}`);
        },
        onError: (error: any) => {
          toast({
            title: "Submission failed",
            description: error.message || "An error occurred",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-1">Submit for Review</h1>
        <p className="text-muted-foreground">Paste a GitHub PR URL — that's all you need.</p>
      </div>

      <Card className="bg-card/50 border-border/50">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Review Details</CardTitle>
              <CardDescription>Fill in a title, paste a PR link, and hit Start Analysis.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Title + Language */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Review Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Fix auth middleware bug" {...field} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Language</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select language" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {["typescript","javascript","python","go","rust","java","cpp","ruby"].map((l) => (
                            <SelectItem key={l} value={l}>
                              {l.charAt(0).toUpperCase() + l.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* GitHub PR URL — primary input */}
              <FormField
                control={form.control}
                name="prUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-base">
                      <Github className="w-4 h-4" />
                      GitHub PR URL
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://github.com/owner/repo/pull/123"
                        value={prUrl}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPrUrl(val);
                          field.onChange(val);
                          setFetchState("idle");
                          setFetchError("");
                          if (!val) setShowManual(false);
                        }}
                        className="bg-background text-base h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Auto-fetch status banner */}
              {parsedPr && fetchState === "idle" && !hasDiff && (
                <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Ready to analyze PR #{parsedPr.number} in{" "}
                      <span className="text-primary">{parsedPr.owner}/{parsedPr.repo}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The diff will be fetched automatically when you click Start Analysis.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs shrink-0 gap-1 h-7"
                    disabled={fetchState === "loading"}
                    onClick={loadDiffPreview}
                  >
                    {fetchState === "loading" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Download className="w-3 h-3" />
                    )}
                    Preview diff
                  </Button>
                </div>
              )}

              {parsedPr && fetchState === "success" && (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <CheckCircle2 className="w-4 h-4" />
                  Diff previewed ({(( diffContent?.length ?? 0) / 1024).toFixed(1)} KB) — ready to analyze.
                </div>
              )}

              {fetchState === "error" && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{fetchError}</AlertDescription>
                </Alert>
              )}

              {/* Collapsible manual diff paste */}
              <div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowManual((v) => !v)}
                >
                  {showManual ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {hasValidPr ? "Or paste a diff manually (optional)" : "No PR URL? Paste a diff here"}
                  {hasDiff && (
                    <Badge variant="secondary" className="text-xs font-mono ml-1">
                      {((diffContent?.length ?? 0) / 1024).toFixed(1)} KB
                    </Badge>
                  )}
                </button>

                {(showManual || (!hasValidPr)) && (
                  <FormField
                    control={form.control}
                    name="diffContent"
                    render={({ field }) => (
                      <FormItem className="mt-3">
                        <FormLabel className="flex items-center gap-2 text-sm">
                          <Code className="w-3.5 h-3.5" />
                          Code Diff
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={`Paste your git diff here.\n\nExample:\ndiff --git a/src/auth.js b/src/auth.js\n--- a/src/auth.js\n+++ b/src/auth.js\n@@ -1,5 +1,8 @@\n+const SECRET = "hardcoded"\n+function login(user, pass) {\n+  return db.query("SELECT * FROM users WHERE user='"+user+"'")\n+}`}
                            className="min-h-[220px] font-mono text-sm bg-background"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="flex items-center gap-1.5 text-xs">
                          <ClipboardCopy className="w-3 h-3" />
                          Run <code className="bg-muted px-1 py-0.5 rounded">git diff HEAD~1</code> and paste the output.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Quick-try examples */}
              <div className="rounded-md bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Quick examples — click to fill:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { url: "https://github.com/axios/axios/pull/6028", label: "axios — XSRF fix" },
                    { url: "https://github.com/vercel/next.js/pull/77000", label: "next.js — CI rename" },
                    { url: "https://github.com/facebook/react/pull/31768", label: "react — compiler" },
                  ].map(({ url, label }) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => {
                        setPrUrl(url);
                        form.setValue("prUrl", url, { shouldValidate: true });
                        form.setValue("diffContent", "");
                        setFetchState("idle");
                        setFetchError("");
                        setShowManual(false);
                      }}
                      className="text-xs px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-primary border border-border/40 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex justify-between border-t border-border/50 pt-5">
              <Button variant="ghost" type="button" onClick={() => setLocation("/")}>
                Cancel
              </Button>
              <Button type="submit" disabled={createReview.isPending || !canSubmit} className="gap-2 px-6">
                {createReview.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                ) : (
                  <><Send className="w-4 h-4" /> Start Analysis</>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
