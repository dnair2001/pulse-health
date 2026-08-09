import { useEffect } from 'react';

/**
 * Stands in for the `title` property on Angular's route definitions, which its default
 * TitleStrategy writes straight to `document.title`. Same strings, same behaviour: the tab
 * title is the route's title, not the shell's.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}
