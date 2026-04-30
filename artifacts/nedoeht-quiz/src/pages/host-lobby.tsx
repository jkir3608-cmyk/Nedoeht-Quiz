import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useRequireAuth } from "@/hooks/use-auth";
import { useGetGame, useListPlayers, useStartGame } from "@workspace/api-client-react";
import { getGetGameQueryKey, getListPlayersQueryKey } from "@workspace/api-client-react";
import { useGameWebSocket } from "@/hooks/use-game";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Users, Play, Copy, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function HostLobby() {
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
    query: { 
      enabled: !!gameId, 
      queryKey: getListPlayersQueryKey(gameId),
      refetchInterval: 2000 // Fallback polling
    }
  });

  const startGame = useStartGame();

  const { messages, isConnected } = useGameWebSocket(gameId, "host");
  const [livePlayers, setLivePlayers] = useState<any[]>([]);

  // Sync initial players
  useEffect(() => {
    if (players) setLivePlayers(players);
  }, [players]);

  // Handle incoming websocket messages
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg.type === "player-joined") {
      setLivePlayers(prev => {
        if (prev.find(p => p.id === lastMsg.player.id)) return prev;
        return [...prev, lastMsg.player];
      });
      // Invalidate query to keep cache fresh
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(gameId) });
    } else if (lastMsg.type === "player-list") {
      setLivePlayers(lastMsg.players);
    }
  }, [messages, gameId, queryClient]);

  const handleStartGame = () => {
    startGame.mutate({ gameId }, {
      onSuccess: () => {
        setLocation(`/host/game/${gameId}`);
      },
      onError: (err) => {
        toast({ title: "Could not start game", description: err.message, variant: "destructive" });
      }
    });
  };

  const copyCode = () => {
    if (game?.code) {
      navigator.clipboard.writeText(game.code);
      toast({ title: "Code copied to clipboard!" });
    }
  };

  if (authLoading || gameLoading || !game) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 text-center">
      <div className="w-full max-w-5xl space-y-12">
        <div className="flex justify-between items-center w-full">
          <Button variant="ghost" asChild>
            <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" /> Exit</Link>
          </Button>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-sm font-medium text-muted-foreground">{isConnected ? 'Live' : 'Connecting...'}</span>
          </div>
        </div>

        <div className="bg-card border-2 border-primary/20 rounded-3xl p-12 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-secondary/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10 space-y-6">
            <h2 className="text-2xl font-bold text-muted-foreground">Join at <span className="text-primary">nedoeht-quiz.app/join</span> with code</h2>
            <div 
              className="text-8xl md:text-[150px] font-black tracking-widest text-primary drop-shadow-lg cursor-pointer hover:scale-105 transition-transform"
              onClick={copyCode}
            >
              {game.code}
            </div>
            
            <div className="flex items-center justify-center gap-4 text-lg font-medium text-muted-foreground">
              <span>Quiz: {game.quizTitle}</span>
              <span>•</span>
              <span>Skill/Luck Level: {game.skillLuckScale}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="text-left">
            <h3 className="text-2xl font-bold flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" /> 
              Waiting for players... 
              <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-lg">
                {livePlayers.length}
              </span>
            </h3>
          </div>
          
          <Button 
            size="lg" 
            className="text-xl h-16 px-12 font-bold shadow-[0_4px_0_0_hsl(var(--primary)/0.5)] active:shadow-none active:translate-y-1 transition-all"
            onClick={handleStartGame}
            disabled={startGame.isPending || livePlayers.length === 0}
          >
            <Play className="w-6 h-6 mr-2 fill-current" /> 
            {startGame.isPending ? "Starting..." : "Start Game"}
          </Button>
        </div>

        <div className="bg-card/50 border rounded-2xl p-6 min-h-[300px]">
          {livePlayers.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No players have joined yet. Tell them to enter the code above!
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 justify-center">
              <AnimatePresence>
                {livePlayers.map(player => (
                  <motion.div
                    key={player.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    className="px-6 py-3 rounded-xl text-lg font-bold shadow-md border-b-4 border-black/10"
                    style={{ backgroundColor: player.avatarColor || 'hsl(var(--primary))', color: 'white' }}
                  >
                    {player.nickname}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
