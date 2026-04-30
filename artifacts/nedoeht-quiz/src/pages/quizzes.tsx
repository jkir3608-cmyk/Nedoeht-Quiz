import { useState } from "react";
import { Link } from "wouter";
import { useRequireAuth } from "@/hooks/use-auth";
import { useListQuizzes, useListPublicQuizzes, useDeleteQuiz } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListQuizzesQueryKey } from "@workspace/api-client-react";
import { Play, Edit, Trash2, Plus, Globe, Lock, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
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

export default function Quizzes() {
  const { isLoading: authLoading } = useRequireAuth();
  const { data: myQuizzes, isLoading: myLoading } = useListQuizzes();
  const { data: publicQuizzes, isLoading: publicLoading } = useListPublicQuizzes();
  const deleteMutation = useDeleteQuiz();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
        </TabsContent>
      </Tabs>
    </div>
  );
}
