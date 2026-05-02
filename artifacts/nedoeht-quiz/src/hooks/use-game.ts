import { useEffect, useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "./use-auth";

// Basic hook to enforce authentication
export function useRequireAuth() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  return { user, isLoading };
}

// Hook for websocket game connection
export type GameMessage =
  | { type: "player-joined"; player: any }
  | { type: "player-list"; players: any[] }
  | { type: "game-started"; endsAt: number; remainingSeconds: number }
  | { type: "question"; question: any; playerCoins: number }
  | { type: "answer-result"; correct: boolean; timedOut: boolean; coinsEarned: number; rewardType: string; newTotal: number; explanation: string; correctAnswer: number; correctAnswerText: string }
  | { type: "show-chests" }
  | { type: "chest-result"; reward: any; newTotal: number; swapInfo: any }
  | { type: "coins-swapped"; yourOldCoins: number; yourNewCoins: number; swappedWith: string }
  | { type: "leaderboard"; players: any[] }
  | { type: "game-ended"; players: any[] }
  | { type: "player-kicked"; playerId: number }
  | { type: "coins-updated"; playerId: number; coins: number }
  | { type: "timer"; remaining: number; endsAt: number }
  | { type: "timer-adjusted"; newSeconds: number }
  | { type: "no-questions" }
  | { type: "error"; message: string }
  | { type: "pong" };

export function useGameWebSocket(gameId: number | string, role: "host" | "player", playerId?: number | string) {
  const [messages, setMessages] = useState<GameMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!gameId) return;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let url = `${protocol}//${window.location.host}/api/ws?gameId=${gameId}&role=${role}`;
    if (role === "player" && playerId) {
      url += `&playerId=${playerId}`;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // ping loop
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
      
      ws.addEventListener("close", () => clearInterval(pingInterval));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages((prev) => [...prev, data]);
      } catch (e) {
        console.error("Failed to parse ws message", e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Try to reconnect after a delay
      setTimeout(connect, 2000);
    };

    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [gameId, role, playerId]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (cleanup) cleanup();
    };
  }, [connect]);

  const sendMessage = useCallback((msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { messages, isConnected, sendMessage, setMessages };
}
