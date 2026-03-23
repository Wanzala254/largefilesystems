import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import {
  RequireAdmin,
  RequireAuth,
  RequireGuest,
  RequireStaff,
  RoleHomeRedirect,
} from './components/RouteGuards'
import { DashboardWrapper } from './components/DashboardWrapper'
import Devices from './pages/Devices'
import DeviceDetails from './pages/DeviceDetails'
import ReportIssue from './pages/ReportIssue'
import Tickets from './pages/Tickets'
import NetworkSpeed from './pages/NetworkSpeed'
import Alerts from './pages/Alerts'
import Events from './pages/Events'
import Settings from './pages/Settings'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import ForgotPassword from './pages/ForgotPassword'
import AdminUsers from './pages/AdminUsers'
import Topology from './pages/Topology'
import AuditLogs from './pages/AuditLogs'
import Security from './pages/Security'
import TestDashboard from './pages/TestDashboard'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<RoleHomeRedirect />} />

        <Route
          path="/admin/dashboard"
          element={
            <RequireStaff>
              <DashboardWrapper />
            </RequireStaff>
          }
        />
        <Route
          path="/user/dashboard"
          element={
            <RequireAuth>
              <DashboardWrapper />
            </RequireAuth>
          }
        />

        <Route
          path="/devices"
          element={
            <RequireStaff>
              <Devices />
            </RequireStaff>
          }
        />
        <Route
          path="/devices/:id"
          element={
            <RequireStaff>
              <DeviceDetails />
            </RequireStaff>
          }
        />
        <Route
          path="/topology"
          element={
            <RequireStaff>
              <Topology />
            </RequireStaff>
          }
        />
        <Route
          path="/report"
          element={
            <RequireAuth>
              <ReportIssue />
            </RequireAuth>
          }
        />
        <Route
          path="/speed"
          element={
            <RequireAuth>
              <NetworkSpeed />
            </RequireAuth>
          }
        />
        <Route
          path="/alerts"
          element={
            <RequireStaff>
              <Alerts />
            </RequireStaff>
          }
        />
        <Route
          path="/events"
          element={
            <RequireAuth>
              <Events />
            </RequireAuth>
          }
        />
        <Route
          path="/tickets"
          element={
            <RequireStaff>
              <Tickets />
            </RequireStaff>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <RequireAdmin>
              <AuditLogs />
            </RequireAdmin>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAdmin>
              <Settings />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAdmin>
              <AdminUsers />
            </RequireAdmin>
          }
        />
        <Route
          path="/security"
          element={
            <RequireStaff>
              <Security />
            </RequireStaff>
          }
        />

        <Route
          path="/test-dashboard"
          element={<TestDashboard />}
        />
        <Route
          path="/login"
          element={
            <RequireGuest>
              <Login />
            </RequireGuest>
          }
        />
        <Route
          path="/signup"
          element={
            <RequireGuest>
              <SignUp />
            </RequireGuest>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <RequireGuest>
              <ForgotPassword />
            </RequireGuest>
          }
        />
        <Route path="*" element={<RoleHomeRedirect />} />
      </Routes>
    </Layout>
  )
}

export default App
