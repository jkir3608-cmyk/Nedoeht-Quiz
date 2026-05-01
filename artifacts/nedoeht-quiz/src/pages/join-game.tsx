import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useGetGameByCode, useJoinGame } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { Link } from "wouter";

const codeSchema = z.object({
  code: z.string().length(6, "Code must be 6 characters").toUpperCase(),
});

const nameSchema = z.object({
  nickname: z.string().min(2, "Nickname must be at least 2 characters").max(15, "Nickname too long"),
});

export default function JoinGame() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState<"code" | "name">("code");
  const [gameId, setGameId] = useState<number | null>(null);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  
  const joinGame = useJoinGame();
  
  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  const nameForm = useForm<z.infer<typeof nameSchema>>({
    resolver: zodResolver(nameSchema),
    defaultValues: { nickname: "" },
  });

  const onCodeSubmit = async (data: z.infer<typeof codeSchema>) => {
    setIsCheckingCode(true);
    try {
      // In a real scenario we'd call the API client directly here, 
      // but since we only have hooks, we'll fetch manually to avoid breaking rules 
      // of hooks or we can rely on a query that gets enabled.
      // We will do a custom fetch since the hook is declarative.
      const res = await fetch(`/api/games/code/${data.code}`);
      if (!res.ok) throw new Error("Game not found");
      const game = await res.json();
      
      if (game.status !== "waiting") {
        toast({ title: "Game already in progress or ended", variant: "destructive" });
        return;
      }
      
      setGameId(game.id);
      setStep("name");
    } catch (err: any) {
      toast({ title: "Invalid game code", variant: "destructive" });
    } finally {
      setIsCheckingCode(false);
    }
  };

  const onNameSubmit = (data: z.infer<typeof nameSchema>) => {
    if (!gameId) return;
    
    joinGame.mutate({ 
      gameId, 
      data: { nickname: data.nickname } 
    }, {
      onSuccess: (player) => {
        setLocation(`/play/${gameId}/${player.id}`);
      },
      onError: (err) => {
        toast({ title: "Could not join game", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4 relative overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background z-0"></div>
      
      <div className="w-full max-w-sm z-10">
        <h1 className="text-4xl md:text-5xl font-black text-center tracking-tight text-primary drop-shadow-md mb-12">
          Nedoeht-Quiz
        </h1>
        
        <div className="relative h-64">
          <AnimatePresence mode="wait">
            {step === "code" && (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <Card className="border-primary/20 shadow-2xl bg-card/95 backdrop-blur-sm">
                  <CardContent className="pt-6">
                    <Form {...codeForm}>
                      <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-6">
                        <FormField
                          control={codeForm.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  placeholder="GAME CODE" 
                                  className="h-16 text-center text-2xl font-black tracking-widest uppercase" 
                                  {...field} 
                                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                />
                              </FormControl>
                              <FormMessage className="text-center" />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="submit" 
                          className="w-full h-14 text-xl font-bold gap-2 shadow-[0_4px_0_0_hsl(var(--primary)/0.5)] active:shadow-none active:translate-y-1 transition-all"
                          disabled={isCheckingCode}
                        >
                          {isCheckingCode ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-5 h-5" /> Enter</>}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "name" && (
              <motion.div
                key="name"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <Card className="border-secondary/20 shadow-2xl bg-card/95 backdrop-blur-sm">
                  <CardContent className="pt-6">
                    <Form {...nameForm}>
                      <form onSubmit={nameForm.handleSubmit(onNameSubmit)} className="space-y-6">
                        <FormField
                          control={nameForm.control}
                          name="nickname"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input 
                                  placeholder="Nickname" 
                                  className="h-16 text-center text-xl font-bold" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage className="text-center" />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="submit" 
                          className="w-full h-14 text-xl font-bold bg-secondary hover:bg-secondary/90 shadow-[0_4px_0_0_hsl(var(--secondary)/0.5)] active:shadow-none active:translate-y-1 transition-all"
                          disabled={joinGame.isPending}
                        >
                          {joinGame.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Go!"}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Admin corner button */}
      <Link href="/admin">
        <button className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-card/80 backdrop-blur border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all text-sm font-medium shadow-lg">
          <ShieldAlert className="w-4 h-4" />
          Admin
        </button>
      </Link>
    </div>
  );
}
