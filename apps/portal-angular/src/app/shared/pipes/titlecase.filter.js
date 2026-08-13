/** AngularJS core ships no titlecase filter (Angular's CommonModule does), hence this one. */
export function titlecaseFilter() {
  return function titlecase(value) {
    if (!value) {
      return '';
    }
    return String(value)
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase());
  };
}
