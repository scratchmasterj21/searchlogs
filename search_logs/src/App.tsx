// App.js
import SearchLogsTable from './SearchLogsTable';
import ConfigPage from './ConfigPage';
import AnalyticsDashboard from './AnalyticsDashboard';
import DeviceManagement from './DeviceManagement';
import AIChatLogsTable from './AIChatLogsTable';
import AIChatAnalyticsDashboard from './AIChatAnalyticsDashboard';
import WorkerControlPanel from './WorkerControlPanel';
import FlaggedSearchesTable from './FlaggedSearchesTable';
import StudentProfile from './StudentProfile';

import LoginPage from "./Login";
import AuthProvider, { AuthContext } from './AuthProvider'; // Make sure this path is correct
import { isAllowedDomain } from './constants';
import ErrorBoundary from './components/ErrorBoundary';
import { getAuth, signOut } from 'firebase/auth';
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import React, { useContext, useEffect } from 'react';


function App() {
    return (
    <ErrorBoundary>
    <AuthProvider>

        <Router>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<ProtectedRoute><SearchLogsTable /></ProtectedRoute>} />
                <Route path="/config" element={<ProtectedRoute><ConfigPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
                <Route path="/devices" element={<ProtectedRoute><DeviceManagement /></ProtectedRoute>} />
                <Route path="/ai-chats" element={<ProtectedRoute><AIChatLogsTable /></ProtectedRoute>} />
                <Route path="/ai-analytics" element={<ProtectedRoute><AIChatAnalyticsDashboard /></ProtectedRoute>} />
                <Route path="/worker-control" element={<ProtectedRoute><WorkerControlPanel /></ProtectedRoute>} />
                <Route path="/flagged" element={<ProtectedRoute><FlaggedSearchesTable /></ProtectedRoute>} />
                <Route path="/student/:deviceId" element={<ProtectedRoute><StudentProfile /></ProtectedRoute>} />
            </Routes>
        </Router>
    </AuthProvider>
    </ErrorBoundary>
    );
}

const ProtectedRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    // Only authenticated users from the allowed Workspace domain may proceed.
    const isAuthorized = !!user && isAllowedDomain(user.email);

    useEffect(() => {
      if (!user) {
        navigate('/login');
        return;
      }
      // Authenticated but wrong domain: force sign-out, then bounce to login.
      if (!isAllowedDomain(user.email)) {
        signOut(getAuth()).finally(() => navigate('/login'));
      }
    }, [user, navigate]);

    return isAuthorized ? children : null;
  };

export default App;
