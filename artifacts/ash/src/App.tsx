import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { wagmiConfig } from "@/lib/wagmi";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import BurnerApp from "@/pages/BurnerApp";
import Navbar from "@/components/Navbar";
import EmberBackground from "@/components/EmberBackground";
import CustomCursor from "@/components/CustomCursor";

const queryClient = new QueryClient();

function Router() {
  return (
    <div className="relative min-h-screen flex flex-col font-sans selection:bg-primary/30">
      <EmberBackground />
      <CustomCursor />
      <Navbar />
      <main className="flex-1 relative z-10 flex flex-col">
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/app" component={BurnerApp} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          <Analytics />
        </TooltipProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
