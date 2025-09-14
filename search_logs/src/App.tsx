// App.js
import SearchLogsTable from './SearchLogsTable';
import ConfigPage from './ConfigPage';
import AnalyticsDashboard from './AnalyticsDashboard';

import LoginPage from "./Login";
import AuthProvider, { AuthContext } from './AuthProvider'; // Make sure this path is correct
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import React, { useContext, useEffect } from 'react';


function App() {
    return (
    <AuthProvider>

        <Router>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<ProtectedRoute><SearchLogsTable /></ProtectedRoute>} />
                <Route path="/config" element={<ProtectedRoute><ConfigPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><AnalyticsDashboard /></ProtectedRoute>} />
            </Routes>
        </Router>
    </AuthProvider>
    );
}

const ProtectedRoute: React.FC<{ children: JSX.Element }> = ({ children }) => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
  
    useEffect(() => {
      // If there is no user, redirect to "/login"
      if (!user) {
        navigate('/login');
      }
    }, [user, navigate]);
  
    // If there is a user, render the children, else render null
    return user ? children : null;
  };

export default App;
