import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useGameWebSocket } from "@/hooks/use-game";
import { useGetGame } from "@workspace/api-client-react";
import { getGetGameQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Loader2, Check, X, ArrowRight } from "lucide-react";

export default function PlayGame() {
  const params = useParams();
  const gameId = parseInt(params.gameId || "0");
  const playerId = parseInt(params.playerId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: game, isLoading: gameLoading } = useGetGame(gameId, {
    query: { enabled: !!gameId, queryKey: getGetGameQueryKey(gameId) }
  });

  const { messages, isConnected, sendMessage } = useGameWebSocket(gameId, "player", playerId);

  const [gameState, setGameState] = useState<"waiting" | "question" | "answered" | "result" | "chests">("waiting");
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeLimit, setTimeLimit] = useState(0);
  const [coins, setCoins] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [result, setResult] = useState<{correct: boolean, coinsEarned: number, explanation: string, correctAnswer: number} | null>(null);
  const [chestResult, setChestResult] = useState<{reward: number, newTotal: number} | null>(null);
  const [chestsOpened, setChestsOpened] = useState(false);

  // Handle incoming websocket messages
  useEffect(() => {
    if (messages.length === 0) return;
    const msg = messages[messages.length - 1];
    
    if (msg.type === "question") {
      setCurrentQuestion(msg.question);
      setQuestionIndex(msg.questionIndex);
      setTotalQuestions(msg.totalQuestions);
      setTimeLimit(msg.timeLimit);
      setTimeRemaining(msg.timeLimit);
      setGameState("question");
      setSelectedAnswer(null);
      setResult(null);
    } else if (msg.type === "answer-result") {
      setResult({
        correct: msg.correct,
        coinsEarned: msg.coinsEarned,
        explanation: msg.explanation,
        correctAnswer: msg.correctAnswer
      });
      setGameState("result");
    } else if (msg.type === "show-chests") {
      setGameState("chests");
      setChestsOpened(false);
      setChestResult(null);
    } else if (msg.type === "chest-result") {
      setChestResult({ reward: msg.reward, newTotal: msg.newTotal });
      setCoins(msg.newTotal);
      setChestsOpened(true);
    } else if (msg.type === "game-ended") {
      setLocation(`/results/${gameId}`);
    } else if (msg.type === "player-kicked" && msg.playerId === playerId) {
      toast({ title: "You were kicked from the game", variant: "destructive" });
      setLocation("/");
    } else if (msg.type === "coins-updated" && msg.playerId === playerId) {
      setCoins(msg.coins);
    } else if (msg.type === "game-started") {
      setGameState("waiting");
    }
  }, [messages, gameId, playerId, setLocation, toast]);

  // Timer
  useEffect(() => {
    if (timeRemaining > 0 && gameState === "question") {
      const timer = setTimeout(() => setTimeRemaining(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [timeRemaining, gameState]);

  const handleAnswer = (index: number) => {
    if (gameState !== "question") return;
    setSelectedAnswer(index);
    setGameState("answered");
    sendMessage({ type: "answer", questionIndex, answerIndex: index, playerId });
  };

  const handleOpenChest = (index: number) => {
    if (gameState !== "chests" || chestsOpened) return;
    sendMessage({ type: "open-chest", chestIndex: index, playerId });
  };

  const optionColors = [
    "bg-red-500 hover:bg-red-600 shadow-[0_6px_0_0_hsl(0,85%,40%)]",
    "bg-blue-500 hover:bg-blue-600 shadow-[0_6px_0_0_hsl(210,100%,40%)]",
    "bg-yellow-500 hover:bg-yellow-600 shadow-[0_6px_0_0_hsl(45,100%,40%)]",
    "bg-green-500 hover:bg-green-600 shadow-[0_6px_0_0_hsl(140,100%,30%)]"
  ];

  if (gameLoading) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/30 via-background to-background"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center p-4 md:p-6 bg-card/80 backdrop-blur-md border-b">
        <div className="font-bold text-lg md:text-xl text-primary drop-shadow-md">
          {game?.quizTitle}
        </div>
        
        <div className="flex items-center gap-4">
          {currentQuestion && (
            <div className="hidden md:block font-bold text-muted-foreground bg-muted px-4 py-1.5 rounded-full">
              Q: {questionIndex + 1} / {totalQuestions || '?'}
            </div>
          )}
          
          <motion.div 
            key={coins}
            initial={{ scale: 1.5, color: "hsl(var(--primary))" }}
            animate={{ scale: 1, color: "hsl(var(--foreground))" }}
            className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full border border-border"
          >
            <Coins className="w-5 h-5 text-yellow-500" />
            <span className="font-bold font-mono text-lg">{coins}</span>
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-4">
        <AnimatePresence mode="wait">
          
          {gameState === "waiting" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
              className="text-center space-y-6"
            >
              <Loader2 className="w-16 h-16 animate-spin mx-auto text-primary" />
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Get Ready!</h2>
              <p className="text-muted-foreground text-lg">Waiting for the host to start...</p>
            </motion.div>
          )}

          {(gameState === "question" || gameState === "answered") && currentQuestion && (
            <motion.div
              key="question"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="w-full max-w-4xl w-full flex flex-col h-full justify-center gap-8 py-8"
            >
              <div className="text-center space-y-8">
                {/* Circular Timer */}
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted" />
                    <circle 
                      cx="48" cy="48" r="44" 
                      stroke="currentColor" 
                      strokeWidth="8" 
                      fill="transparent" 
                      strokeDasharray="276"
                      strokeDashoffset={276 - (276 * timeRemaining) / timeLimit}
                      className="text-primary transition-all duration-1000 ease-linear" 
                    />
                  </svg>
                  <div className="absolute text-2xl font-bold">{timeRemaining}</div>
                </div>

                <h2 className="text-3xl md:text-5xl font-bold leading-tight">
                  {currentQuestion.text}
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mt-8">
                {currentQuestion.options.map((option: string, idx: number) => (
                  <motion.button
                    key={idx}
                    whileHover={gameState === "question" ? { scale: 1.02 } : {}}
                    whileTap={gameState === "question" ? { scale: 0.95 } : {}}
                    onClick={() => handleAnswer(idx)}
                    disabled={gameState !== "question"}
                    className={`
                      relative p-6 rounded-2xl text-xl md:text-2xl font-bold text-white transition-all min-h-[120px] flex items-center justify-center text-center
                      ${gameState === "answered" 
                        ? selectedAnswer === idx 
                          ? 'opacity-100 scale-105 shadow-none translate-y-2' 
                          : 'opacity-50 grayscale'
                        : optionColors[idx % optionColors.length]
                      }
                    `}
                  >
                    {option}
                  </motion.button>
                ))}
              </div>
              
              {gameState === "answered" && (
                <div className="text-center text-xl font-bold text-muted-foreground animate-pulse mt-8">
                  Waiting for others...
                </div>
              )}
            </motion.div>
          )}

          {gameState === "result" && result && currentQuestion && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-2xl text-center space-y-8"
            >
              <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center shadow-2xl ${result.correct ? 'bg-green-500 shadow-green-500/50' : 'bg-red-500 shadow-red-500/50'}`}>
                {result.correct ? <Check className="w-16 h-16 text-white" /> : <X className="w-16 h-16 text-white" />}
              </div>
              
              <div>
                <h2 className={`text-4xl md:text-6xl font-black mb-4 ${result.correct ? 'text-green-500' : 'text-red-500'}`}>
                  {result.correct ? 'CORRECT!' : 'INCORRECT'}
                </h2>
                
                {result.coinsEarned > 0 && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-3xl font-bold text-yellow-500 flex items-center justify-center gap-2"
                  >
                    +{result.coinsEarned} <Coins className="w-8 h-8" />
                  </motion.div>
                )}
              </div>
              
              <Card className="bg-card/50 backdrop-blur border-primary/20">
                <CardContent className="p-6 md:p-8 space-y-4 text-left">
                  {!result.correct && (
                    <div>
                      <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Correct Answer</span>
                      <p className="text-xl font-bold text-green-500 mt-1">{currentQuestion.options[result.correctAnswer]}</p>
                    </div>
                  )}
                  
                  {result.explanation && (
                    <div>
                      <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Explanation</span>
                      <p className="text-lg mt-1">{result.explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <p className="text-muted-foreground animate-pulse font-bold tracking-widest uppercase">
                Waiting for host...
              </p>
            </motion.div>
          )}

          {gameState === "chests" && (
            <motion.div
              key="chests"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-4xl text-center space-y-12"
            >
              <h2 className="text-4xl md:text-6xl font-black text-primary drop-shadow-lg">
                Choose a Chest!
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[0, 1, 2].map((idx) => (
                  <motion.div
                    key={idx}
                    whileHover={!chestsOpened ? { scale: 1.05, y: -10 } : {}}
                    whileTap={!chestsOpened ? { scale: 0.95 } : {}}
                    onClick={() => handleOpenChest(idx)}
                    className={`
                      relative cursor-pointer perspective-1000
                      ${chestsOpened ? (chestResult ? 'opacity-100' : 'opacity-50') : 'opacity-100'}
                    `}
                  >
                    <motion.div 
                      className="w-full aspect-square bg-gradient-to-br from-yellow-400 to-amber-700 rounded-3xl shadow-2xl flex flex-col items-center justify-center border-4 border-yellow-300 relative overflow-hidden"
                      animate={chestsOpened && chestResult ? { rotateY: 180 } : { rotateY: 0 }}
                      transition={{ duration: 0.6, type: "spring" }}
                    >
                      {/* Front of chest */}
                      <div className={`absolute inset-0 flex flex-col items-center justify-center backface-hidden ${chestsOpened ? 'hidden' : ''}`}>
                        <div className="w-16 h-8 bg-amber-900 rounded-t-full mb-2"></div>
                        <div className="w-20 h-12 bg-amber-800 border-4 border-yellow-500 flex items-center justify-center">
                          <div className="w-4 h-6 bg-black rounded-full"></div>
                        </div>
                      </div>
                      
                      {/* Back of chest (result) */}
                      <div className={`absolute inset-0 flex flex-col items-center justify-center bg-card backface-hidden transform rotate-y-180 border-4 border-primary rounded-2xl ${!chestsOpened ? 'hidden' : ''}`}>
                        {chestResult && (
                          <>
                            <span className="text-4xl font-black text-yellow-500 mb-2">
                              +{chestResult.reward}
                            </span>
                            <Coins className="w-12 h-12 text-yellow-500" />
                          </>
                        )}
                      </div>
                    </motion.div>
                  </motion.div>
                ))}
              </div>
              
              {chestsOpened && (
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="text-muted-foreground animate-pulse font-bold tracking-widest uppercase mt-8"
                >
                  Waiting for host...
                </motion.p>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
