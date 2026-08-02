import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Rejects values that are empty once trimmed, so " " does not pass `Validators.required`. */
export function trimmedRequired(minLength = 1): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';

    if (!value) {
      return { required: true };
    }
    if (value.length < minLength) {
      return { minlength: { requiredLength: minLength, actualLength: value.length } };
    }
    return null;
  };
}
