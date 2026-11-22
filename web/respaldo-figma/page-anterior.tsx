
const sections = [
  { name: "Inicio", symbol: "⌂", active: true },
  { name: "Clientes", symbol: "♙" },
  { name: "Plantillas", symbol: "▤" },
  { name: "Módulos", symbol: "▦" },
  { name: "Expedientes", symbol: "▣" },
  { name: "Seguimiento", symbol: "◷" },
];

const modules = [
  { name: "Nutrición", detail: "Planes alimenticios y comidas", symbol: "◉" },
  { name: "Actividad física", detail: "Rutinas y registro de ejercicio", symbol: "↗" },
  { name: "Hidratación", detail: "Consumo y seguimiento de agua", symbol: "≈" },
  { name: "Hábitos", detail: "Registro de hábitos cotidianos", symbol: "✓" },
];

export default function Home() {
  return (
    <main className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">C</div>
          <div>
            <strong>CECYFIT GO!</strong>
            <span>Panel profesional</span>
          </div>
        </div>

        <div className="sidebar-label">ESPACIO DE TRABAJO</div>

        <nav className="navigation" aria-label="Navegación principal">
          {sections.map((section) => (
            <div
              key={section.name}
              className={`nav-item ${section.active ? "active" : ""}`}
              aria-current={section.active ? "page" : undefined}
            >
              <span className="nav-symbol">{section.symbol}</span>
              <span>{section.name}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-avatar">P</div>
          <div>
            <strong>Profesional</strong>
            <span>Cuenta de trabajo</span>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">PLATAFORMA PROFESIONAL</span>
            <h1>Inicio</h1>
          </div>
          <div className="connection-status">
            <span className="status-dot" />
            Entorno de desarrollo
          </div>
        </header>

        <div className="content">
          <section className="welcome-panel">
            <div>
              <span className="eyebrow">CECYFIT GO! / PANEL DE CONTROL</span>
              <h2>Gestiona el seguimiento integral de tus pacientes.</h2>
              <p>
                Administra perfiles, configura planes personalizados y
                consulta la evolución de cada paciente desde un solo lugar.
              </p>
            </div>
            <div className="welcome-symbol" aria-hidden="true">✳</div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <span className="eyebrow">RESUMEN GENERAL</span>
                <h2>Tu espacio de trabajo</h2>
              </div>
              <span className="preview-label">Vista inicial</span>
            </div>

            <div className="summary-grid">
              <article className="summary-card">
                <span className="summary-icon blue">♙</span>
                <span className="summary-label">Pacientes</span>
                <strong>—</strong>
                <p>Perfiles registrados</p>
              </article>

              <article className="summary-card">
                <span className="summary-icon orange">▤</span>
                <span className="summary-label">Plantillas</span>
                <strong>—</strong>
                <p>Planes configurables</p>
              </article>

              <article className="summary-card">
                <span className="summary-icon green">▦</span>
                <span className="summary-label">Módulos</span>
                <strong>8</strong>
                <p>Áreas de seguimiento</p>
              </article>
            </div>
          </section>

          <section className="section-block">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CONFIGURACIÓN</span>
                <h2>Áreas de seguimiento</h2>
                <p className="section-description">
                  Módulos contemplados en CECYFIT GO!.
                </p>
              </div>
            </div>

            <div className="module-grid">
              {modules.map((module) => (
                <article className="module-card" key={module.name}>
                  <span className="module-symbol">{module.symbol}</span>
                  <div>
                    <h3>{module.name}</h3>
                    <p>{module.detail}</p>
                  </div>
                  <span className="module-arrow" aria-hidden="true">→</span>
                </article>
              ))}
            </div>
            <p className="module-note">
              También se contemplan mediciones corporales, recordatorios,
              condiciones de salud y documentos médicos.
            </p>
          </section>

          <footer className="dashboard-footer">
            CECYFIT GO! · Plataforma de seguimiento integral y personalizado
          </footer>
        </div>
      </section>
    </main>
  );
}
