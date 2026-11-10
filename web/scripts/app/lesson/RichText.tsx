import type { CSSProperties, JSX } from 'react';

export type RichTextProps = {
  html?: string | null;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  style?: CSSProperties;
};

export function RichText({ html, as: Tag = 'div', className, style }: RichTextProps) {
  if (!html) return null;
  return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
