import { Container } from './core.js';

// HTMLElement represent a element in html
function component(renderer, BaseElement = HTMLElement) {
  class Element extends BaseElement {
    static get observedAttributes() {
      return renderer.observedAttributes || [];
    }

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._container = new Container(renderer, this.shadowRoot, this);
    }

    connectedCallback() {
      this._container.update();
    }

    disconnectedCallback() {
      this._container.teardown();
    }

    attributeChangedCallback(name, _, newValue) {
      let val = newValue === '' ? true : newValue;
      Reflect.set(this, name, val); // why use this syntax?
    }
  };

  function reflectiveProp(initialValue) {
    let value = initialValue;
    // :这个地方的用法需要注意下， 常规都是freeze一个object， 但这个地方freeze了一个descriptor
    return Object.freeze({
      enumerable: true,
      configurable: true,
      get() {
        return value;
      },
      set(newValue) {
        value = newValue;
        this._container.update();
      }
    })
  }

  const proto = new Proxy(BaseElement.prototype, {
    set(target, key, value, receiver) { // js prototype 规则还是有些复杂, 和 proxy 耦合在一起之后
      if(key in target) { // if key exists in that target 
        Reflect.set(target, key, value);
      }
      let desc;
      if(typeof key === 'symbol' || key[0] === '_') { // private props can not trigger update
        desc = {
          enumerable: true,
          configurable: true,
          writable: true,
          value
        }; 
      } else {
        desc = reflectiveProp(value);
      }
      // if key is symbol or starts with `_`, then it seems nothing need to be done
      // else hijack property setting ?
      // :tdone， 我理解Reflect.set 加入设置上， 还有必要这么设置上么
      // :bm 这个地方有点关键呀， 因为前面的target已经检查过了， targe 应该是本体, 
      // :tdone target 和 receiver 的区别? done: 查看readme
      Object.defineProperty(receiver, key, desc);

      if(desc.set) { // force a update on initial property adding
        desc.set.call(receiver, value);
      }

      return true;
    }
  });
  // 这一步很关键， 这意味着元素本身自定义的属性不会trigger container 刷新
  Object.setPrototypeOf(Element.prototype, proto);


  return Element;
}

export { component };
