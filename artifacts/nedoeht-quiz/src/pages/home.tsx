import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 text-center">
      <div className="max-w-2xl space-y-8">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-primary drop-shadow-sm">
          Learning Meets <span className="text-secondary">Competition</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
          The bold, energetic educational game platform where every answer counts. Join a game now or create your own to engage your students.
        </p>

        <div className="p-8 bg-card rounded-2xl border border-border shadow-xl space-y-6 max-w-md mx-auto relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/10 opacity-50 z-0"></div>
          <div className="relative z-10 space-y-4">
            <h2 className="text-2xl font-bold">Join a Game</h2>
            <Button asChild size="lg" className="w-full text-lg h-14 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_4px_0_0_hsl(var(--primary)/0.5)] active:shadow-none active:translate-y-1 transition-all">
              <Link href="/join">Enter Join Code</Link>
            </Button>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Teacher Login</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/login">Create Free Account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
