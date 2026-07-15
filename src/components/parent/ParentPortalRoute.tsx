import { ParentLayout } from '@/components/parent/ParentLayout';
import { ParentPortalProvider } from '@/contexts/ParentPortalContext';
import { ParentPortal } from '@/pages/ParentPortal';

/** Portal familiar en layout dedicado (sin sidebar de staff) */
export function ParentPortalRoute() {
  return (
    <ParentPortalProvider>
      <ParentLayout>
        <ParentPortal />
      </ParentLayout>
    </ParentPortalProvider>
  );
}
