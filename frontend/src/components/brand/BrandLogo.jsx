import lightLogo from "../../assets/branding/clube-planner-on-light.svg?raw";
import darkLogo from "../../assets/branding/clube-planner-on-dark.svg?raw";

// Os contornos locais são incluídos no bundle, sem requisição a /branding.
const artwork = {
  light: lightLogo.replace(/<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, ""),
  dark: darkLogo.replace(/<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, ""),
};

export default function BrandLogo({ inverse = false, className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 950 205"
      role="img"
      aria-label="Clube Planner — Papelaria com afeto"
      width="950"
      height="205"
      className={`block h-auto max-w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: inverse ? artwork.dark : artwork.light }}
    />
  );
}
