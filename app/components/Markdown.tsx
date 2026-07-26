import React from 'react';

// 輕量 Markdown 渲染，足以呈現詳解使用到的語法：
// 標題（#/##/###）、粗體（**）、行內程式碼（`）、無序清單（-）、引言（>）、段落。
// 不引入第三方套件，避免搬移資料夾時的相依負擔。

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // 依序切出 **粗體** 與 `程式碼`
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<code key={`${keyPrefix}-c-${i}`}>{token.slice(1, -1)}</code>);
    }
    last = m.index + token.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ text }: { text: string }) {
  const lines = (text ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let list: string[] | null = null;
  let key = 0;

  const flushList = () => {
    if (list) {
      const items = list;
      blocks.push(
        <ul key={`ul-${key++}`}>
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `li-${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim() === '') {
      flushList();
      continue;
    }
    const listMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (listMatch) {
      if (!list) list = [];
      list.push(listMatch[1]);
      continue;
    }
    flushList();
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const content = renderInline(h[2], `h-${key}`);
      if (level === 1) blocks.push(<h1 key={`h-${key++}`}>{content}</h1>);
      else if (level === 2) blocks.push(<h2 key={`h-${key++}`}>{content}</h2>);
      else blocks.push(<h3 key={`h-${key++}`}>{content}</h3>);
      continue;
    }
    const bq = line.match(/^>\s?(.*)$/);
    if (bq) {
      blocks.push(<blockquote key={`bq-${key++}`}>{renderInline(bq[1], `bq-${key}`)}</blockquote>);
      continue;
    }
    blocks.push(<p key={`p-${key++}`}>{renderInline(line, `p-${key}`)}</p>);
  }
  flushList();

  return <div className="md">{blocks}</div>;
}
