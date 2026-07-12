import type { FocusEvent, KeyboardEvent } from 'react';
import { useTheme } from './ThemeContext';
import {
  THEME_TOKEN_DEFINITIONS,
  isSafeThemeTokenValue,
  type ThemeDensity,
  type ThemeTokenDefinition,
  type ThemeTokenGroup,
  type ThemeTokenKey,
} from './theme.schema';

const GROUP_LABELS: Record<ThemeTokenGroup, string> = {
  global: 'Cores globais',
  actions: 'Ações e botões',
  status: 'Status das ordens de serviço',
  priority: 'Prioridades',
  map: 'Mapa físico',
  assets: 'Ativos e bateria',
  typography: 'Tipografia',
  spacing: 'Espaçamento e densidade',
  shape: 'Formas e bordas',
  effects: 'Sombras, transparência e movimento',
};

const GROUP_DESCRIPTIONS: Record<ThemeTokenGroup, string> = {
  global: 'Fundo, superfícies, textos, menu, cabeçalho, rodapé e campos.',
  actions: 'Cores semânticas e estados visuais dos botões.',
  status: 'Cores administráveis sem alterar a semântica terminal dos status.',
  priority: 'Destaques de baixa até crítica.',
  map: 'Vazios físicos, posturas, seleção e intensidade do heatmap.',
  assets: 'Motores, redutores e os elementos da vista lateral da bateria.',
  typography: 'Famílias, escala, tamanhos, pesos e entrelinhas.',
  spacing: 'Ritmo da interface, controles, toque e largura útil.',
  shape: 'Arredondamentos e espessura de borda.',
  effects: 'Sombras, blur, opacidade e duração das transições.',
};

const COLOR_GROUPS: readonly ThemeTokenGroup[] = [
  'global',
  'actions',
  'status',
  'priority',
  'map',
  'assets',
];

const STRUCTURE_GROUPS: readonly ThemeTokenGroup[] = ['typography', 'spacing', 'shape', 'effects'];

const DENSITIES: readonly { id: ThemeDensity; label: string; description: string }[] = [
  { id: 'compact', label: 'Compacta', description: 'Mais informação por tela.' },
  { id: 'comfortable', label: 'Confortável', description: 'Equilíbrio para uso diário.' },
  { id: 'spacious', label: 'Ampla', description: 'Mais respiro e alvos maiores.' },
  { id: 'custom', label: 'Personalizada', description: 'Mantém os valores individuais.' },
];

function definitionsFor(group: ThemeTokenGroup): readonly ThemeTokenDefinition[] {
  return THEME_TOKEN_DEFINITIONS.filter((definition) => definition.group === group);
}

function colorPickerValue(value: string): string {
  return /^#[\da-f]{6}$/iu.test(value) ? value : '#000000';
}

interface ColorTokenFieldProps {
  definition: ThemeTokenDefinition;
  value: string;
  onChange(key: ThemeTokenKey, value: string): void;
}

function ColorTokenField({ definition, value, onChange }: ColorTokenFieldProps) {
  const key = definition.key as ThemeTokenKey;
  return (
    <label className="theme-editor__color-field">
      <input
        aria-label={`Alterar ${definition.label}`}
        onChange={(event) => onChange(key, event.currentTarget.value.toUpperCase())}
        type="color"
        value={colorPickerValue(value)}
      />
      <span>
        <strong>{definition.label}</strong>
        <output>{value}</output>
      </span>
    </label>
  );
}

interface TextTokenFieldProps {
  definition: ThemeTokenDefinition;
  value: string;
  onCommit(key: ThemeTokenKey, value: string): void;
}

function TextTokenField({ definition, value, onCommit }: TextTokenFieldProps) {
  const key = definition.key as ThemeTokenKey;
  const inputId = `theme-token-${key}`;
  const hintId = `${inputId}-hint`;

  function commit(event: FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const nextValue = input.value.trim();
    if (!isSafeThemeTokenValue(nextValue)) {
      input.setCustomValidity('Use um valor CSS simples, sem URL, regras ou ponto e vírgula.');
      input.reportValidity();
      input.value = value;
      return;
    }
    input.setCustomValidity('');
    if (nextValue !== value) onCommit(key, nextValue);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.currentTarget.blur();
    if (event.key === 'Escape') {
      event.currentTarget.value = value;
      event.currentTarget.setCustomValidity('');
      event.currentTarget.blur();
    }
  }

  return (
    <label className="theme-editor__text-field" htmlFor={inputId}>
      <span>{definition.label}</span>
      <input
        aria-describedby={hintId}
        defaultValue={value}
        id={inputId}
        key={`${key}:${value}`}
        onBlur={commit}
        onInput={(event) => event.currentTarget.setCustomValidity('')}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        type="text"
      />
      <small id={hintId}>{definition.cssVariable}</small>
    </label>
  );
}

export function ThemeEditor() {
  const { draftTheme, renameDraft, setDensity, updateToken } = useTheme();

  return (
    <section className="theme-editor" aria-labelledby="theme-editor-title">
      <header className="theme-editor__header">
        <div>
          <p className="theme-editor__eyebrow">Modo Personalizado</p>
          <h2 id="theme-editor-title">Editor visual</h2>
          <p>Todo valor é aplicado por token e aparece imediatamente na prévia.</p>
        </div>
        <label className="theme-editor__name">
          <span>Nome da paleta</span>
          <input
            defaultValue={draftTheme.name}
            key={`${draftTheme.id}:${draftTheme.name}`}
            maxLength={80}
            onBlur={(event) => renameDraft(event.currentTarget.value)}
            type="text"
          />
        </label>
      </header>

      <fieldset className="theme-editor__density">
        <legend>Densidade da interface</legend>
        <div className="theme-editor__density-grid">
          {DENSITIES.map((density) => (
            <label key={density.id}>
              <input
                checked={draftTheme.density === density.id}
                name="theme-density"
                onChange={() => setDensity(density.id)}
                type="radio"
              />
              <span>
                <strong>{density.label}</strong>
                <small>{density.description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="theme-editor__sections">
        {COLOR_GROUPS.map((group, index) => (
          <details className="theme-editor__section" key={group} open={index === 0}>
            <summary>
              <span>
                <strong>{GROUP_LABELS[group]}</strong>
                <small>{GROUP_DESCRIPTIONS[group]}</small>
              </span>
              <span aria-hidden="true" className="theme-editor__chevron">
                +
              </span>
            </summary>
            <div className="theme-editor__color-grid">
              {definitionsFor(group).map((definition) => (
                <ColorTokenField
                  definition={definition}
                  key={definition.key}
                  onChange={updateToken}
                  value={draftTheme.tokens[definition.key as ThemeTokenKey]}
                />
              ))}
            </div>
          </details>
        ))}

        {STRUCTURE_GROUPS.map((group) => (
          <details className="theme-editor__section" key={group}>
            <summary>
              <span>
                <strong>{GROUP_LABELS[group]}</strong>
                <small>{GROUP_DESCRIPTIONS[group]}</small>
              </span>
              <span aria-hidden="true" className="theme-editor__chevron">
                +
              </span>
            </summary>
            <div className="theme-editor__text-grid">
              {definitionsFor(group).map((definition) => (
                <TextTokenField
                  definition={definition}
                  key={definition.key}
                  onCommit={updateToken}
                  value={draftTheme.tokens[definition.key as ThemeTokenKey]}
                />
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
