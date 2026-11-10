export const sseCases = {
  single: {
    chunks: ['data: hello\n\n'],
    expected: [{ event: 'message', data: 'hello' }]
  },
  crossChunk: {
    chunks: ['data: he', 'llo\n', '\n'],
    expected: [{ event: 'message', data: 'hello' }]
  },
  multiline: {
    chunks: ['data: first\ndata: second\n\ndata: third\n\n'],
    expected: [
      { event: 'message', data: 'first\nsecond' },
      { event: 'message', data: 'third' }
    ]
  },
  crlfComment: {
    chunks: ['id: 7\r\nevent: delta\r\ndata: hi\r\n: keep-alive\r\n\r\n'],
    expected: [{ id: '7', event: 'delta', data: 'hi' }]
  },
  done: {
    chunks: ['data: tail\n\ndata: [DONE]\n\n'],
    expected: [
      { event: 'message', data: 'tail' },
      { event: 'done', data: '' }
    ]
  }
};

export const demoStream = sseCases.multiline.chunks;
