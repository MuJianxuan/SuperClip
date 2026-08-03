interface Props {
  variant: string;
  label: string;
  keys: string[];
  onPrev: () => void;
  onNext: () => void;
}

export function PrototypeSwitcher({ variant, label, keys, onPrev, onNext }: Props) {
  return (
    <div className="prototype-switcher">
      <button type="button" onClick={onPrev} aria-label="上一个变体">
        ←
      </button>

      <div className="dots">
        {keys.map((v) => (
          <div key={v} className={`dot ${v === variant ? "active" : ""}`} />
        ))}
      </div>

      <span className="label">{label}</span>

      <button type="button" onClick={onNext} aria-label="下一个变体">
        →
      </button>
    </div>
  );
}