import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Flame, Wallet, LogOut, Globe } from "lucide-react";

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { chains, switchChain } = useSwitchChain();

  const currentChain = chains.find((c) => c.id === chainId);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="border-white/10 bg-white/5 hover:bg-white/10">
              <Globe className="mr-2 h-4 w-4 text-primary" />
              {currentChain?.name ?? "Unknown Chain"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-white/10 text-white">
            {chains.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() => switchChain({ chainId: c.id })}
                className="cursor-pointer focus:bg-white/10"
              >
                {c.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="border-white/10 bg-white/5 hover:bg-white/10 font-mono">
              <Wallet className="mr-2 h-4 w-4 text-muted-foreground" />
              {address.slice(0, 6)}...{address.slice(-4)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-white/10 text-white">
            <DropdownMenuItem
              onClick={() => disconnect()}
              className="text-destructive focus:bg-destructive/10 cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_15px_rgba(255,69,0,0.5)] transition-all hover:shadow-[0_0_25px_rgba(255,69,0,0.7)]">
          <Wallet className="mr-2 h-4 w-4" />
          Connect Wallet
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-card border-white/10 text-white">
        {connectors.map((connector) => (
          <DropdownMenuItem
            key={connector.uid}
            onClick={() => connect({ connector })}
            className="cursor-pointer focus:bg-white/10"
          >
            {connector.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
