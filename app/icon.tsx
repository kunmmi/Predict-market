export const size = { width: 32, height: 32 };
export const contentType = "image/svg+xml";

export default function Icon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#facc15"/>
      <rect x="8" y="17" width="5" height="7" rx="1" fill="#1e293b"/>
      <rect x="14" y="12" width="5" height="12" rx="1" fill="#1e293b"/>
      <rect x="20" y="7" width="5" height="17" rx="1" fill="#1e293b"/>
    </svg>
  `.trim();

  return new Response(svg, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
