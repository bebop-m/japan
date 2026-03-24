interface ProgressBlocksProps {
  current: number;
  total: number;
}

export function ProgressBlocks({ current, total }: ProgressBlocksProps) {
  return (
    <div className="progress-blocks" aria-label={`${current} / ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`progress-block ${index < current ? "filled" : ""}`.trim()}
        />
      ))}
    </div>
  );
}
