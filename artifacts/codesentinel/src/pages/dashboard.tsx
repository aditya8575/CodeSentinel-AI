import { useListReviews, useGetReviewStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { ShieldAlert, AlertTriangle, AlertCircle, Info, ArrowRight, FileCode, CheckCircle2, CircleDashed, PlusCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetReviewStats();
  const { data: reviews, isLoading: reviewsLoading } = useListReviews();

  const renderStats = () => {
    if (statsLoading) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (!stats) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50 hover:bg-card transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Reviews</CardTitle>
            <FileCode className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{stats.totalReviews}</div>
            <p className="text-xs text-muted-foreground mt-1">Processed analyses</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50 hover:bg-card transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical Findings</CardTitle>
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-destructive">{stats.criticalFindings}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires immediate action</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50 hover:bg-card transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Severity</CardTitle>
            <AlertTriangle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-orange-500">{stats.highFindings}</div>
            <p className="text-xs text-muted-foreground mt-1">Major issues detected</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50 hover:bg-card transition-colors">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Medium/Low</CardTitle>
            <Info className="w-4 h-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-blue-400">{stats.mediumFindings + stats.lowFindings}</div>
            <p className="text-xs text-muted-foreground mt-1">Improvements & optimizations</p>
          </CardContent>
        </Card>
      </div>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'analyzing': return <CircleDashed className="w-4 h-4 text-primary animate-spin" />;
      case 'pending': return <CircleDashed className="w-4 h-4 text-muted-foreground" />;
      case 'failed': return <AlertCircle className="w-4 h-4 text-destructive" />;
      default: return null;
    }
  };

  const getSeverityBadge = (count: number, label: string, colorClass: string) => {
    if (count === 0) return null;
    return (
      <Badge variant="outline" className={`flex items-center gap-1 font-mono text-xs ${colorClass}`}>
        {count} {label}
      </Badge>
    );
  };

  const renderRecentReviews = () => {
    if (reviewsLoading) {
      return (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      );
    }

    if (!reviews || reviews.length === 0) {
      return (
        <div className="text-center py-12 border border-dashed rounded-lg bg-card/30">
          <FileCode className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium">No reviews yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-2 mb-6">
            Submit your first pull request or code snippet for AI-powered analysis to get started.
          </p>
          <Link href="/submit">
            <Button>New Analysis</Button>
          </Link>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {reviews.map(review => (
          <Link key={review.id} href={`/reviews/${review.id}`}>
            <div className="group border border-border/50 bg-card/50 hover:bg-card p-4 rounded-lg transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  {getStatusIcon(review.status)}
                  <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {review.title}
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pl-7">
                  <span>{format(new Date(review.createdAt), 'MMM d, HH:mm')}</span>
                  {review.language && (
                    <>
                      <span>•</span>
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{review.language}</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 pl-7 sm:pl-0 flex-wrap">
                {review.status === 'failed' && (
                  <Badge variant="outline" className="text-destructive border-destructive/30">No diff</Badge>
                )}
                {review.status === 'completed' && review.totalFindings === 0 && (
                  <Badge variant="outline" className="text-green-500 border-green-500/30">Perfect</Badge>
                )}
                {getSeverityBadge(review.criticalCount, 'CRIT', 'text-destructive border-destructive/30')}
                {getSeverityBadge(review.highCount, 'HIGH', 'text-orange-500 border-orange-500/30')}
                {getSeverityBadge(review.mediumCount, 'MED', 'text-yellow-500 border-yellow-500/30')}
                <ArrowRight className="w-4 h-4 text-muted-foreground ml-2 opacity-0 group-hover:opacity-100 transition-opacity transform -translate-x-2 group-hover:translate-x-0" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of code quality metrics and recent analysis runs.</p>
      </div>

      {renderStats()}

      <div className="pt-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Recent Reviews</h2>
          <Link href="/submit">
            <Button size="sm" variant="outline" className="gap-2">
              <PlusCircle className="w-4 h-4" />
              New Review
            </Button>
          </Link>
        </div>
        
        {renderRecentReviews()}
      </div>
    </div>
  );
}
