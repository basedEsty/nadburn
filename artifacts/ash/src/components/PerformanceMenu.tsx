import { Zap, Gauge, Battery } from "lucide-react";
import {
  getPerformanceLevel,
  setPerformanceLevel,
  useAnimationPrefs,
  type PerformanceLevel,
} from "@/lib/animation-prefs";

type Step = {
  level: PerformanceLevel;
  label: string;
  short: string;
  hint: string;
  Icon: typeof Zap;
};

const STEPS: Step[] = [
  {
    level: "high",
    label: "High",
    short: "Hi",
    hint: "All animations on",
    Icon: Zap,
  },
  {
    level: "medium",
    label: "Medium",
    short: "Md",
    hint: "Lighter — background paused",
    Icon: Gauge,
  },
  {
    level: "low",
    label: "Low",
    short: "Lo",
    hint: "Static — best for slow devices",
    Icon: Battery,
  },
];

export default function PerformanceMenu() {
  const prefs = useAnimationPrefs();
  const active = getPerformanceLevel(prefs);

  return (
    <div
      role="radiogroup"
      aria-label="Animation performance"
      className="inline-flex items-center rounded-full border border-violet-400/30 bg-zinc-900/80 p-0.5 shadow-[0_0_0_1px_rgba(167,139,250,0.08),0_4px_18px_-8px_rgba(167,139,250,0.4)] backdrop-blur"
    >
      {STEPS.map((step) => {
        const isActive = active === step.level;
        const Icon = step.Icon;
        return (
          <button
            key={step.level}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${step.label} — ${step.hint}`}
            title={`${step.label} · ${step.hint}`}
            onClick={() => setPerformanceLevel(step.level)}
            className={`group relative inline-flex items-center justify-center gap-1 rounded-full p-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all sm:px-2.5 sm:py-1.5 sm:text-xs ${
              isActive
                ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_2px_10px_rgba(168,85,247,0.55)]"
                : "text-white/55 hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{step.short}</span>
          </button>
        );
      })}
    </div>
  );
}
