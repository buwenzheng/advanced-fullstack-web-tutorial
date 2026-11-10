export function highlightCode(code: string, lang: string): string {
  const rules = lang === 'sql' ? SQL_RULES : lang === 'python' ? PY_RULES : JS_RULES;
  return highlight(String(code), rules);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface Rules {
  literals: RegExp;
  keywords: RegExp;
}

const JS_RULES: Rules = {
  literals: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)/g,
  keywords: /\b(const|let|var|function|return|if|else|for|while|async|await|class|new|try|catch|throw|typeof|of|in|import|export|default|null|true|false|undefined)\b/g,
};

const SQL_RULES: Rules = {
  literals: /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')/g,
  keywords: /\b(SELECT|FROM|WHERE|ORDER|BY|ASC|DESC|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|AND|OR|NOT|IS|NULL|PRIMARY|KEY|AS|DISTINCT|COUNT|TRUE|FALSE|JOIN|ON|GROUP|HAVING)\b/g,
};

const PY_RULES: Rules = {
  literals: /(#[^\n]*)|('''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")/g,
  keywords: /\b(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|match|case|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield)\b/g,
};

/* 注释与字符串先换成 @@PH0@@ 占位符再着色，避免关键字/数字钻进它们内部。
   占位索引两侧是字母与 @，构不成单词边界，数字着色不会误伤索引。 */
function highlight(source: string, rules: Rules): string {
  const parts: Array<{ text: string; cls: string }> = [];
  let out = escapeHtml(source).replace(rules.literals, (match, comment: string | undefined) => {
    parts.push({ text: match, cls: comment ? 'tok-com' : 'tok-str' });
    return `@@PH${parts.length - 1}@@`;
  });
  out = out.replace(rules.keywords, '<span class="tok-key">$1</span>');
  out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  return out.replace(/@@PH([0-9]+)@@/g, (_, index: string) => {
    const part = parts[Number(index)]!;
    return `<span class="${part.cls}">${part.text}</span>`;
  });
}
