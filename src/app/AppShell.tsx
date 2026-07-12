import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Command, Home, LogOut, Menu, Search, Wrench, X } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { IconButton } from '../components/ui/IconButton';
import { useAuth } from '../features/auth/AuthProvider';
import { GlobalSearchDialog } from '../features/search/GlobalSearchDialog';
import { fetchUnreadNotificationCount } from '../features/notifications/notifications.api';
import { NotificationAlertController } from '../features/notifications/NotificationAlertController';
import { PersonalPreferencesController } from '../features/profile/PersonalPreferencesController';
import { fetchAppBootstrap } from '../features/dashboard/dashboard.api';
import { resolveModuleIcon } from '../lib/ui-modules';
import styles from './app-shell.module.css';

interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: typeof Home;
}

const fallbackNavItems: NavItem[] = [
  { to: '/', label: 'Visão geral', shortLabel: 'Início', icon: Home },
];

export function AppShell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const bootstrap = useQuery({
    queryKey: ['app-bootstrap'],
    queryFn: fetchAppBootstrap,
    enabled: Boolean(auth.access),
  });
  const unreadNotifications = useQuery({
    queryKey: ['notifications-unread', auth.user?.id],
    queryFn: () => fetchUnreadNotificationCount(auth.user!.id),
    enabled: Boolean(auth.user?.id),
    refetchInterval: 30_000,
  });

  const visibleItems: NavItem[] = bootstrap.data?.modules.length
    ? bootstrap.data.modules.map((module) => ({
        to: module.route,
        label: module.label,
        shortLabel:
          module.slug === 'work-orders'
            ? 'OS'
            : module.slug === 'inventory'
              ? 'Ativos'
              : module.label,
        icon: resolveModuleIcon(module.icon),
      }))
    : fallbackNavItems;

  useEffect(() => {
    setDrawerOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  async function logout() {
    await auth.signOut();
    void navigate('/login');
  }

  return (
    <div className={styles.app}>
      <NotificationAlertController />
      <PersonalPreferencesController />
      <aside className={clsx(styles.sidebar, drawerOpen && styles.sidebarOpen)}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <Wrench />
          </span>
          <span className={styles.brandText}>
            <strong>{String(bootstrap.data?.settings['company.name'] ?? 'Mantiqueira')}</strong>
            <small>{String(bootstrap.data?.settings['system.name'] ?? 'Maintenance Hub')}</small>
          </span>
          <IconButton
            className={styles.drawerClose}
            label="Fechar menu"
            icon={<X />}
            onClick={() => setDrawerOpen(false)}
          />
        </div>

        <nav className={styles.navigation} aria-label="Navegação principal">
          <span className={styles.navLabel}>OPERAÇÃO</span>
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => clsx(styles.navLink, isActive && styles.navActive)}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.systemStatus}>
            <span className={styles.statusDot} />
            <span>
              <strong>Sistema conectado</strong>
              <small>Dados protegidos pelo Supabase</small>
            </span>
          </div>
        </div>
      </aside>

      {drawerOpen && (
        <button
          className={styles.backdrop}
          aria-label="Fechar menu"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div className={styles.workspace}>
        <header className={styles.header}>
          <div className={styles.headerStart}>
            <IconButton
              className={styles.menuButton}
              label="Abrir menu"
              icon={<Menu />}
              onClick={() => setDrawerOpen(true)}
            />
            <button
              className={styles.searchButton}
              type="button"
              onClick={() => setSearchOpen(true)}
            >
              <Search aria-hidden="true" />
              <span>Buscar postura, ativo ou OS...</span>
              <kbd>
                <Command /> K
              </kbd>
            </button>
          </div>

          <div className={styles.headerActions}>
            <span className={styles.notificationButton}>
              <IconButton
                label="Notificações"
                icon={<Bell />}
                onClick={() => navigate('/notificacoes')}
              />
              {(unreadNotifications.data ?? 0) > 0 && (
                <span
                  className={styles.notificationBadge}
                  aria-label={`${unreadNotifications.data} notificações não lidas`}
                >
                  {(unreadNotifications.data ?? 0) > 99 ? '99+' : unreadNotifications.data}
                </span>
              )}
            </span>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className={styles.userButton}>
                  <span className={styles.avatar}>
                    {(auth.access?.profile.display_name ?? auth.user?.email ?? 'U')
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                  <span className={styles.userCopy}>
                    <strong>{auth.access?.profile.display_name ?? 'Usuário'}</strong>
                    <small>{auth.access?.roles[0] ?? 'perfil'}</small>
                  </span>
                  <ChevronDown aria-hidden="true" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className={styles.userMenu} align="end" sideOffset={8}>
                  <DropdownMenu.Label>Conta</DropdownMenu.Label>
                  <DropdownMenu.Item onSelect={() => navigate('/perfil')}>
                    Meu perfil
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator />
                  <DropdownMenu.Item className={styles.dangerItem} onSelect={() => void logout()}>
                    <LogOut /> Sair
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>

        <main className={styles.content} id="conteudo-principal">
          <Outlet />
        </main>

        <nav className={styles.mobileNav} aria-label="Navegação móvel">
          {visibleItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  clsx(styles.mobileLink, isActive && styles.mobileActive)
                }
              >
                <Icon aria-hidden="true" />
                <span>{item.shortLabel}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <GlobalSearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
