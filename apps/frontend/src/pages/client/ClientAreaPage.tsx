import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ClientLayout from '@/components/client/ClientLayout';
import AppointmentsView from '@/components/client/AppointmentsView';
import BarbershopsView from '@/components/client/BarbershopsView';
import LoyaltyView from '@/components/client/LoyaltyView';
import ProfileView from '@/components/client/ProfileView';

export default function ClientAreaPage() {
  useEffect(() => {
    document.title = 'Minha área · Connect Barber';
  }, []);

  return (
    <ClientLayout>
      <Routes>
        <Route index element={<AppointmentsView />} />
        <Route path="barbearias" element={<BarbershopsView />} />
        <Route path="fidelidade/:clientId" element={<LoyaltyView />} />
        <Route path="perfil" element={<ProfileView />} />
        <Route path="*" element={<Navigate to="/cliente" replace />} />
      </Routes>
    </ClientLayout>
  );
}
