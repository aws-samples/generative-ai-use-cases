/**
 * A rendered diagram as a `data:` URL sized to its box. It is shown with
 * <img> rather than inserted into the page, so nothing in it is interactive,
 * it loads no external resources, and its styles cannot reach the rest of
 * the page.
 *
 * Mermaid writes HTML labels as HTML (e.g. an unclosed `<br>`), which is not
 * well-formed XML, so the output is parsed as HTML and then serialized as
 * XML, which an SVG image needs.
 */
export const svgToDataUrl = (svg: string): string | null => {
  const doc = new DOMParser().parseFromString(svg, 'text/html');
  const svgElement = doc.querySelector('svg');
  if (!svgElement) return null;
  svgElement.setAttribute('width', '100%');
  svgElement.setAttribute('height', '100%');
  // After HTML parsing an `xmlns` is a plain attribute; the serializer writes
  // each element's namespace itself, so a kept one would be declared twice.
  for (const element of [svgElement, ...svgElement.querySelectorAll('*')]) {
    element.removeAttribute('xmlns');
  }
  const markup = new XMLSerializer().serializeToString(svgElement);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
};
