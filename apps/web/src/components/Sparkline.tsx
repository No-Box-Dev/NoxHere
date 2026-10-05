type SparklineProps = { points: number[] };

export function Sparkline({ points }: SparklineProps) {
  const width = 300;
  const height = 34;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const spread = max - min || 1;
  const coordinates = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * width;
    const y = 3 + ((point - min) / spread) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const [lastX, lastY] = coordinates.split(" ").at(-1)?.split(",") ?? ["300", "17"];

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="average" d={`M0 ${height * 0.68}H${width}`} />
      <polyline points={coordinates} />
      <circle cx={lastX} cy={lastY} r="3" />
    </svg>
  );
}
