import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useRequireAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useCreateQuiz, useUpdateQuiz, useGetQuiz, useListQuestions, 
  useCreateQuestion, useUpdateQuestion, useDeleteQuestion,
  useAiGenerateQuestions, useAiGenerateExplanation 
} from "@workspace/api-client-react";
import { getGetQuizQueryKey, getListQuestionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Save, Plus, ArrowLeft, Bot, Wand2, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const quizSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  coverColor: z.string().optional(),
  isPublic: z.boolean().default(false),
});

const questionSchema = z.object({
  text: z.string().min(1, "Question text is required"),
  options: z.array(z.string()).length(4, "Must have exactly 4 options"),
  correctAnswer: z.number().min(0).max(3),
  explanation: z.string().optional(),
  timeLimit: z.number().min(0).max(120).default(0),
  points: z.number().min(1).default(10),
});

export default function QuizEditor() {
  const { isLoading: authLoading } = useRequireAuth();
  const params = useParams();
  const quizId = params.quizId ? parseInt(params.quizId) : null;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quiz, isLoading: quizLoading } = useGetQuiz(quizId || 0, {
    query: { enabled: !!quizId, queryKey: getGetQuizQueryKey(quizId || 0) }
  });

  const { data: questions, isLoading: questionsLoading } = useListQuestions(quizId || 0, {
    query: { enabled: !!quizId, queryKey: getListQuestionsQueryKey(quizId || 0) }
  });

  const createQuiz = useCreateQuiz();
  const updateQuiz = useUpdateQuiz();
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();
  const aiGenerateQuestions = useAiGenerateQuestions();
  const aiGenerateExplanation = useAiGenerateExplanation();

  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [aiMaterial, setAiMaterial] = useState("");

  const quizForm = useForm<z.infer<typeof quizSchema>>({
    resolver: zodResolver(quizSchema),
    defaultValues: { title: "", description: "", coverColor: "hsl(var(--primary))", isPublic: false },
  });

  const qForm = useForm<z.infer<typeof questionSchema>>({
    resolver: zodResolver(questionSchema),
    defaultValues: { text: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "", timeLimit: 0, points: 10 },
  });

  useEffect(() => {
    if (quiz) {
      quizForm.reset({
        title: quiz.title,
        description: quiz.description || "",
        coverColor: quiz.coverColor || "hsl(var(--primary))",
        isPublic: quiz.isPublic,
      });
    }
  }, [quiz, quizForm]);

  useEffect(() => {
    if (activeQuestionId && questions) {
      const q = questions.find(q => q.id === activeQuestionId);
      if (q) {
        qForm.reset({
          text: q.text,
          options: [q.options[0]||"", q.options[1]||"", q.options[2]||"", q.options[3]||""],
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || "",
          timeLimit: q.timeLimit,
          points: q.points,
        });
      }
    } else {
      qForm.reset({ text: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "", timeLimit: 0, points: 10 });
    }
  }, [activeQuestionId, questions, qForm]);

  const onSaveQuiz = (data: z.infer<typeof quizSchema>) => {
    if (quizId) {
      updateQuiz.mutate({ quizId, data }, {
        onSuccess: () => {
          toast({ title: "Quiz updated" });
          queryClient.invalidateQueries({ queryKey: getGetQuizQueryKey(quizId) });
        }
      });
    } else {
      createQuiz.mutate({ data }, {
        onSuccess: (newQuiz) => {
          toast({ title: "Quiz created" });
          setLocation(`/quiz/${newQuiz.id}/edit`);
        }
      });
    }
  };

  const onSaveQuestion = (data: z.infer<typeof questionSchema>) => {
    if (!quizId) {
      toast({ title: "Save quiz first", variant: "destructive" });
      return;
    }
    
    if (activeQuestionId) {
      updateQuestion.mutate({ quizId, questionId: activeQuestionId, data }, {
        onSuccess: () => {
          toast({ title: "Question updated" });
          queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey(quizId) });
          setActiveQuestionId(null);
        }
      });
    } else {
      createQuestion.mutate({ quizId, data: { ...data, aiGenerated: false } }, {
        onSuccess: () => {
          toast({ title: "Question added" });
          queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey(quizId) });
          qForm.reset();
        }
      });
    }
  };

  const handleDeleteQuestion = (id: number) => {
    if (!quizId) return;
    deleteQuestion.mutate({ quizId, questionId: id }, {
      onSuccess: () => {
        toast({ title: "Question deleted" });
        if (activeQuestionId === id) setActiveQuestionId(null);
        queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey(quizId) });
      }
    });
  };

  const handleGenerateQuestions = () => {
    if (!aiMaterial || !quizId) {
      toast({ title: "Save the quiz first before generating questions", variant: "destructive" });
      return;
    }
    const existingQs = questions?.map(q => q.text) ?? [];
    aiGenerateQuestions.mutate({ data: { material: aiMaterial, count: 5, existingQuestions: existingQs } }, {
      onSuccess: (res) => {
        if (res.length) {
          Promise.all(res.map((q: any) => 
            createQuestion.mutateAsync({ quizId, data: { text: q.text, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation ?? "", timeLimit: 0, points: 10, aiGenerated: true } })
          )).then(() => {
            toast({ title: `${res.length} AI questions added!` });
            queryClient.invalidateQueries({ queryKey: getListQuestionsQueryKey(quizId) });
            setAiMaterial("");
          }).catch(() => {
            toast({ title: "Failed to save some questions", variant: "destructive" });
          });
        }
      },
      onError: () => {
        toast({ title: "AI generation failed — please try again", variant: "destructive" });
      }
    });
  };

  const handleGenerateExplanation = () => {
    const text = qForm.getValues("text");
    const options = qForm.getValues("options");
    const correctAnswer = qForm.getValues("correctAnswer");
    
    if (!text || options.some(o => !o)) {
      toast({ title: "Fill out question and options first", variant: "destructive" });
      return;
    }
    
    aiGenerateExplanation.mutate({ data: { questionText: text, options, correctAnswer } }, {
      onSuccess: (res) => {
        qForm.setValue("explanation", res.explanation);
        toast({ title: "Explanation generated" });
      }
    });
  };

  if (authLoading || (quizId && quizLoading)) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Sidebar - Questions List */}
      {quizId && (
        <div className="w-64 border-r border-border bg-card flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center">
            <h2 className="font-bold">Questions ({questions?.length || 0})</h2>
            <Button size="icon" variant="ghost" onClick={() => setActiveQuestionId(null)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {questions?.map((q, idx) => (
                <div 
                  key={q.id} 
                  className={`p-3 rounded-lg border text-sm cursor-pointer flex justify-between items-start group ${activeQuestionId === q.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                  onClick={() => setActiveQuestionId(q.id)}
                >
                  <div className="line-clamp-2 pr-4">{idx + 1}. {q.text}</div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(q.id); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main Content */}
      <ScrollArea className="flex-1 bg-background">
        <div className="p-8 max-w-3xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <Button variant="ghost" asChild className="gap-2 -ml-4">
              <Link href="/quizzes"><ArrowLeft className="w-4 h-4" /> Back to Quizzes</Link>
            </Button>
            {quizId && (
              <Button variant="outline" onClick={() => setIsAiSidebarOpen(!isAiSidebarOpen)} className="gap-2">
                <Bot className="w-4 h-4" /> AI Assistant
              </Button>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quiz Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...quizForm}>
                <form onSubmit={quizForm.handleSubmit(onSaveQuiz)} className="space-y-4">
                  <FormField
                    control={quizForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={quizForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl><Textarea {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center gap-4">
                    <FormField
                      control={quizForm.control}
                      name="isPublic"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel>Make Public</FormLabel>
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="ml-auto gap-2" disabled={createQuiz.isPending || updateQuiz.isPending}>
                      <Save className="w-4 h-4" /> Save Quiz
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {quizId && (
            <Card className="border-primary/50 shadow-lg">
              <CardHeader className="bg-card border-b pb-4">
                <CardTitle>{activeQuestionId ? 'Edit Question' : 'Add New Question'}</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <Form {...qForm}>
                  <form onSubmit={qForm.handleSubmit(onSaveQuestion)} className="space-y-6">
                    <FormField
                      control={qForm.control}
                      name="text"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-lg">Question Text</FormLabel>
                          <FormControl><Textarea className="text-lg" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[0, 1, 2, 3].map((index) => (
                        <FormField
                          key={index}
                          control={qForm.control}
                          name={`options.${index}` as const}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                qForm.watch("correctAnswer") === index 
                                  ? 'border-green-500 bg-green-500/10' 
                                  : 'border-border bg-background'
                              }`}>
                                <input 
                                  type="radio" 
                                  className="w-4 h-4 accent-green-500"
                                  name="correctAnswer" 
                                  checked={qForm.watch("correctAnswer") === index}
                                  onChange={() => qForm.setValue("correctAnswer", index)}
                                />
                                <span className={qForm.watch("correctAnswer") === index ? 'text-green-500 font-bold' : ''}>
                                  Option {index + 1} {qForm.watch("correctAnswer") === index && '(Correct)'}
                                </span>
                              </FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={qForm.control}
                        name="timeLimit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Time Limit</FormLabel>
                            <Select value={field.value.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="0">⏳ No limit</SelectItem>
                                <SelectItem value="5">5 seconds</SelectItem>
                                <SelectItem value="10">10 seconds</SelectItem>
                                <SelectItem value="15">15 seconds</SelectItem>
                                <SelectItem value="20">20 seconds</SelectItem>
                                <SelectItem value="30">30 seconds</SelectItem>
                                <SelectItem value="45">45 seconds</SelectItem>
                                <SelectItem value="60">60 seconds</SelectItem>
                                <SelectItem value="90">90 seconds</SelectItem>
                                <SelectItem value="120">2 minutes</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={qForm.control}
                        name="points"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Points Multiplier</FormLabel>
                            <Select value={field.value.toString()} onValueChange={(v) => field.onChange(parseInt(v))}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                <SelectItem value="10">Standard (10x)</SelectItem>
                                <SelectItem value="20">Double (20x)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={qForm.control}
                      name="explanation"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between items-center">
                            <FormLabel>Explanation (shown after answering)</FormLabel>
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs gap-1"
                              onClick={handleGenerateExplanation}
                              disabled={aiGenerateExplanation.isPending}
                            >
                              <Wand2 className="w-3 h-3" /> AI Generate
                            </Button>
                          </div>
                          <FormControl><Textarea {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full gap-2" size="lg" disabled={createQuestion.isPending || updateQuestion.isPending}>
                      <Save className="w-5 h-5" /> {activeQuestionId ? 'Update Question' : 'Add Question'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Right Sidebar - AI Assistant */}
      {isAiSidebarOpen && (
        <div className="w-80 border-l border-border bg-card flex flex-col">
          <div className="p-4 border-b border-border flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <h2 className="font-bold">AI Assistant</h2>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">Paste text, notes, or a wiki article below to automatically generate questions.</p>
            <Textarea 
              className="flex-1 resize-none" 
              placeholder="Paste source material here..."
              value={aiMaterial}
              onChange={(e) => setAiMaterial(e.target.value)}
            />
            <Button 
              className="w-full gap-2" 
              onClick={handleGenerateQuestions}
              disabled={!aiMaterial || aiGenerateQuestions.isPending}
            >
              {aiGenerateQuestions.isPending ? "Generating..." : <><Wand2 className="w-4 h-4" /> Generate Questions</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
