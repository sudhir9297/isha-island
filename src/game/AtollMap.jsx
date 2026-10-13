import { PLACES } from "./Places";

export default function AtollMap({ boat, found, onSelect }) {
  const x = Math.max(-25, Math.min(25, boat.x)),
    z = Math.max(-32, Math.min(25, boat.z));
  return (
    <svg
      className="atoll-map"
      viewBox="-28 -35 56 64"
      aria-label="Map of the atoll and your boat"
      role="group"
    >
      <defs>
        <radialGradient id="shelf">
          <stop offset="60%" stopColor="#7cae88" />
          <stop offset="100%" stopColor="#206c70" />
        </radialGradient>
      </defs>
      <rect x="-28" y="-35" width="56" height="64" rx="2" fill="#115965" />
      <ellipse cx="0" cy="-12" rx="18" ry="15" fill="url(#shelf)" />
      <path
        d="M-12-12Q-13-20-6-21Q4-24 11-17Q14-8 7-4Q0 0-9-5Z"
        fill="#e5ce8c"
      />
      <path d="M-7-12Q-8-18-3-19Q7-20 9-13Q9-7 2-5Q-6-5-7-12Z" fill="#618a58" />
      <path d="M7-7v7h3v-7" fill="#b38b59" />
      {PLACES.map((place) => (
        <g
          key={place.id}
          onClick={() => onSelect(place.id)}
          role="button"
          tabIndex="0"
          aria-label={place.name}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSelect(place.id);
          }}
          className="map-pin"
          transform={`translate(${place.position[0]},${place.position[2]})`}
        >
          <circle
            r="1.6"
            fill={found.includes(place.id) ? "#eedba3" : "#438a85"}
            stroke="#fff2bd"
            strokeWidth=".2"
          />
          <text y=".5" textAnchor="middle" fontSize="1.4" fill="#164a48">
            {found.includes(place.id) ? "✓" : "·"}
          </text>
          <text y="3.3" textAnchor="middle" fontSize="1.6" fill="#e9e3c3">
            {place.name}
          </text>
        </g>
      ))}
      <g
        transform={`translate(${x},${z}) rotate(${(-(boat.heading || 0) * 180) / Math.PI})`}
      >
        <circle r="2" fill="none" stroke="#fff5d0" strokeWidth=".2" />
        <path d="m0-1.3 .7 2-1.4 0Z" fill="#fff5d0" />
      </g>
      <text x="-24" y="-29" fill="#d5d4b1" fontSize="2">
        N ↑
      </text>
    </svg>
  );
}
