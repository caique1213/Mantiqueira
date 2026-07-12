export function ThemePreview() {
  return (
    <section className="theme-preview" aria-labelledby="theme-preview-title">
      <header className="theme-preview__topbar">
        <span className="theme-preview__brand" aria-hidden="true">
          M
        </span>
        <div>
          <p>Mantiqueira Brasil</p>
          <strong id="theme-preview-title">Prévia do sistema</strong>
        </div>
        <span className="theme-preview__badge">Operação online</span>
      </header>

      <div className="theme-preview__body">
        <nav className="theme-preview__nav" aria-label="Navegação da prévia">
          <span data-active="true">Mapa</span>
          <span>Ordens de serviço</span>
          <span>Inventário</span>
        </nav>

        <div className="theme-preview__content">
          <div className="theme-preview__heading">
            <div>
              <p>VISÃO OPERACIONAL</p>
              <h3>Postura 27 · Bateria B2</h3>
            </div>
            <button type="button">Abrir OS</button>
          </div>

          <div className="theme-preview__workspace">
            <section className="theme-preview__map" aria-label="Amostra do mapa físico">
              <header>
                <strong>Mapa físico</strong>
                <span>48 posturas</span>
              </header>
              <div className="theme-preview__map-grid">
                <span className="is-empty" />
                <span>36</span>
                <span>24</span>
                <span>12</span>
                <span className="is-active">45</span>
                <span>33</span>
                <span className="has-warning">21</span>
                <span>09</span>
                <span>44</span>
                <span className="is-selected">32</span>
                <span>20</span>
                <span className="has-critical">08</span>
              </div>
            </section>

            <section
              className="theme-preview__battery"
              aria-label="Amostra da vista lateral da bateria"
            >
              <header>
                <div>
                  <strong>Vista lateral</strong>
                  <span>Frente → Fundo</span>
                </div>
                <span className="theme-preview__status">Em execução</span>
              </header>
              <div
                className="theme-preview__machine"
                role="img"
                aria-label="Bateria com elevador, esteiras, carrinho, motores e redutor"
              >
                <span className="theme-preview__elevator" title="Elevador" />
                <div className="theme-preview__lines">
                  <span className="nylon" />
                  <span className="cage" />
                  <span className="white-conveyor" />
                  <span className="nylon" />
                  <span className="cage" />
                  <span className="white-conveyor" />
                  <span className="nylon" />
                  <span className="cage" />
                  <span className="white-conveyor" />
                </div>
                <span className="theme-preview__feed-cart" title="Carrinho de ração" />
                <span className="theme-preview__motor motor-front-top" title="Motor nylon superior" />
                <span
                  className="theme-preview__motor motor-front-bottom"
                  title="Motor nylon inferior"
                />
                <span
                  className="theme-preview__motor motor-rear-top"
                  title="Motor esteira branca superior"
                />
                <span
                  className="theme-preview__motor motor-rear-bottom"
                  title="Motor esteira branca inferior"
                />
                <span className="theme-preview__reducer" title="Redutor" />
              </div>
            </section>
          </div>

          <div className="theme-preview__legend" aria-label="Amostra de status e prioridades">
            <span>
              <i className="awaiting" />
              Aguardando
            </span>
            <span>
              <i className="in-progress" />
              Em execução
            </span>
            <span>
              <i className="waiting-part" />
              Aguardando peça
            </span>
            <span>
              <i className="resolved" />
              Resolvida
            </span>
            <span>
              <i className="critical" />
              Crítica
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
