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
        <div className="film-grain" />
        <div className="vignette" />
        <div className="dynamic-halo" />
      </div>

      <div className="main-portal">
        <div className="brand-section">
          <div className="logo-halo" />
          <img src="/assets/brand/logo.png" alt="Logo" className="portal-logo" />
          <img src="/assets/brand/brand-text.png" alt="Cine 3 Estrellas" className="portal-brand-text" />
          <div className="prestige-divider">
            <div className="glow-point" />
          </div>
        </div>

        <div className="auth-section">
          <p className="portal-instruction">
            Inicia sesión con Telegram para continuar
          </p>

          <div className="hyper-glass-box">
            <div className="widget-wrapper">
              <div ref={containerRef} className="telegram-widget-container">
                {/* Widget is injected here */}
              </div>
            </div>
          </div>

          {loading && (
            <div className="status-indicator">
              <div className="pulse-dot" />
              <span>Verificando acceso</span>
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
          <p>EXCLUSIVO PARA LA COMUNIDAD DE @CINE_3ESTRELLAS</p>
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
          filter: brightness(0.18) contrast(1.1);
          animation: backgroundZoom 120s infinite alternate linear;
        }

        @keyframes backgroundZoom {
          from { transform: scale(1); }
          to { transform: scale(1.15); }
        }

        .film-grain {
          position: absolute;
          inset: 0;
          opacity: 0.12;
          pointer-events: none;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }

        .vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.6) 60%, #000 100%);
        }

        .dynamic-halo {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 800px;
          height: 800px;
          background: radial-gradient(circle, rgba(255, 215, 0, 0.05) 0%, transparent 70%);
          animation: haloPulse 8s infinite ease-in-out;
        }

        @keyframes haloPulse {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.1); }
        }

        .main-portal {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
          max-width: 900px;
          text-align: center;
        }

        .brand-section {
          position: relative;
          margin-bottom: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: revealDown 1.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .logo-halo {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, transparent 70%);
          z-index: -1;
        }

        .portal-logo {
          width: 110px;
          margin-bottom: 24px;
          filter: drop-shadow(0 0 25px rgba(255, 215, 0, 0.25));
        }

        .portal-brand-text {
          width: 500px;
          margin-bottom: 20px;
          filter: drop-shadow(0 0 20px rgba(0,0,0,0.5));
          display: block;
          margin-left: auto;
          margin-right: auto;
        }

        .prestige-divider {
          width: 500px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #ffd700, transparent);
          margin: 0 auto;
          position: relative;
        }

        .glow-point {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 4px;
          height: 4px;
          background: #ffd700;
          border-radius: 50%;
          box-shadow: 0 0 12px #ffd700;
        }

        .auth-section {
          animation: revealUp 1.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 0.4s;
        }

        .portal-instruction {
          font-size: 18px;
          font-weight: 300;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 50px;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .hyper-glass-box {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.01) 100%);
          backdrop-filter: blur(40px);
          padding: 40px 60px;
          border-radius: 40px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 
            0 40px 100px rgba(0, 0, 0, 0.6), 
            inset 0 0 30px rgba(255, 215, 0, 0.03),
            inset 0 1px 1px rgba(255, 255, 255, 0.1);
          width: fit-content;
          margin: 0 auto;
        }

        .widget-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 50px;
        }

        .telegram-widget-container {
          display: block;
          margin: 0 auto;
          text-align: center;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 35px;
          color: #ffd700;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 3px;
          text-transform: uppercase;
          opacity: 0.8;
        }

        .pulse-dot {
          width: 5px;
          height: 5px;
          background: #ffd700;
          border-radius: 50%;
          animation: dotPulse 2s infinite ease-in-out;
        }

        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(2); opacity: 1; }
        }

        .error-indicator {
          margin-top: 35px;
          padding: 16px 28px;
          background: rgba(255, 69, 58, 0.1);
          border: 1px solid rgba(255, 69, 58, 0.15);
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #ff453a;
          font-size: 14px;
        }

        .footer-section {
          margin-top: 100px;
          opacity: 0.3;
          font-size: 12px;
          letter-spacing: 2px;
          font-weight: 600;
          animation: revealUp 1.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: 0.8s;
        }

        @keyframes revealDown {
          from { opacity: 0; transform: translateY(-40px); filter: blur(15px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        @keyframes revealUp {
          from { opacity: 0; transform: translateY(40px); filter: blur(15px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }
      `}</style>
    </div>
  );
};

export default LoginView;
