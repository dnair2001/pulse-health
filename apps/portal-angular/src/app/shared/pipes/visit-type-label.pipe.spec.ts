import { VisitTypeLabelPipe } from './visit-type-label.pipe';

describe('VisitTypeLabelPipe', () => {
  const pipe = new VisitTypeLabelPipe();

  it('maps every known visit type to a human label', () => {
    expect(pipe.transform('in_person')).toBe('In person');
    expect(pipe.transform('video')).toBe('Video visit');
    expect(pipe.transform('phone')).toBe('Phone call');
  });

  it('returns an empty string for empty input', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('passes through unknown values unchanged', () => {
    expect(pipe.transform('house_call')).toBe('house_call');
  });
});
