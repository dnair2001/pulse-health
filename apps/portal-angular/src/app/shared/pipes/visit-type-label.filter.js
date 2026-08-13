const LABELS = {
  in_person: 'In person',
  video: 'Video visit',
  phone: 'Phone call',
};

export function visitTypeLabelFilter() {
  return function visitTypeLabel(value) {
    if (!value) {
      return '';
    }
    return LABELS[value] ?? value;
  };
}
