import { useTheme } from './ThemeContext';
import { THEME_PRESET_LIST, THEME_PRESETS } from './theme.presets';

function PresetSwatches({ colors }: { colors: readonly string[] }) {
  return (
    <span className="theme-selector__swatches" aria-hidden="true">
      {colors.map((color, index) => (
        <span
          className="theme-selector__swatch"
          key={`${color}-${index.toString()}`}
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

export function ThemeSelector() {
  const { draftTheme, selectPreset, startCustomizing } = useTheme();
  const selectedValue = draftTheme.kind === 'custom' ? 'custom' : draftTheme.presetId;
  const customColors =
    draftTheme.kind === 'custom'
      ? [
          draftTheme.tokens.colorBg,
          draftTheme.tokens.colorSurface,
          draftTheme.tokens.colorPrimary,
          draftTheme.tokens.colorText,
        ]
      : [
          THEME_PRESETS.industrial.tokens.colorBg,
          THEME_PRESETS.industrial.tokens.colorSurface,
          THEME_PRESETS.industrial.tokens.colorPrimary,
          THEME_PRESETS.industrial.tokens.colorText,
        ];

  return (
    <fieldset className="theme-selector">
      <legend>Escolha o estilo do sistema</legend>
      <p className="theme-selector__hint" id="theme-selector-hint">
        A escolha altera imediatamente toda a prévia. Nada é salvo sem confirmação.
      </p>

      <div className="theme-selector__grid" aria-describedby="theme-selector-hint">
        {THEME_PRESET_LIST.map((preset) => {
          const colors = [
            preset.tokens.colorBg,
            preset.tokens.colorSurface,
            preset.tokens.colorPrimary,
            preset.tokens.colorText,
          ];
          return (
            <label className="theme-selector__option" key={preset.id}>
              <input
                checked={selectedValue === preset.id}
                name="theme-preset"
                onChange={() => selectPreset(preset.id)}
                type="radio"
                value={preset.id}
              />
              <span className="theme-selector__card">
                <PresetSwatches colors={colors} />
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
                <span className="theme-selector__selected">Selecionado</span>
              </span>
            </label>
          );
        })}

        <label className="theme-selector__option">
          <input
            checked={selectedValue === 'custom'}
            name="theme-preset"
            onChange={() => startCustomizing()}
            type="radio"
            value="custom"
          />
          <span className="theme-selector__card">
            <PresetSwatches colors={customColors} />
            <strong>Personalizado</strong>
            <small>Controle profundo de cores, tipografia, formas, efeitos e densidade.</small>
            <span className="theme-selector__selected">Selecionado</span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}
