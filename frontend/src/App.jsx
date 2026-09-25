import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Shell from './Shell';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Pipeline from './pages/Pipeline';
import Contacts from './pages/Contacts';
import Notes from './pages/Notes';
import FollowUps from './pages/FollowUps';
import Team from './pages/Team';

function Private({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
      <Route path="/leads" element={<Private><Leads /></Private>} />
      <Route path="/pipeline" element={<Private><Pipeline /></Private>} />
      <Route path="/contacts" element={<Private><Contacts /></Private>} />
      <Route path="/notes" element={<Private><Notes /></Private>} />
      <Route path="/follow-ups" element={<Private><FollowUps /></Private>} />
      <Route path="/team" element={<Private><Team /></Private>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
