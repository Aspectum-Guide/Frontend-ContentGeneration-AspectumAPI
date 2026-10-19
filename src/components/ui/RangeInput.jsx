export default function RangeInput({ className = '', ...props }) {
  return (
    <input
      type="range"
      {...props}
      className={`w-full accent-aspectum-primary disabled:opacity-40 ${className}`.trim()}
    />
  );
}
