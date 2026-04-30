import { Link } from "wouter";
import { useRequireAuth } from "@/hooks/use-auth";
import { useGetDashboardStats, useGetRecentGames, useListQuizzes } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Plus, BookOpen, Users, Activity, Clock, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function Dashboard() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: recentGames, isLoading: gamesLoading } = useGetRecentGames();
  const { data: quizzes, isLoading: quizzesLoading } = useListQuizzes();

  if (authLoading) return null;

  return (
    <div className="container py-8 max-w-screen-xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.displayName}</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your quizzes.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" className="gap-2 text-muted-foreground hover:text-primary">
            <Link href="/admin"><ShieldAlert className="w-4 h-4" /> Admin</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/quizzes">My Library</Link>
          </Button>
          <Button asChild className="gap-2">
            <Link href="/create"><Plus className="w-4 h-4" /> Create Quiz</Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Quizzes" 
          value={stats?.totalQuizzes} 
          icon={BookOpen} 
          loading={statsLoading} 
          color="text-primary" 
        />
        <StatCard 
          title="Games Hosted" 
          value={stats?.totalGamesHosted} 
          icon={Play} 
          loading={statsLoading} 
          color="text-secondary" 
        />
        <StatCard 
          title="Total Questions" 
          value={stats?.totalQuestions} 
          icon={Activity} 
          loading={statsLoading} 
          color="text-accent" 
        />
        <StatCard 
          title="Players Hosted" 
          value={stats?.totalPlayersHosted} 
          icon={Users} 
          loading={statsLoading} 
          color="text-green-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Quizzes */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Recent Quizzes</h2>
            <Button asChild variant="link" size="sm">
              <Link href="/quizzes">View All</Link>
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzesLoading ? (
              Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
            ) : quizzes && quizzes.length > 0 ? (
              quizzes.slice(0, 4).map((quiz) => (
                <motion.div key={quiz.id} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
                  <Card className="h-full flex flex-col hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="line-clamp-1">{quiz.title}</CardTitle>
                      <CardDescription className="line-clamp-2 min-h-10">{quiz.description || "No description"}</CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {quiz.questionCount} questions
                      </div>
                      <div className="flex gap-2">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/quiz/${quiz.id}/edit`}>Edit</Link>
                        </Button>
                        <Button asChild size="sm">
                          <Link href={`/host/${quiz.id}`}>Host</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="col-span-2 p-8 text-center border-2 border-dashed border-border rounded-xl">
                <p className="text-muted-foreground mb-4">You haven't created any quizzes yet.</p>
                <Button asChild>
                  <Link href="/create">Create Your First Quiz</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Games */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Recent Games</h2>
          </div>
          
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {gamesLoading ? (
                Array(3).fill(0).map((_, i) => <div key={i} className="p-4"><Skeleton className="h-12 w-full" /></div>)
              ) : recentGames && recentGames.length > 0 ? (
                recentGames.map((game) => (
                  <div key={game.id} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium line-clamp-1">{game.quizTitle}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {game.playerCount}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(game.createdAt), "MMM d")}</span>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
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
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, loading, color }: { title: string, value?: number, icon: any, loading: boolean, color: string }) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`p-3 rounded-xl bg-card border shadow-sm ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-16 mt-1" />
          ) : (
            <p className="text-3xl font-bold">{value || 0}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
