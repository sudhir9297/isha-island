export default function Icon({ name, ...props }) {
  const paths = {
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m16 8-3 5-5 3 3-5Z" />
      </>
    ),
    map: (
      <>
        <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z" />
        <path d="M9 3v16M15 5v16" />
      </>
    ),
    book: (
      <>
        <path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" />
        <path d="M12 5v15" />
      </>
    ),
    gear: (
      <>
        <path d="M4 7h16M4 17h16M8 4v6M16 14v6" />
        <circle cx="8" cy="7" r="2" />
        <circle cx="16" cy="17" r="2" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    sound: (
      <>
        <path d="m11 4-6 5H2v6h3l6 5Z" />
        <path d="M15 8c3 2 3 6 0 8M18 5c5 4 5 10 0 14" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
