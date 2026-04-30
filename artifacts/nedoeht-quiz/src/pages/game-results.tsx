import { Link, useParams } from "wouter";
import { useGetGame, useListPlayers } from "@workspace/api-client-react";
import { getGetGameQueryKey, getListPlayersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Trophy, Medal, Award, Home, Plus } from "lucide-react";
import confetti from "canvas-confetti";
import { useEffect } from "react";

export default function GameResults() {
  const params = useParams();
  const gameId = parseInt(params.gameId || "0");

  const { data: game, isLoading: gameLoading } = useGetGame(gameId, {
    query: { enabled: !!gameId, queryKey: getGetGameQueryKey(gameId) }
  });

  const { data: players, isLoading: playersLoading } = useListPlayers(gameId, {
    query: { enabled: !!gameId, queryKey: getListPlayersQueryKey(gameId) }
  });

  useEffect(() => {
    if (players && players.length > 0) {
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [players]);

  if (gameLoading || playersLoading) return null;

  const sortedPlayers = [...(players || [])].sort((a, b) => b.coins - a.coins);
  const top3 = sortedPlayers.slice(0, 3);
  const others = sortedPlayers.slice(3);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background flex flex-col items-center p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background z-0"></div>
      
      <div className="relative z-10 w-full max-w-4xl space-y-12 text-center">
        <div>
          <h1 className="text-5xl md:text-7xl font-black text-primary drop-shadow-lg mb-4">Final Results</h1>
          <p className="text-xl text-muted-foreground">{game?.quizTitle}</p>
        </div>

        {/* Podium */}
        <div className="flex justify-center items-end h-64 gap-2 md:gap-6 mt-12 mb-8">
          {/* 2nd Place */}
          {top3[1] && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="flex flex-col items-center w-24 md:w-32"
            >
              <div className="font-bold mb-2 truncate w-full text-center">{top3[1].nickname}</div>
              <div className="font-mono font-bold text-yellow-500 mb-2">{top3[1].coins}</div>
              <div className="w-full bg-gray-300 h-32 rounded-t-lg border-2 border-gray-400 flex justify-center pt-4 relative shadow-[inset_0_4px_10px_rgba(255,255,255,0.5)]">
                <Medal className="w-8 h-8 text-gray-500" />
                <div className="absolute bottom-4 font-black text-4xl text-gray-500/50">2</div>
              </div>
            </motion.div>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8, type: "spring" }}
              className="flex flex-col items-center w-28 md:w-40 z-10"
            >
              <div className="font-bold mb-2 text-xl truncate w-full text-center text-primary">{top3[0].nickname}</div>
              <div className="font-mono font-bold text-yellow-500 mb-2 text-xl">{top3[0].coins}</div>
              <div className="w-full bg-yellow-400 h-48 rounded-t-lg border-2 border-yellow-500 flex justify-center pt-4 relative shadow-[inset_0_4px_10px_rgba(255,255,255,0.5)]">
                <Trophy className="w-12 h-12 text-yellow-600" />
                <div className="absolute bottom-4 font-black text-6xl text-yellow-600/50">1</div>
              </div>
            </motion.div>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="flex flex-col items-center w-24 md:w-32"
            >
              <div className="font-bold mb-2 truncate w-full text-center">{top3[2].nickname}</div>
              <div className="font-mono font-bold text-yellow-500 mb-2">{top3[2].coins}</div>
              <div className="w-full bg-amber-600 h-24 rounded-t-lg border-2 border-amber-700 flex justify-center pt-4 relative shadow-[inset_0_4px_10px_rgba(255,255,255,0.3)]">
                <Award className="w-8 h-8 text-amber-800" />
                <div className="absolute bottom-4 font-black text-4xl text-amber-800/50">3</div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Other players list */}
        {others.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="max-w-2xl mx-auto space-y-2 mt-12"
          >
            {others.map((player, idx) => (
              <Card key={player.id} className="bg-card/50 border-border/50">
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground font-bold w-6">{idx + 4}</span>
                    <span className="font-bold">{player.nickname}</span>
                  </div>
                  <span className="font-mono font-bold text-yellow-500">{player.coins}</span>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="flex justify-center gap-4 mt-12 pt-8"
        >
          <Button asChild size="lg" className="h-14 px-8 text-lg font-bold gap-2">
            <Link href="/dashboard"><Home className="w-5 h-5" /> Back to Dashboard</Link>
          </Button>
          {game?.quizId && (
            <Button asChild variant="outline" size="lg" className="h-14 px-8 text-lg font-bold gap-2">
              <Link href={`/host/${game.quizId}`}><Plus className="w-5 h-5" /> Host Again</Link>
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
