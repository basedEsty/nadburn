import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, X, Coins, Flame, Receipt, ExternalLink } from "lucide-react";
import { FireParticles } from "./FireParticles";
import { EXPLORER_TX } from "@/lib/constants";

export type ProgressStepType = "fee" | "approve" | "swap" | "burn";
export type ProgressStepStatus = "pending" | "active" | "success" | "failed";

export interface ProgressStep {
  id: string;
  type: ProgressStepType;
  label: string;
  status: ProgressStepStatus;
  detail?: string;
  txHash?: string;
}

interface BurnProgressProps {
  open: boolean;
  steps: ProgressStep[];
  onClose: () => void;
  finished: boolean;
  chainId: number;
}

const ICONS: Record<ProgressStepType, React.ComponentType<{ className?: string }>> = {
  fee: Receipt,
  approve: Check,
  swap: Coins,
  burn: Flame,
};

export function BurnProgress({ open, steps, onClose, finished, chainId }: BurnProgressProps) {
  const explorerBase = EXPLORER_TX[chainId];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="w-full max-w-md rounded-2xl bg-card border border-primary/30 shadow-[0_0_50px_rgba(168,85,247,0.25)] p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-white">
                {finished ? "Complete" : "Burning…"}
              </h3>
              <FireParticles size={36} count={10} />
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {steps.map((step) => {
                const Icon = ICONS[step.type];
                return (
                  <motion.div
                    key={step.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`relative flex items-center gap-3 p-3 rounded-xl border overflow-hidden ${
                      step.status === "active"
                        ? "border-primary/60 bg-primary/5"
                        : step.status === "success"
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : step.status === "failed"
                        ? "border-red-500/40 bg-red-500/5"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    {step.status === "active" && (
                      <motion.div
                        className="absolute inset-y-0 left-0 w-1 bg-primary"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                    )}
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${
                        step.status === "success"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : step.status === "failed"
                          ? "bg-red-500/20 text-red-300"
                          : step.status === "active"
                          ? "bg-primary/20 text-primary"
                          : "bg-white/5 text-muted-foreground"
                      }`}
                    >
                      {step.status === "active" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : step.status === "success" ? (
                        <Check className="w-4 h-4" />
                      ) : step.status === "failed" ? (
                        <X className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{step.label}</p>
                      {step.detail && (
                        step.txHash && explorerBase ? (
                          <a
                            href={`${explorerBase}${step.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:text-primary/80 underline-offset-2 hover:underline truncate inline-flex items-center gap-1"
                          >
                            {step.detail}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground truncate">{step.detail}</p>
                        )
                      )}
                    </div>
                    {step.status === "active" && step.type === "burn" && (
                      <FireParticles size={28} count={8} />
                    )}
                    {step.status === "success" && step.type === "burn" && (
                      <motion.div
                        initial={{ opacity: 1, scale: 0.6 }}
                        animate={{ opacity: 0, scale: 1.6, y: -10 }}
                        transition={{ duration: 0.9 }}
                      >
                        <FireParticles size={28} count={8} />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {finished && (
              <button
                onClick={onClose}
                className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium transition-colors"
              >
                Close
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
