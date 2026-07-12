import {
  BarChart3,
  Boxes,
  ClipboardList,
  Factory,
  Home,
  Map,
  Settings,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

const iconRegistry: Record<string, LucideIcon> = {
  house: Home,
  home: Home,
  'clipboard-list': ClipboardList,
  map: Map,
  factory: Factory,
  boxes: Boxes,
  'chart-no-axes-combined': BarChart3,
  chart: BarChart3,
  settings: Settings,
  wrench: Wrench,
};

export function resolveModuleIcon(icon: string): LucideIcon {
  return iconRegistry[icon] ?? Wrench;
}
