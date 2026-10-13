// Marks the page as running JavaScript before it paints, so the plain HTML
// fallback (public/seo-fallback.css) never flashes. A file, not an inline
// <script>, so the content security policy needs no hashes.
document.documentElement.classList.add('js')
