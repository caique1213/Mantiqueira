import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Providers } from './Providers';
import { AppShell } from './AppShell';
import { AdminRoute, ProtectedRoute } from '../features/auth/ProtectedRoute';
import { LoginPage } from '../features/auth/LoginPage';
import { UpdatePasswordPage } from '../features/auth/UpdatePasswordPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { PageSkeleton } from '../components/ui/Skeleton';
import { NotFoundPage } from './SystemPages';

const WorkOrdersPage = lazy(() =>
  import('../features/work-orders/WorkOrdersPage').then((module) => ({
    default: module.WorkOrdersPage,
  })),
);
const NewWorkOrderPage = lazy(() =>
  import('../features/work-orders/NewWorkOrderPage').then((module) => ({
    default: module.NewWorkOrderPage,
  })),
);
const WorkOrderDetailPage = lazy(() =>
  import('../features/work-orders/WorkOrderDetailPage').then((module) => ({
    default: module.WorkOrderDetailPage,
  })),
);
const OperationalPanelsPage = lazy(() =>
  import('../features/work-orders/OperationalPanelsPage').then((module) => ({
    default: module.OperationalPanelsPage,
  })),
);
const FeedbackPage = lazy(() =>
  import('../features/feedback/FeedbackPage').then((module) => ({
    default: module.FeedbackPage,
  })),
);
const HelpPage = lazy(() =>
  import('../features/support/SupportPages').then((module) => ({ default: module.HelpPage })),
);
const ReleaseNotesPage = lazy(() =>
  import('../features/support/SupportPages').then((module) => ({
    default: module.ReleaseNotesPage,
  })),
);
const SystemStatusPage = lazy(() =>
  import('../features/support/SupportPages').then((module) => ({
    default: module.SystemStatusPage,
  })),
);
const AdministrationPage = lazy(() =>
  import('../features/admin/AdministrationPage').then((module) => ({
    default: module.AdministrationPage,
  })),
);
const PostureMapPage = lazy(() =>
  import('../features/physical/PostureMapPage').then((module) => ({
    default: module.PostureMapPage,
  })),
);
const PostureDetailPage = lazy(() =>
  import('../features/physical/PostureDetailPage').then((module) => ({
    default: module.PostureDetailPage,
  })),
);
const InventoryPage = lazy(() =>
  import('../features/inventory/InventoryPage').then((module) => ({
    default: module.InventoryPage,
  })),
);
const AssetDetailPage = lazy(() =>
  import('../features/inventory/AssetDetailPage').then((module) => ({
    default: module.AssetDetailPage,
  })),
);
const TechnicalModelDetailPage = lazy(() =>
  import('../features/inventory/TechnicalModelDetailPage').then((module) => ({
    default: module.TechnicalModelDetailPage,
  })),
);
const NotificationsPage = lazy(() =>
  import('../features/notifications/NotificationsPage').then((module) => ({
    default: module.NotificationsPage,
  })),
);
const ProfilePage = lazy(() =>
  import('../features/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const AnalyticsPage = lazy(() =>
  import('../features/analytics/AnalyticsPage').then((module) => ({
    default: module.AnalyticsPage,
  })),
);

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/update-password" element={<UpdatePasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route
              element={
                <Suspense fallback={<PageSkeleton />}>
                  <AppShell />
                </Suspense>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="ordens" element={<WorkOrdersPage />} />
              <Route path="ordens/nova" element={<NewWorkOrderPage />} />
              <Route path="ordens/:workOrderId" element={<WorkOrderDetailPage />} />
              <Route path="paineis/:panel" element={<OperationalPanelsPage />} />
              <Route path="mapa" element={<PostureMapPage />} />
              <Route path="posturas/:postureNumber" element={<PostureDetailPage />} />
              <Route path="inventario" element={<InventoryPage />} />
              <Route path="inventario/modelos/:modelId" element={<TechnicalModelDetailPage />} />
              <Route path="ativos/:assetId" element={<AssetDetailPage />} />
              <Route path="analises" element={<AnalyticsPage />} />
              <Route path="notificacoes" element={<NotificationsPage />} />
              <Route path="feedback" element={<FeedbackPage />} />
              <Route path="ajuda" element={<HelpPage />} />
              <Route path="novidades" element={<ReleaseNotesPage />} />
              <Route path="status" element={<SystemStatusPage />} />
              <Route path="perfil" element={<ProfilePage />} />
              <Route element={<AdminRoute />}>
                <Route path="administracao" element={<AdministrationPage />} />
              </Route>
              <Route path="404" element={<NotFoundPage />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </Providers>
  );
}
