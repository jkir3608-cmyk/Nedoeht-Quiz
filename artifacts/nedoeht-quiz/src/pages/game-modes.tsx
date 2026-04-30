import { useRequireAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function GameModes() {
  useRequireAuth();
  
  return (
    <div className="container max-w-5xl py-12 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Game Modes</h1>
          <p className="text-muted-foreground mt-2 text-lg">Choose how your students will compete.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/quizzes">Back to Quizzes</Link>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-6 border-2 border-primary rounded-xl bg-card shadow-lg relative overflow-hidden group">
          <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Recommended</div>
          <h3 className="text-2xl font-bold mb-2">Coin Quest</h3>
          <p className="text-muted-foreground mb-6">Answer 3 questions correctly to unlock treasure chests filled with coins!</p>
          <Button className="w-full">Select Mode</Button>
        </div>
        
        {["Tower Defense", "Factory", "Gold Rush", "Battle Royale"].map((mode) => (
          <div key={mode} className="p-6 border border-border rounded-xl bg-muted/30 opacity-70 relative">
            <div className="absolute top-4 right-4 bg-background px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1">Locked</div>
            <h3 className="text-2xl font-bold mb-2">{mode}</h3>
            <p className="text-muted-foreground mb-6">Premium mode. Answer questions to progress in {mode}.</p>
            <Button variant="secondary" className="w-full" disabled>Premium Only</Button>
          </div>
        ))}
      </div>
    </div>
  );
}