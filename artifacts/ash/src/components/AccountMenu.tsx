import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, User } from "lucide-react";

export default function AccountMenu() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="h-9 w-9 rounded-full bg-white/5 border border-white/10 animate-pulse" />
    );
  }

  if (!isAuthenticated) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={login}
        className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
      >
        <LogIn className="w-4 h-4 mr-1.5" />
        Sign in
      </Button>
    );
  }

  const name =
    user?.firstName ||
    user?.email?.split("@")[0] ||
    "Account";

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
        {user?.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt=""
            className="w-5 h-5 rounded-full object-cover"
          />
        ) : (
          <User className="w-4 h-4 text-primary" />
        )}
        <span className="text-sm text-white/90">{name}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={logout}
        title="Sign out"
        className="text-muted-foreground hover:text-white"
      >
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
}
