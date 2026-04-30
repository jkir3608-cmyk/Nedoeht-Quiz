import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  // Don't show navbar on game screens
  const isGameScreen = location.startsWith('/play') || location.startsWith('/join');

  return (
    <div className="min-h-screen w-full flex flex-col bg-background text-foreground selection:bg-primary/30">
      {!isGameScreen && (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-8">
            <Link href="/" className="flex items-center space-x-2">
              <span className="font-display text-xl font-bold tracking-tight text-primary">Nedoeht-Quiz</span>
            </Link>

            <nav className="flex items-center space-x-6 text-sm font-medium">
              {user ? (
                <>
                  <Link href="/dashboard" className="transition-colors hover:text-primary">Dashboard</Link>
                  <Link href="/quizzes" className="transition-colors hover:text-primary">Quizzes</Link>
                  <Button variant="ghost" onClick={() => logout()}>Logout</Button>
                  <Button asChild><Link href="/join">Join Game</Link></Button>
                </>
              ) : (
                <>
                  <Link href="/login" className="transition-colors hover:text-primary">Login</Link>
                  <Button asChild><Link href="/login">Sign Up</Link></Button>
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
