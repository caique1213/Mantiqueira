import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardPlus,
  ClipboardList,
  Factory,
  CircleHelp,
  HardHat,
  Home,
  Map,
  MessageSquareWarning,
  Settings,
  Sparkles,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const iconRegistry: Record<string, LucideIcon> = {
  house: Home,
  home: Home,
  'clipboard-list': ClipboardList,
  'clipboard-plus': ClipboardPlus,
  map: Map,
  factory: Factory,
  boxes: Boxes,
  'chart-no-axes-combined': BarChart3,
  chart: BarChart3,
  settings: Settings,
  wrench: Wrench,
  zap: Zap,
  'hard-hat': HardHat,
  'message-square-warning': MessageSquareWarning,
  'circle-help': CircleHelp,
  sparkles: Sparkles,
  activity: Activity,
};

export function resolveModuleIcon(icon: string): LucideIcon {
  return iconRegistry[icon] ?? Wrench;
}
