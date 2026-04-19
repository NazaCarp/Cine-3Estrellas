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
          <h1 className="main-title">CINE 3 ESTRELLAS</h1>
          <p className="subtitle">La experiencia cinematográfica premium en Telegram</p>
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
          filter: brightness(0.2) blur(15px);
          transform: scale(1.1);
        }

        .login-card {
          position: relative;
          width: 580px;
          background: linear-gradient(145deg, rgba(20, 20, 20, 0.95) 0%, rgba(10, 10, 10, 0.98) 100%);
          backdrop-filter: blur(40px);
          border: 1px solid rgba(212, 175, 55, 0.15);
          border-radius: 48px;
          padding: 80px 60px;
          text-align: center;
          box-shadow: 0 60px 150px rgba(0, 0, 0, 0.9), 
                      inset 0 0 60px rgba(212, 175, 55, 0.03);
          animation: cardSlideUp 1.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes cardSlideUp {
          from { opacity: 0; transform: translateY(80px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .login-logo {
          width: 120px;
          margin-bottom: 30px;
          filter: drop-shadow(0 0 25px rgba(212, 175, 55, 0.25));
        }

        .main-title {
          font-family: var(--font-roboto-condensed), sans-serif;
          font-size: 46px;
          letter-spacing: 3px;
          color: #fff;
          margin-bottom: 12px;
          font-weight: 800;
          text-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
        }

        .subtitle {
          color: #c5a044;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 2.5px;
          margin-bottom: 50px;
          font-weight: 700;
          opacity: 0.9;
        }

        .login-instruction {
          color: #ffffff;
          font-size: 19px;
          font-weight: 300;
          margin-bottom: 40px;
          line-height: 1.6;
          opacity: 0.8;
          letter-spacing: 0.3px;
        }

        .widget-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 40px;
          /* Ensure the external widget sits perfectly in the middle */
          min-height: 80px;
        }

        .telegram-widget-container {
          display: inline-block;
          margin: 0 auto;
          text-align: center;
          /* Reset any potential inherited alignment */
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
