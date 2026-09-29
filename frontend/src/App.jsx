import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Shell from './Shell';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadDetail from './pages/LeadDetail';
import Pipeline from './pages/Pipeline';
import DealDetail from './pages/DealDetail';
import AccountDetail from './pages/AccountDetail';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
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
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/dashboard" element={<Private><Dashboard /></Private>} />
      <Route path="/leads" element={<Private><Leads /></Private>} />
      <Route path="/leads/:id" element={<Private><LeadDetail /></Private>} />
      <Route path="/pipeline" element={<Private><Pipeline /></Private>} />
      <Route path="/deals/:id" element={<Private><DealDetail /></Private>} />
      <Route path="/accounts/:id" element={<Private><AccountDetail /></Private>} />
      <Route path="/contacts" element={<Private><Contacts /></Private>} />
      <Route path="/contacts/:id" element={<Private><ContactDetail /></Private>} />
      <Route path="/notes" element={<Private><Notes /></Private>} />
      <Route path="/follow-ups" element={<Private><FollowUps /></Private>} />
      <Route path="/team" element={<Private><Team /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
