export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  });
  children.flat(Infinity).forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    node.appendChild(typeof child === 'string' || typeof child === 'number'
      ? document.createTextNode(String(child))
      : child);
  });
  return node;
}

export function html(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  return template.content;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

let toastHost = null;

export function toast(message) {
  toastHost = toastHost || document.getElementById('toast-host');
  if (!toastHost) return;
  const node = h('div', { class: 'toast', text: message });
  toastHost.appendChild(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transform = 'translateY(6px)';
    setTimeout(() => node.remove(), 220);
  }, 2400);
}

export function highlightCode(code, lang) {
  const rules = lang === 'sql' ? SQL_RULES : lang === 'python' ? PY_RULES : JS_RULES;
  return highlight(String(code), rules);
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const JS_RULES = {
  literals: /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)/g,
  keywords: /\b(const|let|var|function|return|if|else|for|while|async|await|class|new|try|catch|throw|typeof|of|in|import|export|default|null|true|false|undefined)\b/g,
};

const SQL_RULES = {
  literals: /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:''|[^'])*')/g,
  keywords: /\b(SELECT|FROM|WHERE|ORDER|BY|ASC|DESC|LIMIT|OFFSET|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|AND|OR|NOT|IS|NULL|PRIMARY|KEY|AS|DISTINCT|COUNT|TRUE|FALSE|JOIN|ON|GROUP|HAVING)\b/g,
};

const PY_RULES = {
  literals: /(#[^\n]*)|('''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")/g,
  keywords: /\b(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|match|case|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield)\b/g,
};

/* 注释与字符串先换成 @@PH0@@ 占位符再着色，避免关键字/数字钻进它们内部。
   占位索引两侧是字母与 @，构不成单词边界，数字着色不会误伤索引。 */
function highlight(source, rules) {
  const parts = [];
  let out = escapeHtml(source).replace(rules.literals, (match, comment) => {
    parts.push({ text: match, cls: comment ? 'tok-com' : 'tok-str' });
    return `@@PH${parts.length - 1}@@`;
  });
  out = out.replace(rules.keywords, '<span class="tok-key">$1</span>');
  out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
  return out.replace(/@@PH([0-9]+)@@/g, (_, index) => {
    const part = parts[Number(index)];
    return `<span class="${part.cls}">${part.text}</span>`;
  });
}

export function codeBlock({ code, lang = 'javascript', title = '', note = '' }) {
  return h('div', { class: 'codeblock' },
    h('div', { class: 'codeblock__bar' },
      h('span', { class: 'codeblock__lang', text: lang }),
      title ? h('span', { text: title }) : null),
    h('pre', {}, h('code', { html: highlightCode(code, lang) })),
    note ? h('div', { class: 'codeblock__note', style: 'padding:10px 16px;border-top:1px solid var(--line-soft);font-size:12.5px;color:var(--text-faint)', html: note }) : null);
}
