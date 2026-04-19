"use client";

import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import LoginView from '../Views/LoginView';

interface LoginGateProps {
  children: React.ReactNode;
}

const LoginGate: React.FC<LoginGateProps> = ({ children }) => {
  const { user, loading, login } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: '#0a0a0a' 
      }}>
        <div className="spinner"></div>
        <style jsx>{`
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.1);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLogin={login} />;
  }

  return <>{children}</>;
};

export default LoginGate;
