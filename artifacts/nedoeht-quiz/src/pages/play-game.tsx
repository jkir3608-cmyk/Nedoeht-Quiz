import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { useGameWebSocket } from "@/hooks/use-game";
import {
  useGetGame,
  useListPlayers,
  useUpdatePlayer,
  useKickPlayer,
  getGetGameQueryKey,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Loader2, Check, X, ShieldAlert, Trash2, Clock } from "lucide-react";

const ADMIN_PASSWORD = "2026BIOlogy!";

function formatTime(seconds: number) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const OPTION_COLORS = [
  "bg-red-500 hover:bg-red-600 border-b-4 border-red-700 active:border-b-0 active:translate-y-1",
  "bg-blue-500 hover:bg-blue-600 border-b-4 border-blue-700 active:border-b-0 active:translate-y-1",
  "bg-yellow-500 hover:bg-yellow-600 border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1",
  "bg-green-500 hover:bg-green-600 border-b-4 border-green-700 active:border-b-0 active:translate-y-1",
];

const OPTION_SHAPES = ["▲", "◆", "●", "■"];

export default function PlayGame() {
  const params = useParams();
  const gameId = parseInt(params.gameId || "0");
  const playerId = parseInt(params.playerId || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: game, isLoading: gameLoading } = useGetGame(gameId, {
    query: { enabled: !!gameId, queryKey: getGetGameQueryKey(gameId) },
  });

  const { messages, isConnected, sendMessage } = useGameWebSocket(
    gameId,
    "player",
    playerId,
  );

  type GamePhase =
    | "waiting"
    | "question"
    | "answered"
    | "result-correct"
    | "result-wrong"
    | "chests"
    | "chest-opened"
    | "ended";

  const [phase, setPhase] = useState<GamePhase>("waiting");
  const [currentQuestion, setCurrentQuestion] = useState<{
    id: number;
    text: string;
    options: string[];
    timeLimit: number;
  } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [result, setResult] = useState<{
    correct: boolean;
    timedOut: boolean;
    coinsEarned: number;
    explanation: string;
    correctAnswer: number;
    correctAnswerText: string;
    rewardType: string;
  } | null>(null);
  const [chestResult, setChestResult] = useState<{
    reward: { label: string; coinsChange: number };
    newTotal: number;
    swapInfo: { withNickname: string; theirOldCoins: number; myOldCoins: number } | null;
  } | null>(null);
  const [swapNotification, setSwapNotification] = useState<{ swappedWith: string; yourOldCoins: number; yourNewCoins: number } | null>(null);
  const [coins, setCoins] = useState(0);
  const [questionTimer, setQuestionTimer] = useState(0);
  const [questionTimerMax, setQuestionTimerMax] = useState(30);
  const [wrongCountdown, setWrongCountdown] = useState(0);
  const [gameTimeRemaining, setGameTimeRemaining] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [chestsOpened, setChestsOpened] = useState(false);
  const [openedChestIdx, setOpenedChestIdx] = useState<number | null>(null);

  const questionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wrongCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Admin panel state
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [editingCoins, setEditingCoins] = useState<Record<number, string>>({});
  const [newTimerSecs, setNewTimerSecs] = useState("");

  const { data: players } = useListPlayers(gameId, {
    query: {
      queryKey: getListPlayersQueryKey(gameId),
      enabled: adminAuthed && adminOpen,
    },
  });
  const updatePlayer = useUpdatePlayer();
  const kickPlayer = useKickPlayer();

  const requestNextQuestion = useCallback(() => {
    sendMessage({ type: "request-question" });
    setPhase("waiting");
    setCurrentQuestion(null);
    setSelectedAnswer(null);
    setResult(null);
    setChestResult(null);
    setChestsOpened(false);
    setOpenedChestIdx(null);
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    if (wrongCountdownRef.current) clearInterval(wrongCountdownRef.current);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
  }, [sendMessage]);

  const startQuestionTimer = useCallback((timeLimit: number) => {
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    setQuestionTimer(timeLimit);
    setQuestionTimerMax(timeLimit);
    questionTimerRef.current = setInterval(() => {
      setQuestionTimer((prev) => {
        if (prev <= 1) {
          clearInterval(questionTimerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (questionTimer === 0 && phase === "question" && currentQuestion) {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
      setPhase("answered");
      sendMessage({
        type: "answer",
        questionId: currentQuestion.id,
        answerIndex: -1,
        timedOut: true,
        playerId,
      });
    }
  }, [questionTimer, phase, currentQuestion, sendMessage, playerId]);

  const startWrongCountdown = useCallback(() => {
    if (wrongCountdownRef.current) clearInterval(wrongCountdownRef.current);
    setWrongCountdown(5);
    wrongCountdownRef.current = setInterval(() => {
      setWrongCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(wrongCountdownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (endsAt) {
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      gameTimerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
        setGameTimeRemaining(remaining);
      }, 500);
      return () => {
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      };
    }
    return undefined;
  }, [endsAt]);

  useEffect(() => {
    if (messages.length === 0) return;
    const msg = messages[messages.length - 1];

    if (msg.type === "game-started") {
      setEndsAt((msg as any).endsAt);
      setGameTimeRemaining((msg as any).remainingSeconds);
      requestNextQuestion();
    } else if ((msg as any).type === "timer") {
      setGameTimeRemaining((msg as any).remaining);
      setEndsAt((msg as any).endsAt);
    } else if (msg.type === "question") {
      const q = (msg as any).question;
      setCurrentQuestion(q);
      setCoins((msg as any).playerCoins ?? coins);
      setPhase("question");
      setSelectedAnswer(null);
      setResult(null);
      startQuestionTimer(q.timeLimit ?? 30);
    } else if (msg.type === "answer-result") {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
      const r = msg as any;
      setResult({
        correct: r.correct,
        timedOut: r.timedOut ?? false,
        coinsEarned: r.coinsEarned,
        explanation: r.explanation,
        correctAnswer: r.correctAnswer,
        correctAnswerText: r.correctAnswerText,
        rewardType: r.rewardType,
      });
      setCoins(r.newTotal);
      if (r.correct) {
        setPhase("result-correct");
        autoAdvanceRef.current = setTimeout(() => {
          requestNextQuestion();
        }, 2500);
      } else {
        setPhase("result-wrong");
        startWrongCountdown();
      }
    } else if (msg.type === "show-chests") {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      setPhase("chests");
      setChestsOpened(false);
      setOpenedChestIdx(null);
      setChestResult(null);
      if (wrongCountdownRef.current) clearInterval(wrongCountdownRef.current);
    } else if (msg.type === "chest-result") {
      const r = msg as any;
      setChestResult({ reward: r.reward, newTotal: r.newTotal, swapInfo: r.swapInfo });
      setCoins(r.newTotal);
      setChestsOpened(true);
      setPhase("chest-opened");
      // No auto-advance — player must click Continue
    } else if ((msg as any).type === "coins-swapped") {
      const r = msg as any;
      setSwapNotification({ swappedWith: r.swappedWith, yourOldCoins: r.yourOldCoins, yourNewCoins: r.yourNewCoins });
      setCoins(r.yourNewCoins);
      setTimeout(() => setSwapNotification(null), 5000);
    } else if (msg.type === "game-ended") {
      setLocation(`/results/${gameId}`);
    } else if (msg.type === "player-kicked" && (msg as any).playerId === playerId) {
      toast({ title: "You were removed from the game", variant: "destructive" });
      setLocation("/");
    } else if (msg.type === "coins-updated" && (msg as any).playerId === playerId) {
      setCoins((msg as any).coins);
    }
  }, [messages, gameId, playerId, setLocation, toast, requestNextQuestion, startQuestionTimer, startWrongCountdown, coins]);

  const handleAnswer = (idx: number) => {
    if (phase !== "question" || !currentQuestion) return;
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    setSelectedAnswer(idx);
    setPhase("answered");
    sendMessage({
      type: "answer",
      questionId: currentQuestion.id,
      answerIndex: idx,
      timedOut: false,
      playerId,
    });
  };

  const handleOpenChest = (idx: number) => {
    if (phase !== "chests" || chestsOpened) return;
    setOpenedChestIdx(idx);
    sendMessage({ type: "open-chest", chestIndex: idx, playerId });
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === ADMIN_PASSWORD) {
      setAdminAuthed(true);
    } else {
      toast({ title: "Wrong password", variant: "destructive" });
      setAdminPassword("");
    }
  };

  const handleSaveCoins = (pid: number) => {
    const val = parseInt(editingCoins[pid] ?? "0");
    if (isNaN(val)) return;
    updatePlayer.mutate(
      { gameId, playerId: pid, data: { coins: val, adminPassword: ADMIN_PASSWORD } },
      {
        onSuccess: () => {
          toast({ title: "Coins updated" });
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });
          setEditingCoins((prev) => {
            const n = { ...prev };
            delete n[pid];
            return n;
          });
        },
        onError: () => toast({ title: "Failed", variant: "destructive" }),
      },
    );
  };

  const handleKick = (pid: number) => {
    kickPlayer.mutate(
      { gameId, playerId: pid },
      {
        onSuccess: () => {
          toast({ title: "Player removed" });
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });
        },
      },
    );
  };

  const handleAdjustTimer = (e: React.FormEvent) => {
    e.preventDefault();
    const secs = parseInt(newTimerSecs);
    if (isNaN(secs) || secs < 0) return;
    sendMessage({ type: "admin-adjust-timer", password: ADMIN_PASSWORD, newSeconds: secs });
    toast({ title: `Timer set to ${formatTime(secs)}` });
    setNewTimerSecs("");
  };

  if (gameLoading) return null;

  const timerColor =
    gameTimeRemaining === null
      ? "text-muted-foreground"
      : gameTimeRemaining > 60
      ? "text-green-400"
      : gameTimeRemaining > 20
      ? "text-yellow-400"
      : "text-red-400";

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-5 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary via-background to-background" />

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center px-4 py-3 bg-card/90 backdrop-blur border-b">
        <div className="font-bold text-primary truncate max-w-[160px]">{game?.quizTitle}</div>

        <div className="flex items-center gap-2">
          {gameTimeRemaining !== null && (
            <div className={`flex items-center gap-1 font-mono font-bold text-sm ${timerColor}`}>
              <Clock className="w-3.5 h-3.5" />
              {formatTime(gameTimeRemaining)}
            </div>
          )}

          <motion.div
            key={coins}
            initial={{ scale: 1.4 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-full border border-border"
          >
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="font-bold font-mono">{coins}</span>
          </motion.div>

          <button
            onClick={() => setAdminOpen(true)}
            className="p-2 rounded-full bg-card/80 border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all"
            title="Admin"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Coin Swap Alert Banner */}
      <AnimatePresence>
        {swapNotification && (
          <motion.div
            initial={{ opacity: 0, y: -80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -80 }}
            className="fixed top-0 inset-x-0 z-50 pointer-events-none flex justify-center"
          >
            <div className="mt-4 mx-4 bg-purple-600 text-white rounded-2xl shadow-2xl border-2 border-purple-400 px-6 py-4 flex items-center gap-4 max-w-sm">
              <div className="text-3xl">🔄</div>
              <div>
                <p className="font-black text-base leading-tight">Coin Swap!</p>
                <p className="text-sm text-purple-100">
                  <strong>{swapNotification.swappedWith}</strong> swapped coins with you!
                </p>
                <p className="text-sm text-purple-100">
                  {swapNotification.yourOldCoins} → <strong>{swapNotification.yourNewCoins}</strong> coins
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Dialog */}
      <Dialog open={adminOpen} onOpenChange={setAdminOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" /> Admin Panel
            </DialogTitle>
          </DialogHeader>

          {!adminAuthed ? (
            <form onSubmit={handleAdminAuth} className="space-y-4 py-2">
              <Input
                type="password"
                placeholder="Admin password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoFocus
              />
              <Button type="submit" className="w-full">Unlock</Button>
            </form>
          ) : (
            <div className="space-y-6 py-2">
              {/* Timer section */}
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Adjust Game Timer</p>
                <form onSubmit={handleAdjustTimer} className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Seconds (e.g. 120)"
                    value={newTimerSecs}
                    onChange={(e) => setNewTimerSecs(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit">Set</Button>
                </form>
                <div className="flex flex-wrap gap-2">
                  {[60, 120, 180, 300].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        sendMessage({ type: "admin-adjust-timer", password: ADMIN_PASSWORD, newSeconds: s });
                        toast({ title: `Timer set to ${formatTime(s)}` });
                      }}
                      className="px-3 py-1 rounded-full text-sm border border-border hover:border-primary/50 hover:text-primary transition-all"
                    >
                      {formatTime(s)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Players section */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">Players</p>
                {players && players.length > 0 ? (
                  [...players]
                    .sort((a, b) => b.coins - a.coins)
                    .map((p, idx) => (
                      <div
                        key={p.id}
                        className={`flex items-center gap-2 p-2 rounded-xl border ${p.isKicked ? "opacity-40" : "border-border"}`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                            idx === 0
                              ? "bg-yellow-500"
                              : idx === 1
                              ? "bg-gray-400"
                              : idx === 2
                              ? "bg-amber-700"
                              : "bg-muted-foreground"
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <span className="flex-1 font-semibold text-sm truncate">{p.nickname}</span>
                        <Coins className="w-3 h-3 text-yellow-400 shrink-0" />
                        <Input
                          type="number"
                          className="w-18 h-7 text-right text-sm"
                          value={editingCoins[p.id] ?? p.coins}
                          onChange={(e) =>
                            setEditingCoins((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          disabled={p.isKicked}
                        />
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => handleSaveCoins(p.id)}
                          disabled={
                            p.isKicked ||
                            editingCoins[p.id] === undefined ||
                            updatePlayer.isPending
                          }
                        >
                          Save
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => handleKick(p.id)}
                          disabled={p.isKicked}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))
                ) : (
                  <div className="text-center text-muted-foreground py-4 text-sm">No players</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {/* WAITING */}
          {phase === "waiting" && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-4"
            >
              <Loader2 className="w-14 h-14 animate-spin mx-auto text-primary" />
              <h2 className="text-2xl font-bold">
                {isConnected ? "Get Ready…" : "Connecting…"}
              </h2>
              <p className="text-muted-foreground">Waiting for the host to start the game</p>
            </motion.div>
          )}

          {/* QUESTION */}
          {(phase === "question" || phase === "answered") && currentQuestion && (
            <motion.div
              key={`question-${currentQuestion.id}`}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              className="w-full max-w-4xl flex flex-col gap-8"
            >
              {/* Circular timer */}
              <div className="flex justify-center">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="7" fill="transparent" className="text-muted" />
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      stroke="currentColor"
                      strokeWidth="7"
                      fill="transparent"
                      strokeDasharray="213.6"
                      strokeDashoffset={
                        213.6 - (213.6 * Math.max(0, questionTimer)) / Math.max(1, questionTimerMax)
                      }
                      className={`transition-all duration-1000 ease-linear ${
                        questionTimer > questionTimerMax * 0.5
                          ? "text-primary"
                          : questionTimer > questionTimerMax * 0.25
                          ? "text-yellow-400"
                          : "text-red-500"
                      }`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xl font-black">
                    {questionTimer}
                  </div>
                </div>
              </div>

              <h2 className="text-2xl md:text-4xl font-black text-center leading-tight">
                {currentQuestion.text}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentQuestion.options.map((option, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={phase === "question" ? { scale: 1.02 } : {}}
                    whileTap={phase === "question" ? { scale: 0.97 } : {}}
                    onClick={() => handleAnswer(idx)}
                    disabled={phase !== "question"}
                    className={`
                      relative p-5 rounded-2xl text-lg md:text-xl font-bold text-white
                      min-h-[100px] flex items-center justify-center text-center gap-3
                      transition-all duration-150
                      ${
                        phase === "answered"
                          ? selectedAnswer === idx
                            ? "opacity-100 scale-103 shadow-none"
                            : "opacity-40 grayscale cursor-not-allowed"
                          : OPTION_COLORS[idx % OPTION_COLORS.length]
                      }
                    `}
                  >
                    <span className="text-2xl opacity-60">{OPTION_SHAPES[idx]}</span>
                    {option}
                  </motion.button>
                ))}
              </div>

              {phase === "answered" && (
                <div className="text-center text-muted-foreground font-bold animate-pulse text-sm uppercase tracking-widest">
                  Submitting…
                </div>
              )}
            </motion.div>
          )}

          {/* RESULT CORRECT */}
          {phase === "result-correct" && result && (
            <motion.div
              key="result-correct"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-lg text-center space-y-6"
            >
              <div className="w-28 h-28 mx-auto rounded-full bg-green-500 shadow-2xl shadow-green-500/40 flex items-center justify-center">
                <Check className="w-14 h-14 text-white" />
              </div>
              <h2 className="text-5xl md:text-7xl font-black text-green-500">CORRECT!</h2>
              {result.coinsEarned > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl font-black text-yellow-400 flex items-center justify-center gap-2"
                >
                  +{result.coinsEarned} <Coins className="w-9 h-9" />
                </motion.div>
              )}
              <p className="text-muted-foreground text-sm animate-pulse uppercase tracking-widest">
                Next question in a moment…
              </p>
            </motion.div>
          )}

          {/* RESULT WRONG */}
          {phase === "result-wrong" && result && currentQuestion && (
            <motion.div
              key="result-wrong"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-xl text-center space-y-6"
            >
              <div className="w-28 h-28 mx-auto rounded-full bg-red-500 shadow-2xl shadow-red-500/40 flex items-center justify-center">
                {result.timedOut ? (
                  <Clock className="w-14 h-14 text-white" />
                ) : (
                  <X className="w-14 h-14 text-white" />
                )}
              </div>

              <h2 className="text-5xl md:text-7xl font-black text-red-500">
                {result.timedOut ? "TIME'S UP!" : "WRONG"}
              </h2>

              <Card className="bg-card/60 backdrop-blur border-border text-left">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Correct Answer
                    </span>
                    <p className="text-xl font-bold text-green-400 mt-1">
                      {result.correctAnswerText}
                    </p>
                  </div>
                  {result.explanation && (
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Explanation
                      </span>
                      <p className="text-base mt-1 leading-relaxed">{result.explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {wrongCountdown > 0 ? (
                <p className="text-muted-foreground font-bold text-sm uppercase tracking-widest">
                  Next question in {wrongCountdown}…
                </p>
              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Button
                    size="lg"
                    className="h-14 px-10 text-lg font-bold"
                    onClick={requestNextQuestion}
                  >
                    Next Question →
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* CHESTS */}
          {phase === "chests" && (
            <motion.div
              key="chests"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-3xl text-center space-y-8"
            >
              <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}>
                <div className="text-5xl mb-2">🎊</div>
                <h2 className="text-4xl md:text-6xl font-black text-primary">3 Correct!</h2>
                <p className="text-lg text-muted-foreground mt-2 font-medium">Pick a chest — your reward awaits!</p>
              </motion.div>

              <div className="grid grid-cols-3 gap-5">
                {/* Wooden chest */}
                <motion.button
                  initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
                  whileHover={{ scale: 1.07, y: -10 }} whileTap={{ scale: 0.93 }}
                  onClick={() => handleOpenChest(0)}
                  disabled={chestsOpened}
                  className="group relative aspect-square focus:outline-none"
                >
                  <div className="w-full h-full rounded-3xl flex flex-col items-center justify-center gap-2 p-4
                    bg-gradient-to-b from-amber-700 via-amber-800 to-amber-900
                    border-4 border-amber-600 shadow-2xl shadow-amber-900/60
                    group-hover:shadow-amber-600/40 transition-shadow">
                    <div className="text-5xl drop-shadow">🪵</div>
                    <div className="w-full h-1.5 bg-amber-600 rounded-full opacity-60" />
                    <span className="text-amber-200 font-black text-sm uppercase tracking-widest">Wood</span>
                  </div>
                </motion.button>

                {/* Iron chest */}
                <motion.button
                  initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.35 }}
                  whileHover={{ scale: 1.07, y: -10 }} whileTap={{ scale: 0.93 }}
                  onClick={() => handleOpenChest(1)}
                  disabled={chestsOpened}
                  className="group relative aspect-square focus:outline-none"
                >
                  <div className="w-full h-full rounded-3xl flex flex-col items-center justify-center gap-2 p-4
                    bg-gradient-to-b from-slate-400 via-slate-500 to-slate-700
                    border-4 border-slate-300 shadow-2xl shadow-slate-900/60
                    group-hover:shadow-slate-400/40 transition-shadow">
                    <div className="text-5xl drop-shadow">⚙️</div>
                    <div className="w-full h-1.5 bg-slate-300 rounded-full opacity-60" />
                    <span className="text-slate-100 font-black text-sm uppercase tracking-widest">Iron</span>
                  </div>
                </motion.button>

                {/* Gold chest */}
                <motion.button
                  initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}
                  whileHover={{ scale: 1.07, y: -10 }} whileTap={{ scale: 0.93 }}
                  onClick={() => handleOpenChest(2)}
                  disabled={chestsOpened}
                  className="group relative aspect-square focus:outline-none"
                >
                  <div className="w-full h-full rounded-3xl flex flex-col items-center justify-center gap-2 p-4
                    bg-gradient-to-b from-yellow-300 via-yellow-400 to-yellow-600
                    border-4 border-yellow-200 shadow-2xl shadow-yellow-500/60
                    group-hover:shadow-yellow-300/60 transition-shadow">
                    <div className="text-5xl drop-shadow">💛</div>
                    <div className="w-full h-1.5 bg-yellow-200 rounded-full opacity-60" />
                    <span className="text-yellow-900 font-black text-sm uppercase tracking-widest">Gold</span>
                  </div>
                </motion.button>
              </div>

              <p className="text-muted-foreground text-xs uppercase tracking-widest font-medium">
                All chests have the same random reward — pick any!
              </p>
            </motion.div>
          )}

          {/* CHEST OPENED */}
          {phase === "chest-opened" && chestResult && (
            <motion.div
              key="chest-opened"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="w-full max-w-lg text-center space-y-5"
            >
              <motion.div
                animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="text-8xl"
              >
                🎁
              </motion.div>

              <div className="space-y-2">
                <h2 className={`text-3xl md:text-4xl font-black ${chestResult.reward.coinsChange >= 0 ? "text-primary" : "text-red-400"}`}>
                  {chestResult.reward.label}
                </h2>

                {chestResult.reward.coinsChange !== 0 && (
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
                    className={`text-5xl font-black flex items-center justify-center gap-2 ${
                      chestResult.reward.coinsChange > 0 ? "text-yellow-400" : "text-red-400"
                    }`}
                  >
                    {chestResult.reward.coinsChange > 0 ? "+" : ""}
                    {chestResult.reward.coinsChange}
                    <Coins className="w-10 h-10" />
                  </motion.div>
                )}

                {chestResult.swapInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 mt-3"
                  >
                    <p className="text-purple-300 font-bold text-base">
                      🔄 Coin swap with <strong className="text-white">{chestResult.swapInfo.withNickname}</strong>!
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You had {chestResult.swapInfo.myOldCoins} → now you have {chestResult.newTotal} coins
                    </p>
                  </motion.div>
                )}
              </div>

              <div className="bg-card/60 rounded-2xl border border-border px-6 py-4 flex items-center justify-center gap-3">
                <Coins className="w-7 h-7 text-yellow-400" />
                <span className="text-2xl font-black">{chestResult.newTotal}</span>
                <span className="text-muted-foreground font-medium">coins total</span>
              </div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <Button
                  size="lg"
                  className="h-14 px-12 text-lg font-black shadow-[0_4px_0_0_hsl(var(--primary)/0.5)] active:shadow-none active:translate-y-1 transition-all"
                  onClick={requestNextQuestion}
                >
                  Continue →
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
