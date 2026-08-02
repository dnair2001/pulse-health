import { FormControl } from '@angular/forms';

import { trimmedRequired } from './trimmed-required.validator';

describe('trimmedRequired', () => {
  it('rejects empty and whitespace-only values', () => {
    const control = new FormControl('', trimmedRequired(3));
    expect(control.hasError('required')).toBeTrue();

    control.setValue('   ');
    expect(control.hasError('required')).toBeTrue();
  });

  it('rejects values shorter than the minimum once trimmed', () => {
    const control = new FormControl('  ab  ', trimmedRequired(3));
    expect(control.hasError('minlength')).toBeTrue();
  });

  it('accepts values that meet the minimum once trimmed', () => {
    const control = new FormControl('  cough  ', trimmedRequired(3));
    expect(control.valid).toBeTrue();
  });
});
