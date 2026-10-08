export default function BrandLogo({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="legit-logo-purple" x1="4" y1="5" x2="57" y2="59" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B24DB" />
          <stop offset="1" stopColor="#D414C8" />
        </linearGradient>
      </defs>
      <path d="M17 4.5h24l15 15v18l-8.5 8.5L60 58.5" stroke="url(#legit-logo-purple)" strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M17 4.5 2 19.5v18l15 15h20l11-11" stroke="url(#legit-logo-purple)" strokeWidth="4.5" strokeLinejoin="round" />
      <path d="m14 27 7-9 5 6 4-5" stroke="#8425DD" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" />
      <path d="M37 17v7m4-7v7m4-7v7" stroke="#8425DD" strokeWidth="2.4" />
      <path d="m16 34 8 5-8 5V34Z" fill="#8425DD" />
      <path d="M31 35h11m-11 5h11m-11 5h8" stroke="#8425DD" strokeWidth="2.6" />
      <path d="M0 29h58" stroke="#F08A00" strokeWidth="4.4" />
    </svg>
  )
}
