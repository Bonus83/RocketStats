function fakeElement() {
  return {
    hidden: false, disabled: false, checked: false, open: false, value: "", textContent: "",
    style: {}, classList: { add() {} }, listeners: new Map(), attributes: new Map(),
    children: [],
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = [...children]; },
    addEventListener(name, callback) { this.listeners.set(name, callback); },
    setAttribute(name, value) { this.attributes.set(name, value); },
    contains(element) { return element === this; },
    matches() { return false; },
    focus() { this.focused = true; },
    showModal() { this.open = true; },
    close() { this.open = false; }
  };
}

export function createDesktopDom() {
  const elements = new Map();
  const timers = new Map();
  let time = 0;
  let nextTimer = 0;
  const getElement = (id) => {
    if (!elements.has(id)) elements.set(id, fakeElement());
    return elements.get(id);
  };
  return {
    getElement,
    document: {
      getElementById: getElement, createElement: fakeElement, createElementNS: (_ns, name) => ({ ...fakeElement(), tagName: name }),
      documentElement: { lang: "" },
      activeElement: null, listeners: new Map(),
      addEventListener(name, callback) { this.listeners.set(name, callback); }
    },
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, at: time + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    advanceTime(milliseconds) {
      time += milliseconds;
      for (const [id, timer] of timers) {
        if (timer.at <= time) {
          timers.delete(id);
          timer.callback();
        }
      }
    }
  };
}
