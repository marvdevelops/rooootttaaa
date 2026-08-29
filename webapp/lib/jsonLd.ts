/**
 * Serialise a value for embedding inside a <script type="application/ld+json">
 * via dangerouslySetInnerHTML. Plain JSON.stringify is NOT safe here: it does
 * not escape `<`, so any user-controlled string containing `</script>` (a
 * route name, description, city, etc.) would terminate the <script> element
 * and the remainder would be parsed as HTML — stored XSS on the app origin.
 *
 * Escaping `<`, `>` and `&` as \uXXXX keeps the JSON valid (a ld+json block is
 * parsed as JSON, where these are ordinary string content) while making it
 * impossible to break out of the script context or open an HTML comment.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(
    /[<>&]/g,
    (ch) => ({ '<': '\\u003c', '>': '\\u003e', '&': '\\u0026' })[ch] as string,
  );
}
