import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isGameScreen = location.startsWith('/play') || location.startsWith('/join');

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground selection:bg-primary/30">
      {!isGameScreen && (
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-8">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30 group-hover:shadow-primary/50 transition-shadow">
                <Zap className="w-4 h-4 text-white" fill="white" />
              </div>
              <span className="font-display text-lg font-bold tracking-tight">
                <span className="text-primary">Quizzy</span>
                <span className="text-foreground/80">Blast</span>
              </span>
            </Link>

            {/* Nav */}
            <nav className="flex items-center gap-1 text-sm font-medium">
              {user ? (
                <>
                  <Link href="/dashboard">
                    <span className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer">
                      Dashboard
                    </span>
                  </Link>
                  <Link href="/quizzes">
                    <span className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer">
                      Quizzes
                    </span>
                  </Link>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => logout()}>
                    Logout
                  </Button>
                  <Button asChild size="sm" className="ml-2 bg-gradient-to-r from-primary to-secondary text-white border-0 shadow-md shadow-primary/25 hover:shadow-primary/40 hover:opacity-90 transition-all">
                    <Link href="/join">Join Game</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <span className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer">
                      Login
                    </span>
                  </Link>
                  <Button asChild size="sm" className="ml-2 bg-gradient-to-r from-primary to-secondary text-white border-0 shadow-md shadow-primary/25 hover:shadow-primary/40 hover:opacity-90 transition-all">
                    <Link href="/login">Sign Up Free</Link>
                  </Button>
                </>
              )}
            </nav>
          </div>
        </header>
      )}
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
