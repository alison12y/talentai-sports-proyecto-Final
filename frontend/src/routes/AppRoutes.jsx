import { Navigate, Route, Routes } from 'react-router-dom'

import MainLayout from '../layouts/MainLayout'
import AttendancePage from '../pages/AttendancePage'
import CategoriesPage from '../pages/CategoriesPage'
import CallUpsPage from '../pages/CallUpsPage'
import ClubsPage from '../pages/ClubsPage'
import CuotasPage from '../pages/CuotasPage'
import DashboardPage from '../pages/DashboardPage'
import EventsPage from '../pages/EventsPage'
import LoginPage from '../pages/LoginPage'
import MatchesPage from '../pages/MatchesPage'
import MembershipsPage from '../pages/MembershipsPage'
import ParentPortalPage from '../pages/ParentPortalPage'
import PlayersPage from '../pages/PlayersPage'
import PlayerStatsPage from '../pages/PlayerStatsPage'
import PhysicalEvolutionPage from '../pages/PhysicalEvolutionPage'
import TeamsPage from '../pages/TeamsPage'
import UsersPage from '../pages/UsersPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clubes" element={<ClubsPage />} />
        <Route path="/categorias" element={<CategoriesPage />} />
        <Route path="/equipos" element={<TeamsPage />} />
        <Route path="/jugadores" element={<PlayersPage />} />
        <Route path="/eventos" element={<EventsPage />} />
        <Route path="/convocatorias" element={<CallUpsPage />} />
        <Route path="/asistencias" element={<AttendancePage />} />
        <Route path="/partidos" element={<MatchesPage />} />
        <Route path="/estadisticas" element={<PlayerStatsPage />} />
        <Route path="/evolucion-fisica" element={<PhysicalEvolutionPage />} />
        <Route path="/usuarios" element={<UsersPage />} />
        <Route path="/roles-permisos" element={<MembershipsPage />} />
        <Route path="/cuotas" element={<CuotasPage />} />
        <Route path="/portal-padre" element={<ParentPortalPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default AppRoutes
