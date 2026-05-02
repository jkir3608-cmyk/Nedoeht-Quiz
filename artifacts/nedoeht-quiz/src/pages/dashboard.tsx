import { Link } from "wouter";
import { useRequireAuth } from "@/hooks/use-auth";
import { useGetDashboardStats, useGetRecentGames, useListQuizzes } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Plus, BookOpen, Users, Activity, Clock, ShieldAlert, ChevronRight, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as [number,number,number,number] } }),
};

export default function Dashboard() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentGames, isLoading: gamesLoading } = useGetRecentGames();
  const { data: quizzes, isLoading: quizzesLoading } = useListQuizzes();

  if (authLoading) return null;

  return (
    <div className="relative min-h-screen">
      {/* Subtle ambient */}
      <div className="fixed inset-0 pointer-events-none bg-grid opacity-60" />
      <div className="fixed top-0 right-0 w-[500px] h-[400px] glow-orb bg-violet-600/10 pointer-events-none" />

      <div className="relative container py-8 max-w-screen-xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          custom={0} variants={fadeUp} initial="hidden" animate="show"
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Dashboard</p>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Welcome back, <span className="text-gradient-primary">{user?.displayName}</span>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Here's what's happening with your quizzes.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-primary">
              <Link href="/admin"><ShieldAlert className="w-3.5 h-3.5" /> Admin</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="border-border/60">
              <Link href="/quizzes">My Library</Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5 bg-gradient-to-r from-primary to-secondary border-0 shadow-md shadow-primary/25 hover:opacity-90 transition-all">
              <Link href="/create"><Plus className="w-3.5 h-3.5" /> Create Quiz</Link>
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          custom={1} variants={fadeUp} initial="hidden" animate="show"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard title="Total Quizzes"    value={stats?.totalQuizzes}       icon={BookOpen}  loading={statsLoading} gradient="from-violet-500 to-indigo-500"  glow="shadow-violet-500/20" />
          <StatCard title="Games Hosted"     value={stats?.totalGamesHosted}   icon={Play}      loading={statsLoading} gradient="from-pink-500 to-rose-500"     glow="shadow-pink-500/20" />
          <StatCard title="Total Questions"  value={stats?.totalQuestions}     icon={Activity}  loading={statsLoading} gradient="from-cyan-500 to-teal-500"     glow="shadow-cyan-500/20" />
          <StatCard title="Players Hosted"   value={stats?.totalPlayersHosted} icon={Users}     loading={statsLoading} gradient="from-amber-500 to-orange-500"  glow="shadow-amber-500/20" />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Quizzes */}
          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="show" className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Recent Quizzes</h2>
              <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-primary text-xs">
                <Link href="/quizzes">View All <ChevronRight className="w-3 h-3" /></Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quizzesLoading ? (
                Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
              ) : quizzes && quizzes.length > 0 ? (
                quizzes.slice(0, 4).map((quiz, i) => (
                  <motion.div
                    key={quiz.id}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    whileHover={{ y: -4 }}
                  >
                    <Card className="h-full flex flex-col card-glow border-border/60 bg-card/80 overflow-hidden">
                      <div className="h-1.5 w-full bg-gradient-to-r from-primary to-secondary" />
                      <CardHeader className="pb-2 pt-4">
                        <CardTitle className="line-clamp-1 text-base">{quiz.title}</CardTitle>
                        <CardDescription className="line-clamp-2 min-h-9 text-xs">{quiz.description || "No description"}</CardDescription>
                      </CardHeader>
                      <CardContent className="mt-auto flex items-center justify-between pt-2">
                        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/60">{quiz.questionCount} questions</span>
                        <div className="flex gap-1.5">
                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground">
                            <Link href={`/quiz/${quiz.id}/edit`}>Edit</Link>
                          </Button>
                          <Button asChild size="sm" className="h-7 text-xs px-2.5 bg-primary/90 hover:bg-primary">
                            <Link href={`/host/${quiz.id}`}>Host</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-2 p-10 text-center border-2 border-dashed border-border/60 rounded-2xl space-y-3">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                    <Zap className="w-7 h-7 text-primary" />
                  </div>
                  <p className="text-muted-foreground text-sm">No quizzes yet — create your first one!</p>
                  <Button asChild size="sm" className="gap-1.5 bg-gradient-to-r from-primary to-secondary border-0">
                    <Link href="/create"><Plus className="w-3.5 h-3.5" /> Create Quiz</Link>
                  </Button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Recent Games */}
          <motion.div custom={3} variants={fadeUp} initial="hidden" animate="show" className="space-y-4">
            <h2 className="text-lg font-bold">Recent Games</h2>

            <Card className="border-border/60 bg-card/80 overflow-hidden">
              <div className="h-1 w-full bg-gradient-to-r from-secondary to-accent" />
              <CardContent className="p-0 divide-y divide-border/50">
                {gamesLoading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="p-4"><Skeleton className="h-10 w-full" /></div>
                  ))
                ) : recentGames && recentGames.length > 0 ? (
                  recentGames.map((game) => (
                    <div key={game.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                      <div className="min-w-0">
                        <p className="font-medium line-clamp-1 text-sm group-hover:text-primary transition-colors">{game.quizTitle}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {game.playerCount}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(game.createdAt), "MMM d")}</span>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 ml-2 flex-shrink-0 border-border/60 hover:border-primary/50">
                        <Link href={`/results/${game.id}`}>Results</Link>
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No games hosted yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title, value, icon: Icon, loading, gradient, glow,
}: {
  title: string; value?: number; icon: any; loading: boolean; gradient: string; glow: string;
}) {
  return (
    <Card className="border-border/60 bg-card/80 card-glow overflow-hidden">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg ${glow} flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
          {loading ? (
            <Skeleton className="h-7 w-12 mt-1" />
          ) : (
            <p className="text-2xl font-extrabold stat-number">{value ?? 0}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
