import { Navigate, Route, Routes } from 'react-router-dom'

import MainLayout from '../layouts/MainLayout'
import ClubsPage from '../pages/ClubsPage'
import DashboardPage from '../pages/DashboardPage'
import LoginPage from '../pages/LoginPage'
import PlayersPage from '../pages/PlayersPage'
import TeamsPage from '../pages/TeamsPage'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clubes" element={<ClubsPage />} />
        <Route path="/equipos" element={<TeamsPage />} />
        <Route path="/jugadores" element={<PlayersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default AppRoutes
