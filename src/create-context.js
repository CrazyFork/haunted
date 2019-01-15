import { contextEvent } from './symbols.js';
import { useContext } from './use-context.js';
import { component } from './component.js';

export const createContext = (defaultValue) => {
  const Context = {};
  
  Context.Provider = class extends HTMLElement {
    constructor() {
      super();
      this.listeners = [];
  
      this.eventHandler = (event) => {
        const { detail } = event;
      
        if (detail.Context === Context) { // register new Context listener
          detail.value = this.value;
      
          detail.unsubscribe = () => {
            const index = this.listeners.indexOf(detail.callback)

            if (index > -1) {
              this.listeners.splice(index, 1);
            }
          }

          this.listeners.push(detail.callback);
  
          event.stopPropagation();
        }
      }
  
      this.addEventListener(contextEvent, this.eventHandler);
    }
  
    disconnectedCallback() {
      this.removeEventListener(contextEvent, this.eventHandler);
    }

    // 当value被改变的时候, all listener will be triggered with new value.
    // which in return call consumer's update method, 
    set value(value) {
      this._value = value;
      this.listeners.forEach(callback => callback(value));
    }

    get value() {
      return this._value;
    }
  };

  Context.Consumer = component(function ({ render }) {
    const context = useContext(Context);

    return render(context);
  });

  Context.defaultValue = defaultValue;

  return Context;
}