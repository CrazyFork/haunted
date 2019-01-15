import { commitSymbol, phaseSymbol, updateSymbol, hookSymbol, effectsSymbol, contextSymbol } from './symbols.js';
import { setCurrent, clear } from './interface.js';
import { render, html } from './lit.js';

function scheduler() {
  let tasks = [];
  let id;

  function runTasks() {
    id = null;
    let t = tasks;
    tasks = [];
    for(var i = 0, len = t.length; i < len; i++) {
      t[i]();
    }
  }

  return function(task) {
    tasks.push(task);
    if(id == null) {
      id = requestAnimationFrame(runTasks);
    }
  };
}

const read = scheduler();
const write = scheduler();

class Container {
  constructor(renderer, frag, host) {
    this.renderer = renderer;
    this.frag = frag;
    this.host = host || frag;
    this[hookSymbol] = new Map();
    this[phaseSymbol] = null;
    this._updateQueued = false;
  }

  update() {
    if(this._updateQueued) return;                      // 当前队列里边如果有在执行 rendering, 不允许update
    read(() => {                                        // 先push一个task到update queue
      let result = this.handlePhase(updateSymbol);      
      write(() => {                                     // 将执行完的结果result以闭包的形式传递到write queue, 即commit phase
        this.handlePhase(commitSymbol, result);         // 

        if(this[effectsSymbol]) {                       // 执行side effect, push task 到队列里边
          write(() => {
            this.handlePhase(effectsSymbol);
          });
        }
      });
      this._updateQueued = false; //:tdone, why set false here? , 因为 update phase 已经commit了
      // 因为js是单线程的，所以这个位置应该是为了防止重复push the same update phase.
    });
    this._updateQueued = true;
  }

  handlePhase(phase, arg) {
    this[phaseSymbol] = phase;
    switch(phase) {
      case commitSymbol: return this.commit(arg);
      case updateSymbol: return this.render();
      case effectsSymbol: return this.runEffects(effectsSymbol);
    }
    this[phaseSymbol] = null;
  }

  commit(result) {
    render(result, this.frag);
    this.runEffects(commitSymbol);
  }

  render() {
    setCurrent(this);
    let result = this.args ?
      this.renderer.apply(this.host, this.args) : //:bm
      this.renderer.call(this.host, this.host);
    clear();
    return result;
  }

  runEffects(symbol) {
    let effects = this[symbol];
    if(effects) {
      setCurrent(this);
      for(let effect of effects) {
        effect.call(this);
      }
      clear();
    }
  }

  teardown() {
    let effects = this[effectsSymbol];
    if(effects) {
      for(let effect of effects) {
        effect.teardown();
      }
    }

    let contexts = this[contextSymbol]; //:todo, what is contextSymbol
    if(contexts) {
      for(let context of contexts) {
        context.unsubscribe();
      }
    }
  }
}

export { Container, html, render };
