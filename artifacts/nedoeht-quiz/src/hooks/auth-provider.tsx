import { type ReactNode } from "react";
import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { AuthContext } from "./use-auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, refetch } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        refetch();
        setLocation("/");
      },
    });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}
