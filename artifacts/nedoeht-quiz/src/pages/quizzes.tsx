import { useState, useCallback } from "react";
import { Link } from "wouter";
import { useRequireAuth } from "@/hooks/use-auth";
import { useListQuizzes, useListPublicQuizzes, useDeleteQuiz } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListQuizzesQueryKey } from "@workspace/api-client-react";
import { Play, Edit, Trash2, Plus, Globe, Lock, BookOpen, ShieldCheck, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const ADMIN_PASSWORD = "2026BIOlogy!";
const BASE = import.meta.env.BASE_URL;

type AdminQuiz = {
  id: number;
  title: string;
  description?: string | null;
  coverColor?: string | null;
  questionCount: number;
  playCount: number;
  realPlayCount: number;
  playCountOffset: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function Quizzes() {
  const { isLoading: authLoading } = useRequireAuth();
  const { data: myQuizzes, isLoading: myLoading } = useListQuizzes();
  const { data: publicQuizzes, isLoading: publicLoading } = useListPublicQuizzes();
  const deleteMutation = useDeleteQuiz();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Discover admin state
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [adminQuizzes, setAdminQuizzes] = useState<AdminQuiz[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [editingPlayCounts, setEditingPlayCounts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  if (authLoading) return null;

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ quizId: id }, {
      onSuccess: () => {
        toast({ title: "Quiz deleted" });
        queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey() });
      },
      onError: () => {
        toast({ title: "Failed to delete quiz", variant: "destructive" });
      }
    });
  };

  const fetchAdminQuizzes = async (password: string) => {
    setAdminLoading(true);
    try {
      const res = await fetch(`${BASE}api/quizzes/admin/public?password=${encodeURIComponent(password)}`);
      if (!res.ok) throw new Error("bad password");
      const data: AdminQuiz[] = await res.json();
      setAdminQuizzes(data);
      const initial: Record<number, string> = {};
      data.forEach((q) => { initial[q.id] = String(q.playCount); });
      setEditingPlayCounts(initial);
    } catch {
      setPasswordError(true);
      return false;
    } finally {
      setAdminLoading(false);
    }
    return true;
  };

  const handlePasswordSubmit = async () => {
    setPasswordError(false);
    const ok = await fetchAdminQuizzes(passwordInput);
    if (ok) {
      setAdminUnlocked(true);
      setShowPasswordPrompt(false);
      setPasswordInput("");
    }
  };

  const handleSavePlayCount = async (quizId: number) => {
    const raw = editingPlayCounts[quizId];
    const displayPlayCount = parseInt(raw, 10);
    if (isNaN(displayPlayCount) || displayPlayCount < 0) {
      toast({ title: "Please enter a valid number", variant: "destructive" });
      return;
    }
    setSavingId(quizId);
    try {
      const res = await fetch(`${BASE}api/quizzes/admin/set-play-count`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: ADMIN_PASSWORD, quizId, displayPlayCount }),
      });
      if (!res.ok) throw new Error("failed");
      const updated: AdminQuiz = await res.json();
      setAdminQuizzes((prev) =>
        prev.map((q) => (q.id === updated.id ? updated : q))
          .sort((a, b) => b.playCount - a.playCount)
      );
      setEditingPlayCounts((prev) => ({ ...prev, [updated.id]: String(updated.playCount) }));
      // Also invalidate the public list so normal users see the new count
      queryClient.invalidateQueries({ queryKey: ["listPublicQuizzes"] });
      toast({ title: "Play count updated" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="container py-8 max-w-screen-xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
          <p className="text-muted-foreground mt-1">Manage your library or discover new games.</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/create"><Plus className="w-4 h-4" /> Create Quiz</Link>
        </Button>
      </div>

      <Tabs defaultValue="my-library" className="w-full">
        <TabsList className="grid w-[400px] grid-cols-2">
          <TabsTrigger value="my-library">My Library</TabsTrigger>
          <TabsTrigger value="discover">Discover</TabsTrigger>
        </TabsList>
        
        <TabsContent value="my-library" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myLoading ? (
              Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)
            ) : myQuizzes && myQuizzes.length > 0 ? (
              myQuizzes.map((quiz) => (
                <motion.div key={quiz.id} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
                  <Card className="h-full flex flex-col hover:border-primary/50 transition-colors overflow-hidden">
                    <div 
                      className="h-12 w-full" 
                      style={{ backgroundColor: quiz.coverColor || "hsl(var(--primary))" }}
                    />
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="line-clamp-1">{quiz.title}</CardTitle>
                        {quiz.isPublic ? <Globe className="w-4 h-4 text-muted-foreground" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
                      </div>
                      <CardDescription className="line-clamp-2 min-h-10">{quiz.description || "No description"}</CardDescription>
                    </CardHeader>
                    <CardContent className="mt-auto pt-4 flex flex-col gap-4">
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>{quiz.questionCount} questions</span>
                        <span>{format(new Date(quiz.createdAt), "MMM d, yyyy")}</span>
                      </div>
                      <div className="flex gap-2 items-center justify-between">
                        <div className="flex gap-2">
                          <Button asChild size="sm" variant="secondary" className="gap-1">
                            <Link href={`/host/${quiz.id}`}><Play className="w-3 h-3" /> Host</Link>
                          </Button>
                          <Button asChild size="sm" variant="outline" className="gap-1">
                            <Link href={`/quiz/${quiz.id}/edit`}><Edit className="w-3 h-3" /> Edit</Link>
                          </Button>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this quiz?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the quiz and all its questions.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(quiz.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full p-12 text-center border-2 border-dashed border-border rounded-xl">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">No quizzes found</h3>
                <p className="text-muted-foreground mb-6">Create your first quiz to get started.</p>
                <Button asChild size="lg">
                  <Link href="/create">Create Quiz</Link>
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="discover" className="mt-6">
          {/* Admin bar */}
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-muted-foreground">
              {adminUnlocked ? (
                <span className="flex items-center gap-1.5 text-teal-400 font-medium">
                  <ShieldCheck className="w-4 h-4" /> Admin view active
                </span>
              ) : (
                "Public quizzes — sorted by most played"
              )}
            </p>
            {adminUnlocked ? (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-muted-foreground"
                onClick={() => { setAdminUnlocked(false); setAdminQuizzes([]); }}
              >
                <LogOut className="w-3.5 h-3.5" /> Exit admin
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => { setShowPasswordPrompt(true); setPasswordError(false); setPasswordInput(""); }}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Admin login
              </Button>
            )}
          </div>

          {/* Password prompt */}
          <AnimatePresence>
            {showPasswordPrompt && !adminUnlocked && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 p-4 border border-red-500/40 rounded-xl bg-red-500/5 flex flex-col gap-3"
              >
                <p className="text-sm font-semibold text-red-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Discover Admin Login
                </p>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Admin password"
                    value={passwordInput}
                    onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                    onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                    className={passwordError ? "border-destructive" : ""}
                  />
                  <Button onClick={handlePasswordSubmit} disabled={adminLoading}>
                    {adminLoading ? "..." : "Login"}
                  </Button>
                  <Button variant="ghost" onClick={() => setShowPasswordPrompt(false)}>Cancel</Button>
                </div>
                {passwordError && (
                  <p className="text-xs text-destructive">Incorrect password.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Admin view */}
          {adminUnlocked ? (
            <div className="space-y-3">
              {adminLoading ? (
                Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
              ) : adminQuizzes.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No public quizzes yet.</p>
              ) : (
                adminQuizzes.map((quiz) => (
                  <motion.div
                    key={quiz.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card"
                  >
                    <div
                      className="w-2 self-stretch rounded-full flex-shrink-0"
                      style={{ backgroundColor: quiz.coverColor || "#7C3AED" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold line-clamp-1">{quiz.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {quiz.questionCount} questions
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <span className="text-teal-400 font-mono">
                        Real: {quiz.realPlayCount} plays
                      </span>
                      <span className="text-emerald-400 font-mono">
                        Offset: +{quiz.playCountOffset}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <label className="text-xs text-muted-foreground">Displayed plays</label>
                        <Input
                          type="number"
                          min={0}
                          className="w-28 h-8 text-sm"
                          value={editingPlayCounts[quiz.id] ?? String(quiz.playCount)}
                          onChange={(e) =>
                            setEditingPlayCounts((prev) => ({ ...prev, [quiz.id]: e.target.value }))
                          }
                          onKeyDown={(e) => e.key === "Enter" && handleSavePlayCount(quiz.id)}
                        />
                      </div>
                      <Button
                        size="sm"
                        className="mt-4"
                        onClick={() => handleSavePlayCount(quiz.id)}
                        disabled={savingId === quiz.id}
                      >
                        {savingId === quiz.id ? "..." : "Save"}
                      </Button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          ) : (
            /* Normal public view */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicLoading ? (
                Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)
              ) : publicQuizzes && publicQuizzes.length > 0 ? (
                publicQuizzes.map((quiz) => (
                  <motion.div key={quiz.id} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
                    <Card className="h-full flex flex-col hover:border-primary/50 transition-colors overflow-hidden">
                      <div 
                        className="h-12 w-full" 
                        style={{ backgroundColor: quiz.coverColor || "hsl(var(--primary))" }}
                      />
                      <CardHeader className="pb-2">
                        <CardTitle className="line-clamp-1">{quiz.title}</CardTitle>
                        <CardDescription className="line-clamp-2 min-h-10">{quiz.description || "No description"}</CardDescription>
                      </CardHeader>
                      <CardContent className="mt-auto pt-4 flex flex-col gap-4">
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>{quiz.questionCount} questions</span>
                          <span>{quiz.playCount} plays</span>
                        </div>
                        <div className="flex gap-2">
                          <Button asChild size="sm" className="w-full gap-1">
                            <Link href={`/host/${quiz.id}`}><Play className="w-3 h-3" /> Host Game</Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full p-12 text-center border-2 border-dashed border-border rounded-xl">
                  <h3 className="text-xl font-bold mb-2">No public quizzes found</h3>
                  <p className="text-muted-foreground">Check back later or make one of your quizzes public!</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
