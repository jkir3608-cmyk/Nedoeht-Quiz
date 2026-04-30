import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useRequireAuth } from "@/hooks/use-auth";
import { useGetQuiz, useCreateGame } from "@workspace/api-client-react";
import { getGetQuizQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Play, Settings2 } from "lucide-react";
import { motion } from "framer-motion";

export default function HostSetup() {
  const { isLoading: authLoading } = useRequireAuth();
  const params = useParams();
  const quizId = parseInt(params.quizId || "0");
  const [, setLocation] = useLocation();
  
  const { data: quiz, isLoading: quizLoading } = useGetQuiz(quizId, {
    query: { enabled: !!quizId, queryKey: getGetQuizQueryKey(quizId) }
  });
  
  const createGame = useCreateGame();
  const [skillLuckScale, setSkillLuckScale] = useState(3);
  
  const handleCreateGame = () => {
    createGame.mutate({ data: { quizId, skillLuckScale } }, {
      onSuccess: (game) => {
        setLocation(`/host/lobby/${game.id}`);
      }
    });
  };

  if (authLoading || quizLoading) return null;

  return (
    <div className="container max-w-4xl py-12 space-y-8">
      <Button variant="ghost" asChild className="gap-2 -ml-4">
        <Link href="/quizzes"><ArrowLeft className="w-4 h-4" /> Back to Quizzes</Link>
      </Button>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-primary">Host Game</h1>
            <p className="text-muted-foreground mt-2 text-lg">Configure game settings for your class.</p>
          </div>
          
          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="bg-card border-b pb-4">
              <CardTitle>Selected Quiz</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold">{quiz?.title}</h2>
              <p className="text-muted-foreground mt-2">{quiz?.description || "No description"}</p>
              <div className="mt-4 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                {quiz?.questionCount} Questions
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-secondary/20 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Settings2 className="w-32 h-32" />
            </div>
            <CardHeader className="bg-card border-b pb-4 relative z-10">
              <CardTitle>Game Settings</CardTitle>
              <CardDescription>Adjust how points are awarded</CardDescription>
            </CardHeader>
            <CardContent className="pt-8 space-y-8 relative z-10">
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-lg">Skill vs. Luck Scale</span>
                  <span className="bg-muted px-3 py-1 rounded-full text-sm font-mono border">Level {skillLuckScale}</span>
                </div>
                
                <Slider
                  defaultValue={[skillLuckScale]}
                  max={5}
                  min={1}
                  step={1}
                  onValueChange={(vals) => setSkillLuckScale(vals[0])}
                  className="py-4"
                />
                
                <div className="flex justify-between text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  <span>Pure Skill (1)</span>
                  <span>Pure Luck (5)</span>
                </div>
                
                <div className="p-4 bg-muted/30 rounded-xl border border-border mt-4 h-24 flex items-center justify-center text-center text-sm text-muted-foreground">
                  {skillLuckScale === 1 && "Flat 10 coins per correct answer. Best for serious testing."}
                  {skillLuckScale === 2 && "Slight randomness in chest rewards. Mostly based on skill."}
                  {skillLuckScale === 3 && "Balanced mix. Chests have moderate variance."}
                  {skillLuckScale === 4 && "High variance in rewards. Anyone could win!"}
                  {skillLuckScale === 5 && "Pure chaos. Massive chest multipliers and losses possible."}
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  size="lg" 
                  className="w-full text-lg h-14 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_4px_0_0_hsl(var(--primary)/0.5)] active:shadow-none active:translate-y-1 transition-all gap-2"
                  onClick={handleCreateGame}
                  disabled={createGame.isPending}
                >
                  <Play className="w-5 h-5 fill-current" /> {createGame.isPending ? "Creating..." : "Create Game"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
