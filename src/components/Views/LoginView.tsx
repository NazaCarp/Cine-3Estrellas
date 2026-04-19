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
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    const script = document.createElement('script');
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute('data-telegram-login', 'Cine_3Estrellas_Bot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.async = true;

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
      delete (window as any).onTelegramAuth;
    };
  }, [onLogin]);

  const error = externalError || internalError;

  return (
    <div className="login-container">
      <div className="login-backdrop">
        <div className="vignette" />
      </div>

      <div className="main-portal">
        <div className="brand-section">
          <img src="/assets/brand/logo.png" alt="Logo" className="portal-logo" />
          <h1 className="portal-title">CINE 3 ESTRELLAS</h1>
          <div className="divider" />
        </div>

        <div className="auth-section">
          <p className="portal-instruction">
            Inicia sesión con Telegram para continuar
          </p>

          <div className="widget-box">
            <div className="widget-wrapper">
              <div ref={containerRef} className="telegram-widget-container">
                {/* Widget is injected here */}
              </div>
            </div>
          </div>

          {loading && (
            <div className="status-indicator">
              <div className="pulse-dot" />
              <span>Verificando...</span>
            </div>
          )}

          {error && (
            <div className="error-indicator">
              <span className="material-symbols-outlined">info</span>
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="footer-section">
          <p>Exclusivo para la comunidad de @Cine_3Estrellas</p>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          position: fixed;
          inset: 0;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          z-index: 10000;
          overflow: hidden;
          font-family: 'Outfit', sans-serif;
        }

        .login-backdrop {
          position: absolute;
          inset: 0;
          background: url('https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&q=80&w=2000') no-repeat center center;
          background-size: cover;
          filter: brightness(0.2) contrast(1.2);
          animation: backgroundZoom 60s infinite alternate ease-in-out;
        }

        @keyframes backgroundZoom {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }

        .vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent 20%, rgba(0,0,0,0.8) 100%);
        }

        .main-portal {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 800px;
          text-align: center;
        }

        .brand-section {
          animation: revealDown 1.2s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .portal-logo {
          width: 100px;
          margin-bottom: 24px;
          filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.2));
        }

        .portal-title {
          font-family: var(--font-roboto-condensed), sans-serif;
          font-size: 48px;
          font-weight: 800;
          letter-spacing: 8px;
          margin-bottom: 20px;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        .divider {
          width: 40px;
          height: 2px;
          background: #ffd700;
          margin: 0 auto 60px;
          opacity: 0.6;
        }

        .auth-section {
          animation: revealUp 1.2s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 0.3s;
        }

        .portal-instruction {
          font-size: 20px;
          font-weight: 300;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 40px;
          letter-spacing: 1px;
        }

        .widget-box {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          padding: 40px 80px;
          border-radius: 30px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
          transition: all 0.4s ease;
        }

        .widget-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 44px;
        }

        .telegram-widget-container {
          display: block;
          margin: 0 auto;
          text-align: center;
          gap: 12px;
          margin-top: 20px;
          color: #d4af37;
          font-size: 14px;
          font-weight: 600;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(255, 215, 0, 0.2);
          border-top-color: #d4af37;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .login-error-message {
          margin-top: 24px;
          padding: 16px 20px;
          background: rgba(255, 69, 58, 0.1);
          border: 1px solid rgba(255, 69, 58, 0.2);
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 14px;
          color: #ff453a;
          text-align: left;
        }

        .login-footer {
          margin-top: 50px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 30px;
        }

        .login-footer p {
          color: rgba(255, 255, 255, 0.35);
          font-size: 14px;
          letter-spacing: 0.5px;
        }
      `}</style>
    </div>
  );
};

export default LoginView;
