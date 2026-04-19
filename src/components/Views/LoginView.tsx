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
          <div className="logo-glow">
            <img src="/assets/brand/logo.png" alt="Logo" className="login-logo" />
          </div>
          <h1>Cine 3 Estrellas</h1>
          <p className="subtitle">LA EXPERIENCIA CINEMATOGRÁFICA DEFINITIVA</p>
        </div>

        <div className="login-content">
          <div className="instruction-box">
            <p className="login-instruction">
              Inicia sesión con tu cuenta de Telegram para acceder a nuestro catálogo exclusivo.
            </p>
          </div>

          <div ref={containerRef} className="telegram-widget-wrapper">
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
          <div className="requirement-badge">
            <span className="material-symbols-outlined">group</span>
            <p>Requisito: Estar unido al grupo oficial <strong>@Cine_3Estrellas</strong></p>
          </div>
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
          background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&q=80&w=2000') no-repeat center center;
          background-size: cover;
          filter: blur(15px);
          transform: scale(1.2);
        }

        .login-card {
          position: relative;
          width: 540px;
          background: rgba(15, 15, 15, 0.7);
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 40px;
          padding: 60px 50px;
          text-align: center;
          box-shadow: 
            0 30px 60px rgba(0, 0, 0, 0.8),
            inset 0 0 0 1px rgba(255, 255, 255, 0.05);
          animation: cardEntrance 1s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes cardEntrance {
          from { opacity: 0; transform: scale(0.95) translateY(30px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .logo-glow {
          position: relative;
          display: inline-block;
          margin-bottom: 30px;
        }

        .logo-glow::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 120px;
          height: 120px;
          background: radial-gradient(circle, rgba(255, 215, 0, 0.2) 0%, transparent 70%);
          transform: translate(-50%, -50%);
          z-index: -1;
        }

        .login-logo {
          width: 120px;
          height: auto;
          filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.3));
        }

        h1 {
          font-size: 42px;
          color: #fff;
          margin-bottom: 12px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .subtitle {
          color: #ffd700;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 3px;
          margin-bottom: 45px;
          opacity: 0.8;
        }

        .instruction-box {
          margin-bottom: 35px;
        }

        .login-instruction {
          color: rgba(255, 255, 255, 0.9);
          font-size: 19px;
          line-height: 1.6;
          font-weight: 400;
        }

        .telegram-widget-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 50px;
          margin-bottom: 10px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .login-error-message {
          margin-top: 25px;
          padding: 18px;
          background: rgba(255, 69, 58, 0.1);
          border: 1px solid rgba(255, 69, 58, 0.3);
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 15px;
          color: #ff453a;
          text-align: left;
        }

        .login-error-message p {
          margin: 0;
          font-size: 15px;
          line-height: 1.4;
          font-weight: 500;
        }

        .login-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
          margin-top: 25px;
          color: #ffd700;
        }

        .spinner {
          width: 28px;
          height: 28px;
          border: 3px solid rgba(255, 215, 0, 0.1);
          border-top-color: #ffd700;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .login-footer {
          margin-top: 50px;
          padding-top: 30px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .requirement-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 100px;
          color: rgba(255, 255, 255, 0.5);
          font-size: 14px;
        }

        .requirement-badge strong {
          color: #ffd700;
          margin-left: 2px;
        }

        .requirement-badge .material-symbols-outlined {
          font-size: 18px;
        }
      `}</style>
    </div>
  );

};

export default LoginView;
