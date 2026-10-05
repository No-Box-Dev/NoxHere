type Segment<T extends string> = {
  id: T;
  label: string;
  description: string;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  segments: readonly Segment<T>[];
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ label, value, segments, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {segments.map((segment) => (
        <button
          type="button"
          role="tab"
          aria-selected={value === segment.id}
          className={value === segment.id ? "active" : ""}
          key={segment.id}
          onClick={() => onChange(segment.id)}
        >
          <b>{segment.label}</b>
          <small>{segment.description}</small>
        </button>
      ))}
    </div>
  );
}
