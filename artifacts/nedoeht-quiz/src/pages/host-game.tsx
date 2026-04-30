import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useRequireAuth } from "@/hooks/use-auth";
import { useGetGame, useEndGame, useListPlayers, useKickPlayer, useUpdatePlayer } from "@workspace/api-client-react";
import { getGetGameQueryKey, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useGameWebSocket } from "@/hooks/use-game";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Users, StopCircle, ArrowRight, ShieldAlert, Trash2 } from "lucide-react";

export default function HostGame() {
  const { isLoading: authLoading } = useRequireAuth();
  const params = useParams();
  const gameId = parseInt(params.gameId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: game, isLoading: gameLoading } = useGetGame(gameId, {
    query: { enabled: !!gameId, queryKey: getGetGameQueryKey(gameId) }
  });

  const { data: players, isLoading: playersLoading } = useListPlayers(gameId, {
    query: { enabled: !!gameId, queryKey: getListPlayersQueryKey(gameId) }
  });

  const endGame = useEndGame();
  const kickPlayer = useKickPlayer();
  const updatePlayer = useUpdatePlayer();

  const { messages, isConnected, sendMessage } = useGameWebSocket(gameId, "host");
  
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeLimit, setTimeLimit] = useState(0);
  const [answersCount, setAnswersCount] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [explanation, setExplanation] = useState("");
  const [liveLeaderboard, setLiveLeaderboard] = useState<any[]>([]);
  
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminAuth, setIsAdminAuth] = useState(false);

  // Parse websocket messages
  useEffect(() => {
    if (messages.length === 0) return;
    const msg = messages[messages.length - 1];
    
    if (msg.type === "question") {
      setCurrentQuestion(msg.question);
      setQuestionIndex(msg.questionIndex);
      setTotalQuestions(msg.totalQuestions);
      setTimeLimit(msg.timeLimit);
      setTimeRemaining(msg.timeLimit);
      setShowResults(false);
      setAnswersCount(0);
    } else if (msg.type === "answer-result" && (msg as any).isHostBroadcast) {
      // Custom host broadcast we could imagine the server sending
      // Or we track answers from a specific "player-answered" event
    } else if (msg.type === "leaderboard") {
      setLiveLeaderboard(msg.players);
    } else if (msg.type === "game-ended") {
      setLocation(`/results/${gameId}`);
    } else if ((msg as any).type === "player-answered") {
      setAnswersCount(prev => prev + 1);
    } else if ((msg as any).type === "round-ended" || msg.type === "show-chests") {
      // Reveal answers
      setShowResults(true);
      if ((msg as any).correctAnswer !== undefined) {
        setCorrectAnswer((msg as any).correctAnswer);
        setExplanation((msg as any).explanation);
      }
    }
  }, [messages, gameId, setLocation]);

  // Timer
  useEffect(() => {
    if (timeRemaining > 0 && !showResults && currentQuestion) {
      const timer = setTimeout(() => setTimeRemaining(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && currentQuestion && !showResults) {
      // Auto advance or show results
      setShowResults(true);
      // In a real implementation we might need to tell server time is up
    }
  }, [timeRemaining, showResults, currentQuestion]);

  const handleNextQuestion = () => {
    sendMessage({ type: "next-question" });
  };

  const handleEndGame = () => {
    endGame.mutate({ gameId }, {
      onSuccess: () => setLocation(`/results/${gameId}`)
    });
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "2026BIOlogy!") {
      setIsAdminAuth(true);
      toast({ title: "Admin access granted" });
    } else {
      toast({ title: "Incorrect password", variant: "destructive" });
    }
  };

  const handleUpdateCoins = (playerId: number, coins: number) => {
    if (!isAdminAuth) return;
    sendMessage({ type: "admin-update-coins", playerId, coins, password: adminPassword });
    // Also use fallback hook just in case
    updatePlayer.mutate({ playerId, data: { coins, adminPassword } }, {
      onSuccess: () => {
        toast({ title: "Coins updated" });
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });
      }
    });
  };

  const handleKickPlayer = (playerId: number) => {
    if (!isAdminAuth) return;
    sendMessage({ type: "kick-player", playerId });
    kickPlayer.mutate({ playerId }, {
      onSuccess: () => {
        toast({ title: "Player kicked" });
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });
      }
    });
  };

  if (authLoading || gameLoading) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background flex flex-col">
      <div className="bg-card border-b p-4 flex justify-between items-center px-8">
        <div>
          <h2 className="text-xl font-bold">{game?.quizTitle}</h2>
          <p className="text-muted-foreground text-sm">Join Code: <span className="font-mono text-primary font-bold">{game?.code}</span></p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-lg font-bold bg-muted px-4 py-1 rounded-full">
            {questionIndex + 1} / {totalQuestions || '?'}
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 border-primary/50 text-primary hover:bg-primary/10">
                <ShieldAlert className="w-4 h-4" /> Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Admin Panel</DialogTitle>
                <DialogDescription>Modify player scores or kick players.</DialogDescription>
              </DialogHeader>
              
              {!isAdminAuth ? (
                <form onSubmit={handleAdminAuth} className="space-y-4 py-4">
                  <Input 
                    type="password" 
                    placeholder="Admin Password" 
                    value={adminPassword} 
                    onChange={e => setAdminPassword(e.target.value)} 
                  />
                  <Button type="submit" className="w-full">Authenticate</Button>
                </form>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                  {liveLeaderboard.length > 0 ? liveLeaderboard : players?.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div className="font-bold">{p.nickname}</div>
                      <div className="flex items-center gap-4">
                        <Input 
                          type="number" 
                          defaultValue={p.coins}
                          className="w-24 text-right"
                          onBlur={(e) => handleUpdateCoins(p.id, parseInt(e.target.value))}
                        />
                        <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleKickPlayer(p.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Button variant="destructive" onClick={handleEndGame} className="gap-2">
            <StopCircle className="w-4 h-4" /> End Game
          </Button>
        </div>
      </div>

      <div className="flex-1 flex p-8 gap-8 overflow-hidden">
        {/* Main Stage */}
        <div className="flex-1 flex flex-col bg-card rounded-3xl border-2 border-primary/20 p-8 shadow-2xl relative overflow-hidden">
          {currentQuestion ? (
            <>
              <div className="flex justify-between items-center mb-8">
                <div className="w-full max-w-xl">
                  <div className="flex justify-between text-sm font-bold mb-2 uppercase tracking-widest text-muted-foreground">
                    <span>Time Remaining</span>
                    <span>{timeRemaining}s</span>
                  </div>
                  <Progress value={(timeRemaining / timeLimit) * 100} className="h-3" />
                </div>
                <div className="flex items-center gap-2 font-bold text-xl">
                  <Users className="w-6 h-6 text-primary" />
                  <span>{answersCount} / {liveLeaderboard.length || players?.length || 0}</span>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-12">
                <h1 className="text-4xl md:text-5xl font-bold max-w-4xl leading-tight">
                  {currentQuestion.text}
                </h1>

                {showResults && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-2xl bg-muted/50 p-6 rounded-2xl border"
                  >
                    <h3 className="text-2xl font-bold text-green-500 mb-2">
                      {currentQuestion.options[correctAnswer ?? currentQuestion.correctAnswer]}
                    </h3>
                    {explanation && (
                      <p className="text-muted-foreground text-lg">{explanation}</p>
                    )}
                  </motion.div>
                )}

                {showResults && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Button size="lg" className="h-16 px-12 text-xl font-bold gap-3" onClick={handleNextQuestion}>
                      Next Question <ArrowRight className="w-6 h-6" />
                    </Button>
                  </motion.div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <h2 className="text-3xl font-bold text-muted-foreground animate-pulse">Waiting for game to start...</h2>
            </div>
          )}
        </div>

        {/* Leaderboard Sidebar */}
        <div className="w-80 bg-card rounded-3xl border p-6 flex flex-col">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            Leaderboard
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            <AnimatePresence>
              {(liveLeaderboard.length > 0 ? liveLeaderboard : players)?.sort((a:any, b:any) => b.coins - a.coins).map((player: any, idx: number) => (
                <motion.div 
                  key={player.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center justify-between p-3 rounded-xl border ${idx === 0 ? 'bg-primary/10 border-primary' : 'bg-muted/30'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-muted-foreground'}`}>
                      {idx + 1}
                    </div>
                    <span className="font-bold truncate max-w-[120px]">{player.nickname}</span>
                  </div>
                  <span className="font-bold font-mono text-primary">{player.coins}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
