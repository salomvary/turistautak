import { Evented, LeafletEvent } from 'leaflet';
import $ from './util';

export interface SelectOptions {
  values?: { [key: string]: string };
  toggle?: boolean;
}

export interface SelectChangeEvent extends LeafletEvent {
  value: string;
}

export default class Select extends Evented {
  el: Element;
  protected options: SelectOptions;
  protected _value: string | null;

  constructor(el: Element, options?: SelectOptions) {
    super();
    this.el = el;
    this.options = options || {};
    $.fastClick(el);

    if (this.options.values) {
      this.setValues(this.options.values);
    }
    this.setupListeners();
  }

  protected update(value: string | null) {
    const buttons = this.el.querySelectorAll('button');
    $.eachNode(buttons, function (button) {
      const active = button.name === value;
      $.toggleClass(button, 'active', active);
    });
  }

  get() {
    return this._value;
  }

  set(value: string | null) {
    this._value = value;
    this.update(value);
  }

  setValues(values: { [key: string]: string }) {
    updateSelectOptions(this.el, values);
    this.setupListeners();
    this.update(this._value);
  }

  setDisabled(values: string[]) {
    values = values || [];
    const buttons = this.el.querySelectorAll('button');
    $.eachNode(buttons, function (button) {
      button.disabled = values.indexOf(button.name) > -1;
    });
  }

  private setupListeners() {
    // handle click events
    // XXX no event delegation on iOS Safari :(
    const buttons = this.el.querySelectorAll('button');
    $.eachNode(
      buttons,
      function (button) {
        $.on(button, 'click', onClick, this);
      },
      this
    );
  }
}

function updateSelectOptions(
  wrapper: Element,
  values: { [key: string]: string }
) {
  wrapper.innerHTML = '';
  const options = document.createDocumentFragment();
  Object.keys(values).forEach(function (key) {
    const button = document.createElement('button');
    button.name = key;
    button.className = 'flat-btn';
    button.innerHTML = values[key];
    options.appendChild(button);
  });
  wrapper.appendChild(options);
}

function onClick(this: Select, event: MouseEvent) {
  let value: string | null = (<HTMLInputElement>event.target).name;
  if (this._value === value) {
    if (this.options.toggle) {
      value = null;
    } else {
      return;
    }
  }
  this.fire('change', { value: value });
  this.set(value);
}
