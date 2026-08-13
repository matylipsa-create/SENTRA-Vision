import { useEffect } from 'react';
import { WifiOff, ArrowRight, Github, Hand, ScrollText, HardDrive, BrainCircuit, KeyRound, Instagram, Youtube } from 'lucide-react';

interface LandingProps {
  onEnterApp: () => void;
}

const PILLARS = [
  {
    icon: Hand,
    title: 'Veto Humano',
    text: 'La IA sugiere, vos decidís.',
  },
  {
    icon: ScrollText,
    title: 'Evidencia Estructurada',
    text: 'Cada evento queda registrado y verificable.',
  },
  {
    icon: HardDrive,
    title: 'Soberanía del Dato',
    text: 'Tus datos no salen de tu dispositivo.',
  },
  {
    icon: BrainCircuit,
    title: 'IA Local',
    text: 'Procesamiento en tiempo real, sin nube.',
  },
  {
    icon: KeyRound,
    title: 'Post-cuántica',
    text: 'Dilithium + hash chain para evidencia inmutable.',
  },
];

const SOLUTION_PILLARS = [
  { icon: WifiOff, label: 'Offline-first' },
  { icon: HardDrive, label: 'Procesamiento local' },
  { icon: Hand, label: 'Veto humano' },
];

const SOCIAL_LINKS = [
  { label: 'GitHub', href: 'https://github.com/matylipsa-create/Aegis2', icon: Github },
  { label: 'Instagram', href: 'https://www.instagram.com/', icon: Instagram },
  { label: 'YouTube', href: 'https://www.youtube.com/', icon: Youtube },
];

export default function Landing({ onEnterApp }: LandingProps) {
  useEffect(() => {
    const sections = document.querySelectorAll('.land-reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('land-reveal-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="land-root">
      {/* ===== HERO ===== */}
      <section className="land-hero">
        <div className="land-hero-glow" />
        <div className="land-hero-content land-reveal">
          <p className="land-hero-eyebrow">AEGIS · SEGURIDAD SOBERANA</p>
          <h1 className="land-hero-title">
            La IA sugiere,<br />el humano decide.
          </h1>
          <p className="land-hero-sub">
            Aegis es un sistema soberano de seguridad y asistencia. No reemplaza tu juicio, lo amplifica.
          </p>
          <button onClick={onEnterApp} className="land-btn-primary">
            Probar la demo
            <ArrowRight size={18} className="land-btn-arrow" />
          </button>
        </div>
        <div className="land-hero-scroll-hint" aria-hidden="true" />
      </section>

      {/* ===== PROBLEMA ===== */}
      <section className="land-problem land-reveal">
        <div className="land-problem-inner">
          <p className="land-section-eyebrow">El problema</p>
          <p className="land-problem-text">
            Los sistemas de seguridad actuales dependen de la nube, exponen tus datos y toman decisiones por vos.
          </p>
        </div>
      </section>

      {/* ===== SOLUCIÓN ===== */}
      <section className="land-solution land-reveal">
        <div className="land-solution-inner">
          <p className="land-section-eyebrow">La solución</p>
          <p className="land-solution-text">
            Aegis es offline-first, procesa todo en tu dispositivo, y pone el veto humano en el centro de cada decisión.
          </p>
          <div className="land-solution-pills">
            {SOLUTION_PILLARS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.label} className="land-solution-pill">
                  <Icon size={18} strokeWidth={1.6} />
                  <span>{p.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== PILARES ===== */}
      <section className="land-pillars land-reveal">
        <h2 className="land-section-title land-section-title--center">Pilares</h2>
        <div className="land-pillars-grid">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="land-pillar-card land-reveal">
                <div className="land-pillar-icon">
                  <Icon size={26} strokeWidth={1.6} />
                </div>
                <h3 className="land-pillar-title">{p.title}</h3>
                <p className="land-pillar-text">{p.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="land-cta land-reveal">
        <h2 className="land-cta-title">Probá Aegis ahora mismo. Sin instalar nada. Sin compromiso.</h2>
        <button onClick={onEnterApp} className="land-btn-primary land-btn-primary--lg">
          Probar la demo
          <ArrowRight size={18} className="land-btn-arrow" />
        </button>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="land-footer">
        <div className="land-footer-links">
          {SOCIAL_LINKS.map((s) => {
            const Icon = s.icon;
            return (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="land-footer-link">
                <Icon size={18} strokeWidth={1.6} />
                <span>{s.label}</span>
              </a>
            );
          })}
        </div>
        <p className="land-footer-tag">Hecho con propósito, desde cualquier lugar.</p>
      </footer>
    </div>
  );
}
