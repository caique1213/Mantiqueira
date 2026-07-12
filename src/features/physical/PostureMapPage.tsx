import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { PostureMap } from './PostureMap';
import { fetchPostureMap } from './physical.api';
import type { PhysicalLayer, PostureMapMode } from './types';
import styles from './physical-pages.module.css';

export function PostureMapPage() {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['posture-map'], queryFn: fetchPostureMap });
  const [mode, setMode] = useState<PostureMapMode>('work-orders');
  const [layer, setLayer] = useState<PhysicalLayer>('all');

  return (
    <div className={styles.mapPage}>
      <PageHeader
        eyebrow="ESTRUTURA FÍSICA"
        title="Mapa das 48 posturas"
        description="A disposição abaixo reproduz o espaço real. Os vazios físicos e as posturas 46–48 permanecem exatamente nas posições oficiais."
        meta={
          <span className={styles.mapMeta}>
            <Info /> 60 posições visuais · 48 posturas · 12 vazios
          </span>
        }
      />

      <PostureMap
        postures={query.data?.postures ?? []}
        state={query.isLoading ? 'loading' : query.isError ? 'error' : 'ready'}
        {...(query.error ? { errorMessage: query.error.message } : {})}
        mode={mode}
        onModeChange={setMode}
        selectedLayer={layer}
        onSelectedLayerChange={setLayer}
        availableBrands={query.data?.availableBrands ?? []}
        onPostureSelect={(number) => navigate(`/posturas/${number}`)}
      />
    </div>
  );
}
