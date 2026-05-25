import { Link, useLocation } from "wouter";
import { Shield, Activity, LayoutDashboard, PlusCircle, BookOpen, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/submit", label: "Submit Review", icon: PlusCircle },
  ];

  const content = (
    <div className="flex h-full flex-col bg-card/50 border-r border-border">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary">
          <Shield className="w-6 h-6" />
          CodeSentinel
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (location.startsWith(item.href) && item.href !== "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}

        <div className="pt-2 border-t border-border/50 mt-2">
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <BookOpen className="w-5 h-5" />
            API Docs
          </a>
        </div>
      </nav>

      <div className="p-4 mt-auto">
        <div className="rounded-lg bg-muted/50 p-4 border border-border/50">
          <div className="flex items-center gap-2 mb-2 text-sm font-medium">
            <Activity className="w-4 h-4 text-green-500" />
            System Status
          </div>
          <p className="text-xs text-muted-foreground">All analysis engines operational. Ready for code.</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className={`hidden md:block w-64 h-screen sticky top-0 ${className}`}>
        {content}
      </aside>
      
      <div className="md:hidden p-4 flex items-center justify-between border-b border-border bg-card/50">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
          <Shield className="w-5 h-5" />
          CodeSentinel
        </Link>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            {content}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
