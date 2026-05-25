import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { 
  useGetReview, 
  getGetReviewQueryKey,
  useReanalyzeReview,
  useDeleteReview,
  useGetChatHistory
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  ShieldAlert, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  ArrowLeft,
  RefreshCw,
  Trash2,
  Send,
  User,
  Bot,
  FileCode,
  TerminalSquare
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ReviewDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [chatInput, setChatInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: review, isLoading } = useGetReview(id, { 
    query: { 
      enabled: !!id, 
      queryKey: getGetReviewQueryKey(id),
      refetchInterval: (query) => {
        // Poll if status is pending or analyzing
        const data = query.state.data;
        if (data && (data.status === "pending" || data.status === "analyzing")) {
          return 3000; // 3 seconds
        }
        return false;
      }
    } 
  });

  const { data: chatHistory } = useGetChatHistory(id, {
    query: {
      enabled: !!id,
      queryKey: ["chatHistory", id]
    }
  });

  const reanalyzeReview = useReanalyzeReview();
  const deleteReview = useDeleteReview();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, streamingMessage]);

  const handleReanalyze = () => {
    reanalyzeReview.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetReviewQueryKey(id) });
        toast({ title: "Analysis restarted" });
      }
    });
  };

  const handleDelete = () => {
    deleteReview.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Review deleted" });
        setLocation("/");
      }
    });
  };

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isStreaming) return;

    const content = chatInput;
    setChatInput("");
    setIsStreaming(true);
    setStreamingMessage("");

    // Optimistically update chat (handled externally or just rely on server)
    try {
      const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/api/chat/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });

      if (!res.ok) throw new Error("Chat failed");
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(Boolean);
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              if (dataStr === '[DONE]') continue;
              
              try {
                const data = JSON.parse(dataStr);
                if (data.done) break;
                if (data.content) {
                  setStreamingMessage(prev => prev + data.content);
                }
              } catch (e) {
                console.error("SSE parse error", e);
              }
            }
          }
        }
      }
      
      // Refresh chat history after stream ends
      queryClient.invalidateQueries({ queryKey: ["chatHistory", id] });
    } catch (error) {
      toast({ title: "Chat error", variant: "destructive" });
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  if (isLoading || !review) {
    return (
      <div className="p-6 md:p-8 flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading analysis...</p>
        </div>
      </div>
    );
  }

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return 'text-destructive bg-destructive/10 border-destructive/30';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'critical': return <ShieldAlert className="w-4 h-4 text-destructive" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'medium': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'low': return <Info className="w-4 h-4 text-blue-400" />;
      default: return <Info className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6 md:p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-4 -ml-3 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{review.title}</h1>
              <Badge variant="outline" className="uppercase tracking-wider">
                {review.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {review.prUrl && (
                <a href={review.prUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
                  <FileCode className="w-4 h-4" />
                  View PR
                </a>
              )}
              <span>{format(new Date(review.createdAt), 'MMM d, yyyy HH:mm')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReanalyze} disabled={reanalyzeReview.isPending || review.status === 'analyzing'}>
              <RefreshCw className={`w-4 h-4 mr-2 ${reanalyzeReview.isPending ? 'animate-spin' : ''}`} />
              Re-analyze
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Review?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this review and its findings.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-muted hover:bg-muted/80">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {(review.status === "pending" || review.status === "analyzing") ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-lg bg-card/30">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <h3 className="text-xl font-semibold mb-2">Analyzing Code...</h3>
            <p className="text-muted-foreground max-w-md text-center">
              The AI reviewer is examining the code for security vulnerabilities, performance issues, and maintainability.
            </p>
          </div>
        ) : review.status === "failed" ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 border border-dashed border-destructive/30 rounded-lg bg-destructive/5 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4 opacity-70" />
            <h3 className="text-xl font-semibold mb-2 text-destructive">Could Not Fetch Diff</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              {review.prUrl
                ? "No code diff was found for this PR. It may be an issue rather than a pull request, may have been deleted, or the repository is private."
                : "No diff content was provided for this review."}
            </p>
            <div className="space-y-3 w-full max-w-sm">
              <p className="text-sm font-medium text-foreground">To fix this:</p>
              <ol className="text-sm text-muted-foreground text-left space-y-1.5 list-decimal list-inside">
                <li>Go back and open the PR on GitHub</li>
                <li>Copy the diff manually (add <code className="bg-muted px-1 rounded">.diff</code> to the PR URL)</li>
                <li>Re-submit with the diff pasted in the text box</li>
              </ol>
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="outline" size="sm" onClick={handleReanalyze} disabled={reanalyzeReview.isPending}>
                  <RefreshCw className={`w-3 h-3 mr-1 ${reanalyzeReview.isPending ? "animate-spin" : ""}`} />
                  Retry
                </Button>
                <Link href="/submit">
                  <Button size="sm">Submit with diff</Button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="px-3 py-1 text-sm bg-card">Total: {review.totalFindings}</Badge>
              <Badge variant="outline" className={`px-3 py-1 text-sm ${review.criticalCount > 0 ? 'text-destructive border-destructive/50 bg-destructive/10' : ''}`}>
                Critical: {review.criticalCount}
              </Badge>
              <Badge variant="outline" className={`px-3 py-1 text-sm ${review.highCount > 0 ? 'text-orange-500 border-orange-500/50 bg-orange-500/10' : ''}`}>
                High: {review.highCount}
              </Badge>
              <Badge variant="outline" className={`px-3 py-1 text-sm ${review.mediumCount > 0 ? 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10' : ''}`}>
                Medium: {review.mediumCount}
              </Badge>
              <Badge variant="outline" className={`px-3 py-1 text-sm ${review.lowCount > 0 ? 'text-blue-400 border-blue-400/50 bg-blue-400/10' : ''}`}>
                Low: {review.lowCount}
              </Badge>
            </div>

            {review.findings.length === 0 ? (
              <div className="text-center p-12 border border-dashed border-border rounded-lg bg-card/30 text-green-500">
                <ShieldAlert className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold">LGTM!</h3>
                <p className="text-muted-foreground mt-2">No issues found. The code looks great.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {review.findings.map(finding => (
                  <Card key={finding.id} className="bg-card/50 border-border/50 overflow-hidden">
                    <CardHeader className="py-4 bg-muted/20 border-b border-border/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">{getSeverityIcon(finding.severity)}</div>
                          <div>
                            <CardTitle className="text-base font-semibold">{finding.title}</CardTitle>
                            <div className="flex items-center gap-2 mt-1.5 text-xs">
                              <Badge variant="outline" className={`uppercase text-[10px] py-0 border ${getSeverityColor(finding.severity)}`}>
                                {finding.severity}
                              </Badge>
                              <span className="text-muted-foreground uppercase tracking-wider">{finding.category.replace('_', ' ')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      {finding.filePath && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-md font-mono">
                          <TerminalSquare className="w-4 h-4" />
                          <span>{finding.filePath}</span>
                          {finding.lineNumber && <span className="text-primary">:{finding.lineNumber}</span>}
                        </div>
                      )}
                      
                      <div className="text-sm prose prose-invert max-w-none">
                        <p>{finding.description}</p>
                      </div>

                      {finding.codeSnippet && (
                        <div className="bg-[#1e1e1e] rounded-md p-4 overflow-x-auto border border-border/50">
                          <pre className="text-sm font-mono text-gray-300">
                            <code>{finding.codeSnippet}</code>
                          </pre>
                        </div>
                      )}

                      <div className="bg-primary/5 border border-primary/20 rounded-md p-4 mt-4">
                        <h5 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Suggestion</h5>
                        <p className="text-sm">{finding.suggestion}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Sidebar */}
      <div className="w-full lg:w-96 border-l border-border bg-card/30 flex flex-col h-screen lg:h-auto sticky top-0">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Review Assistant</h3>
        </div>
        
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            <div className="flex gap-3 text-sm">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted p-3 rounded-lg rounded-tl-none">
                I'm ready to answer any questions about this review. Ask me about specific findings or ask for code examples!
              </div>
            </div>

            {chatHistory?.map(msg => (
              <div key={msg.id} className={`flex gap-3 text-sm ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-secondary' : 'bg-primary/20'
                }`}>
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-primary" />}
                </div>
                <div className={`p-3 rounded-lg ${
                  msg.role === 'user' 
                    ? 'bg-primary text-primary-foreground rounded-tr-none' 
                    : 'bg-muted rounded-tl-none prose prose-invert max-w-none prose-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {streamingMessage && (
              <div className="flex gap-3 text-sm">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted p-3 rounded-lg rounded-tl-none prose prose-invert max-w-none prose-sm">
                  {streamingMessage}
                  <span className="inline-block w-1.5 h-4 ml-1 bg-primary animate-pulse align-middle" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-border bg-card">
          <form onSubmit={sendChat} className="flex gap-2">
            <Input 
              placeholder="Ask a question..." 
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              disabled={isStreaming}
              className="bg-background"
            />
            <Button type="submit" size="icon" disabled={!chatInput.trim() || isStreaming}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
