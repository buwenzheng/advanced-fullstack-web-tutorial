import { RichText } from './RichText';
import { highlightCode } from './highlight';

export interface CodeCardProps {
  code: string;
  lang?: string;
  title?: string;
  note?: string;
  hidden?: boolean;
}

export function CodeCard({ code, lang = 'javascript', title = '', note, hidden }: CodeCardProps) {
  return (
    <div className="codeblock" hidden={hidden}>
      <div className="codeblock__bar">
        <span className="codeblock__lang">{lang}</span>
        {title ? <span>{title}</span> : null}
      </div>
      <pre>
        <code dangerouslySetInnerHTML={{ __html: highlightCode(code, lang) }} />
      </pre>
      {note ? (
        <RichText
          className="codeblock__note"
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--line-soft)',
            fontSize: '12.5px',
            color: 'var(--text-faint)',
          }}
          html={note}
        />
      ) : null}
    </div>
  );
}
