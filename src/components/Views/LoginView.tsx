"use client";

import React, { useEffect, useRef, useState } from 'react';

interface LoginViewProps {
  onLogin: (userData: any) => void;
  error?: string | null;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, error: externalError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // We clean up previous widgets if any
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Initialize the Telegram Login Widget
    const script = document.createElement('script');
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute('data-telegram-login', 'Cine_3Estrellas_Bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.async = true;

    // Define the callback in the window object
    (window as any).onTelegramAuth = async (user: any) => {
      setLoading(true);
      setInternalError(null);
      
      try {
        const response = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
        });

        const result = await response.json();

        if (response.ok) {
          onLogin(result.user);
        } else {
          setInternalError(result.error || 'Error al iniciar sesión');
        }
      } catch (err) {
        setInternalError('Error de red. Intenta nuevamente.');
      } finally {
        setLoading(false);
      }
    };

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    return () => {
      // Clean up the global function
      delete (window as any).onTelegramAuth;
    };
  }, [onLogin]);

  const error = externalError || internalError;

  return (
    <div className="login-container">
      <div className="login-backdrop"></div>
      
      <div className="login-card">
        <div className="login-header">
          <img src="/assets/brand/logo.png" alt="Logo" className="login-logo" />
          <h1>Cine 3 Estrellas</h1>
          <p>La experiencia cinematográfica premium en Telegram</p>
        </div>

        <div className="login-content">
          <p className="login-instruction">
            Inicia sesión con tu cuenta de Telegram para acceder al catálogo completo.
          </p>

          <div ref={containerRef} className="telegram-widget-container">
            {/* Widget is injected here */}
          </div>

          {loading && (
            <div className="login-loading">
              <div className="spinner"></div>
              <span>Verificando acceso...</span>
            </div>
          )}

          {error && (
            <div className="login-error-message">
              <span className="material-symbols-outlined">warning</span>
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="login-footer">
          <p>Requisito: Estar unido al grupo oficial <strong>@Cine_3Estrellas</strong></p>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          overflow: hidden;
          background: #000;
          font-family: 'Outfit', sans-serif;
        }

        .login-backdrop {
          position: absolute;
          inset: 0;
          background: url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=2000') no-repeat center center;
          background-size: cover;
          filter: brightness(0.3) blur(10px);
          transform: scale(1.1);
        }

        .login-card {
          position: relative;
          width: 500px;
          background: rgba(20, 20, 20, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 32px;
          padding: 60px 40px;
          text-align: center;
          box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6);
          animation: cardSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes cardSlideUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-logo {
          width: 100px;
          margin-bottom: 24px;
        }

        h1 {
          font-size: 36px;
          color: #fff;
          margin-bottom: 8px;
          font-weight: 700;
        }

        .login-header p {
          color: rgba(255, 255, 255, 0.6);
          font-size: 16px;
          margin-bottom: 40px;
        }

        .login-instruction {
          color: #fff;
          font-size: 18px;
          margin-bottom: 30px;
          line-height: 1.5;
        }

        .telegram-widget-container {
          display: flex;
          justify-content: center;
          min-height: 44px;
          margin-bottom: 24px;
        }

        .login-error-message {
          margin-top: 24px;
          padding: 16px;
          background: rgba(255, 69, 58, 0.15);
          border: 1px solid rgba(255, 69, 58, 0.3);
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #ff453a;
          text-align: left;
        }

        .login-error-message p {
          margin: 0;
          font-size: 14px;
          line-height: 1.4;
        }

        .login-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-top: 20px;
          color: rgba(255, 255, 255, 0.8);
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .login-footer {
          margin-top: 40px;
          padding-top: 30px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.4);
          font-size: 14px;
        }

        .login-footer strong {
          color: rgba(255, 255, 255, 0.7);
        }
      `}</style>
    </div>
  );
};

export default LoginView;
