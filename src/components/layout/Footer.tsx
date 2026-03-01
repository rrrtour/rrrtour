'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* Ecosystem brands — add logos to /public/ecosystem/ and entries here */
const ECOSYSTEM = [
  { name: 'RRR Arena', logo: '/rrr-logo.svg' },
  { name: 'RRR League', logo: '/ecosystem/league.svg' },
  { name: 'RRR Apparel', logo: '/ecosystem/appareel.svg' },
  { name: 'RRR CAAT', logo: '/ecosystem/caat.svg' },
  { name: 'RRR Elite', logo: '/ecosystem/elitee.svg' },
];

export default function Footer() {
  const pathname = usePathname();

  /* Hide footer on arena display pages */
  if (pathname?.includes('/arena/display')) return null;

  return (
    <footer
      style={{
        background: '#0B0B0B',
        width: '100%',
        padding: '100px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '48px',
      }}
    >
      {/* ── SECTION 1: MAIN LOGO ── */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <img
          src="/rrr-logo.svg"
          alt="RRR Arena"
          style={{
            width: 'clamp(160px, 20vw, 280px)',
            height: 'auto',
            display: 'block',
          }}
        />
      </div>

      {/* ── SECTION 2: LEGAL ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        <p
          style={{
            color: '#888888',
            fontSize: '14px',
            fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
            letterSpacing: '0.05em',
            margin: 0,
            textAlign: 'center',
          }}
        >
          Copyright &copy; 2026 RRR Arena. All rights reserved.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <FooterButton href="/terms">Terms of Service</FooterButton>
          <FooterButton href="/privacy">Privacy Policy</FooterButton>
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div
        style={{
          width: '80px',
          height: '1px',
          background: '#333333',
        }}
      />

      {/* ── SECTION 3: RRR ECOSYSTEM ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '36px',
          width: '100%',
          maxWidth: '900px',
        }}
      >
        <h3
          style={{
            color: '#FFFFFF',
            fontSize: 'clamp(14px, 1.6vw, 18px)',
            fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
            fontWeight: 700,
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            margin: 0,
            textAlign: 'center',
          }}
        >
          RRR Ecosystem
        </h3>

        <style>{`
          .eco-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; width: 100%; justify-items: center; align-items: center; }
          @media (max-width: 768px) { .eco-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (max-width: 480px) { .eco-grid { grid-template-columns: 1fr; } }
        `}</style>
        <div className="eco-grid">
          {ECOSYSTEM.map((brand) => (
            <div
              key={brand.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px',
              }}
            >
              <img
                src={brand.logo}
                alt={brand.name}
                style={{
                  height: 'clamp(36px, 5vw, 56px)',
                  width: 'auto',
                  display: 'block',
                  opacity: 0.85,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}

/* ── Outlined button sub-component ── */
function FooterButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="footer-outlined-btn"
      style={{
        display: 'inline-block',
        padding: '10px 28px',
        border: '1px solid #FFFFFF',
        borderRadius: '8px',
        color: '#FFFFFF',
        fontSize: '13px',
        fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
        fontWeight: 600,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        textDecoration: 'none',
        background: 'transparent',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#E10600';
        e.currentTarget.style.color = '#E10600';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#FFFFFF';
        e.currentTarget.style.color = '#FFFFFF';
      }}
    >
      {children}
    </Link>
  );
}
