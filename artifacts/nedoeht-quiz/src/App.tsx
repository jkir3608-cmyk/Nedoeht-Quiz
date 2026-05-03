import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Auth from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import Quizzes from "@/pages/quizzes";
import QuizEditor from "@/pages/quiz-editor";
import HostSetup from "@/pages/host-setup";
import HostLobby from "@/pages/host-lobby";
import HostGame from "@/pages/host-game";
import JoinGame from "@/pages/join-game";
import PlayGame from "@/pages/play-game";
import GameResults from "@/pages/game-results";
import GameModes from "@/pages/game-modes";
import AdminPanel from "@/pages/admin";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Auth} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/quizzes" component={Quizzes} />
        <Route path="/create" component={QuizEditor} />
        <Route path="/quiz/:quizId/edit" component={QuizEditor} />
        <Route path="/host/:quizId" component={HostSetup} />
        <Route path="/host/lobby/:gameId" component={HostLobby} />
        <Route path="/host/game/:gameId" component={HostGame} />
        <Route path="/join" component={JoinGame} />
        <Route path="/play/:gameId/:playerId" component={PlayGame} />
        <Route path="/results/:gameId" component={GameResults} />
        <Route path="/modes" component={GameModes} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
