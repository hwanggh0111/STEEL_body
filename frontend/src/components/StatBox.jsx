export default function StatBox({ number, label }) {
  return (
    <div className="stat-box">
      <div className="stat-number">{number}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
