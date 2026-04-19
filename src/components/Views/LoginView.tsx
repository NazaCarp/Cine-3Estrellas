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
      <div className="login-backdrop" />
      
      <div className="login-card">
        <div className="login-header">
          <img src="/assets/brand/logo.png" alt="Logo" className="login-logo" />
          <h1>CINE 3 ESTRELLAS</h1>
          <p className="subtitle">LA EXPERIENCIA CINEMATOGRÁFICA PREMIUM EN TELEGRAM</p>
        </div>

        <div className="login-content">
          <p className="login-instruction">
            Inicia sesión con tu cuenta de Telegram <br/> para acceder al catálogo completo
          </p>

          <div className="widget-wrapper">
            <div ref={containerRef} className="telegram-widget-container">
              {/* Widget is injected here */}
            </div>
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
          filter: brightness(0.25) blur(10px);
          transform: scale(1.1);
        }

        .login-card {
          position: relative;
          width: 580px;
          background: linear-gradient(135deg, rgba(25, 25, 25, 0.9) 0%, rgba(15, 15, 15, 0.95) 100%);
          backdrop-filter: blur(40px);
          border: 1px solid rgba(255, 215, 0, 0.2);
          border-radius: 40px;
          padding: 80px 60px;
          text-align: center;
          box-shadow: 0 50px 120px rgba(0, 0, 0, 0.8), 
                      inset 0 0 40px rgba(255, 215, 0, 0.02);
          animation: cardSlideUp 1s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes cardSlideUp {
          from { opacity: 0; transform: translateY(60px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-logo {
          width: 120px;
          margin-bottom: 30px;
          filter: drop-shadow(0 0 25px rgba(255, 215, 0, 0.2));
        }

        h1 {
          font-family: var(--font-roboto-condensed), sans-serif;
          font-size: 46px;
          letter-spacing: 3px;
          color: #fff;
          margin-bottom: 12px;
          font-weight: 800;
        }

        .subtitle {
          color: #d4af37;
          font-size: 15px;
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-bottom: 50px;
          font-weight: 700;
          opacity: 0.8;
        }

        .login-instruction {
          color: #fff;
          font-size: 20px;
          font-weight: 300;
          margin-bottom: 40px;
          line-height: 1.5;
          opacity: 0.9;
        }

        .widget-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 40px;
          min-height: 80px;
        }

        .telegram-widget-container {
          display: block;
          margin: 0 auto;
          text-align: center;
          width: 100%; /* Important for text-align inheritance */
        }

        .login-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
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
