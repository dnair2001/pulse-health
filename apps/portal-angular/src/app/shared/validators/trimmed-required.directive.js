/**
 * Rejects values that are empty once trimmed, so " " does not pass a plain `required`, and
 * (via the same trimmed value) enforces a minimum length. Exposed as two separate
 * `$error` keys (`trimmedRequired`, `trimmedMinlength`) rather than one, so templates can
 * show the same two distinct messages ("required" vs. "add more detail") the original
 * Angular validator's `{ required: true }` / `{ minlength: {...} }` shapes drove.
 *
 * Usage: <textarea ng-model="$ctrl.form.reason" trimmed-required="3"></textarea>
 * The attribute value is the minimum length; omit it (or use "0"/"") for required-only.
 */
export function trimmedRequiredDirective() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link(scope, element, attrs, ngModel) {
      function trimmedLength(modelValue) {
        return typeof modelValue === 'string' ? modelValue.trim().length : 0;
      }

      ngModel.$validators.trimmedRequired = (modelValue) => trimmedLength(modelValue) > 0;

      ngModel.$validators.trimmedMinlength = (modelValue) => {
        const minLength = Number(attrs.trimmedRequired) || 1;
        const length = trimmedLength(modelValue);
        return length === 0 || length >= minLength;
      };
    },
  };
}
