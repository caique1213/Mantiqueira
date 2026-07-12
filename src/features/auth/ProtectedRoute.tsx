import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageSkeleton } from '../../components/ui/Skeleton';
import { StatePanel } from '../../components/ui/StatePanel';
import { useAuth } from './AuthProvider';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.loading) return <PageSkeleton />;
  if (!auth.session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (auth.error && !auth.access) {
    return (
      <StatePanel
        kind={auth.error.kind === 'permission' ? 'permission' : 'error'}
        title={
          auth.error.kind === 'permission'
            ? 'Acesso não autorizado'
            : 'Não foi possível validar seu acesso'
        }
        description={auth.error.message}
        actionLabel="Tentar novamente"
        onAction={() => void auth.refreshAccess()}
      />
    );
  }
  if (auth.access && !auth.access.profile.active) {
    return (
      <StatePanel
        kind="permission"
        title="Usuário desativado"
        description="Seu acesso foi desativado. Procure um administrador para revisar sua conta."
      />
    );
  }
  return <Outlet />;
}

export function AdminRoute() {
  const auth = useAuth();
  if (!auth.hasAnyRole('administrador') && !auth.hasPermission('admin.access')) {
    return (
      <StatePanel
        kind="permission"
        title="Área administrativa"
        description="Seu perfil não possui permissão para acessar esta área."
      />
    );
  }
  return <Outlet />;
}
