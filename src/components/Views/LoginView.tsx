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
    <div className="login-container">
      <div className="login-background">
        <div className="poster-mosaic">
          {[...Array(20)].map((_, i) => (
            <div key={i} className="mosaic-item" style={{
              backgroundImage: `url('https://febhxbpcorixullzsfgz.supabase.co/storage/v1/object/public/posters/poster-${(i % 10) + 1}.jpg?t=1')`,
              animationDelay: `${i * 0.2}s`
            }} />
          ))}
        </div>
        <div className="vignette-overlay" />
      </div>

      <div className="portal-frame">
        <div className="login-card">
          <div className="card-glare" />
          
          <div className="login-header">
            <div className="logo-wrapper">
              <img src="/assets/brand/logo.png" alt="Logo" className="login-logo" />
            </div>
            <h1 className="main-title">CINE 3 ESTRELLAS</h1>
            <div className="subtitle-container">
              <div className="gold-line" />
              <p className="subtitle">EXPERIENCIA PREMIUM EN TELEGRAM</p>
              <div className="gold-line" />
            </div>
          </div>

          <div className="login-content">
            <p className="login-instruction">
              Inicia sesión con tu cuenta de Telegram <br/> para acceder al catálogo completo
            </p>

            <div className="auth-zone">
              <div className="widget-wrapper">
                <div ref={containerRef} className="telegram-widget-container">
                  {/* Widget is injected here */}
                </div>
              </div>
            </div>

            {loading && (
              <div className="portal-loading">
                <div className="shimmer-bar" />
                <span>VERIFICANDO ACCESO</span>
              </div>
            )}

            {error && (
              <div className="portal-error">
                <span className="material-symbols-outlined">report</span>
                <p>{error}</p>
              </div>
            )}
          </div>

          <div className="login-footer">
            <p>REQUISITO: ESTAR UNIDO AL GRUPO OFICIAL @CINE_3ESTRELLAS</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          z-index: 10000;
          overflow: hidden;
          background: #000;
          font-family: 'Outfit', sans-serif;
        }

        .login-background {
          position: absolute;
          inset: 0;
          z-index: 1;
        }

        .poster-mosaic {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          grid-template-rows: repeat(4, 1fr);
          width: 120vw;
          height: 120vh;
          position: absolute;
          top: -10vh;
          left: -10vw;
          gap: 10px;
          filter: grayscale(1) brightness(0.15);
          animation: kenBurns 60s infinite alternate ease-in-out;
        }

        .mosaic-item {
          width: 100%;
          height: 100%;
          background-size: cover;
          background-position: center;
          /* Fallback image if posters fail */
          background-color: #111;
        }

        @keyframes kenBurns {
          0% { transform: scale(1) translate(0, 0); }
          100% { transform: scale(1.1) translate(-2%, -2%); }
        }

        .vignette-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.4) 40%, #000 85%);
        }

        .portal-frame {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
        }

        .login-card {
          width: 680px;
          background: linear-gradient(135deg, rgba(20, 20, 22, 0.95) 0%, rgba(10, 10, 12, 0.98) 100%);
          backdrop-filter: blur(60px);
          border-radius: 60px;
          padding: 80px 70px;
          text-align: center;
          position: relative;
          overflow: hidden;
          box-shadow: 0 100px 200px rgba(0, 0, 0, 0.9);
          border: 1px solid rgba(255, 215, 0, 0.2);
          animation: portalEnter 1.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Animated Glowing Border */
        .login-card::after {
          content: '';
          position: absolute;
          inset: 0;
          padding: 2px;
          border-radius: 60px;
          background: linear-gradient(90deg, transparent, #ffd700, transparent);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: xor;
          animation: borderGlow 6s linear infinite;
        }

        @keyframes borderGlow {
          0% { transform: rotate(0deg); opacity: 0.3; }
          50% { opacity: 0.6; }
          100% { transform: rotate(360deg); opacity: 0.3; }
        }

        @keyframes portalEnter {
          from { opacity: 0; transform: scale(0.9) translateY(40px); filter: blur(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
        }

        .logo-wrapper {
          margin-bottom: 30px;
        }

        .login-logo {
          width: 140px;
          filter: drop-shadow(0 0 40px rgba(255, 215, 0, 0.3));
          animation: logoPulse 4s ease-in-out infinite;
        }

        @keyframes logoPulse {
          0%, 100% { transform: scale(1); filter: drop-shadow(0 0 40px rgba(255, 215, 0, 0.3)); }
          50% { transform: scale(1.05); filter: drop-shadow(0 0 60px rgba(255, 215, 0, 0.5)); }
        }

        .main-title {
          font-family: var(--font-roboto-condensed), sans-serif;
          font-size: 58px;
          letter-spacing: 6px;
          color: #fff;
          margin-bottom: 12px;
          font-weight: 900;
          text-shadow: 0 10px 20px rgba(0, 0, 0, 0.5);
        }

        .subtitle-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-bottom: 60px;
        }

        .gold-line {
          height: 1px;
          flex: 1;
          max-width: 40px;
          background: linear-gradient(90deg, transparent, #ffd700, transparent);
        }

        .subtitle {
          color: #ffd700;
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 4px;
          font-weight: 800;
          text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
        }

        .login-instruction {
          color: #ffffff;
          font-size: 24px;
          font-weight: 300;
          margin-bottom: 50px;
          line-height: 1.6;
          opacity: 0.9;
        }

        .auth-zone {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 30px;
          padding: 40px;
          margin-bottom: 40px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .widget-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          /* Critical: Ensure zero side margin interference */
          min-height: 80px;
        }

        .telegram-widget-container {
          display: block;
          margin: 0 auto;
          text-align: center;
          width: 100%;
        }

        .portal-loading {
          margin-top: 20px;
          color: #ffd700;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .shimmer-bar {
          width: 100px;
          height: 2px;
          background: linear-gradient(90deg, transparent, #ffd700, transparent);
          margin: 10px auto;
          animation: shimmer 2s infinite linear;
        }

        @keyframes shimmer {
          from { transform: translateX(-100px); }
          to { transform: translateX(100px); }
        }

        .portal-error {
          margin-top: 30px;
          padding: 20px 30px;
          background: rgba(255, 0, 0, 0.1);
          border-radius: 20px;
          border: 1px solid rgba(255, 0, 0, 0.2);
          display: flex;
          align-items: center;
          gap: 15px;
          color: #ff5555;
          text-align: left;
        }

        .login-footer {
          margin-top: 40px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 30px;
        }

        .login-footer p {
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
          letter-spacing: 1px;
          font-weight: 500;
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
