Vue.component('scanner-selector', {
  props: ['scanners'],
  data() {
    return {};
  },
  template: `
    <select @change="onChange">
      <option
        v-for="scanner in scanners"
        :key="scanner[0]"
        v-bind:value="scanner[0]">
          {{ scanner[1] }} {{ scanner[2] }}
      </option>
    </select>`,
  methods: {
    onChange(event) {
      this.$emit('change', this.$el.value);
    }
  },
  watch: {
    scanners(scanners) {
      if (scanners)
      this.$emit('change', scanners[0][0]);
    }
  }
});

Vue.component('scanner-options', {
  props: ['scanner'],
  data() {
    return {
      options: [],
      values: {},
    };
  },
  render(t) {
    const list = this.options.map(option => {
      const content = [
        t('scanner-option', {
          props: {
            ...option,
            value: this.values[option.py_name],
          },
          on: {
            change: this.onChange,
          },
        }),
      ];
      return t('li', {props: {key: option.py_name}}, content);
    });
    return t('ul', list);
  },
  template: `
    <ul>
      <li v-for="option in options" :key="option.py_name">
        <scanner-option
          v-bind="option"
          v-bind:value="values[option.py_name]"
          @change="onChange"
          />
      </li>
    </ul>
  `,
  watch: {
    async scanner() {
      this.options = [];
      this.values = {};
      if (!this.scanner) return;
      const res = await fetch(`/device/${this.scanner}/options`);
      const data = await res.json();
      for (const option of data) {
        this.values[option.py_name] = option.value;
      }
      this.options = data;
    },
    values(values) {
      console.log('values changed')
      for (const option of this.options) {
        if (option.value != values[option.py_name]) {
          option.value = values[option.py_name];
        }
      }
    },
  },
  methods: {
    onChange(name, value) {
      this.values[name] = value;
      this.$emit('change', name, value);
      this.$forceUpdate();
    }
  }
});

Vue.component('scanner-option', {
  props: ['py_name', 'type', 'title', 'desc', 'unit', 'constraint', 'constraint_type', 'value'],
  render(t) {
    const option = t(
      `scanner-input-${this.type}`,
      {
        props: this.$props,
        on: {
          change: this.onChange
        }
      },
    );
    return t(
      'label',
      [this.title, ' ', option]
    );
  },
  methods: {
    onChange(name, value) {
      this.$emit('change', name, value)
    }
  }
});

Vue.component('scanner-input-TYPE_BOOL', {
  props: ['py_name', 'type', 'title', 'desc', 'unit', 'constraint', 'constraint_type', 'value'],
  template: `<input type="checkbox" v-bind:checked="value" @change="onChange" />`,
  methods: {
    onChange() {
      this.$emit('change', this.py_name, this.$el.checked ? 1 : 0)
    }
  },
});

Vue.component('scanner-input-TYPE_STRING', {
  props: ['py_name', 'type', 'title', 'desc', 'unit', 'constraint', 'constraint_type', 'value'],
  template: `
    <select @change="onChange">
      <option v-for="c in constraint" v-bind:value="c" v-bind:selected="c == value">{{ c }}</option>
    </select>
  `,
  methods: {
    onChange() {
      this.$emit('change', this.py_name, this.$el.value)
    }
  },
});

Vue.component('scanner-input-TYPE_INT', {
  props: ['py_name', 'type', 'title', 'desc', 'unit', 'constraint', 'constraint_type', 'value'],
  template: `
    <select @change="onChange" v-if="constraint_type == 'list'">
      <option v-for="c in constraint" v-bind:value="c" v-bind:selected="c == value">{{ c }}</option>
    </select>
    <span v-else>
      <input
        type="range"
        @change="onChange"
        v-bind:min="constraint[0]"
        v-bind:max="constraint[1]"
        v-bind:step="constraint[2]"
        v-bind:value="value"
        />
        <span>{{ value }}</span>
    </span>
  `,
  methods: {
    onChange(event) {
      this.$emit('change', this.py_name, event.target.value)
    }
  },
});

Vue.component('scanner-input-TYPE_FIXED', {
  props: ['py_name', 'type', 'title', 'desc', 'unit', 'constraint', 'constraint_type', 'value'],
  template: `
    <select @change="onChange" v-if="constraint_type == 'list'">
      <option v-for="c in constraint" v-bind:value="c" v-bind:selected="c == value">{{ c }}</option>
    </select>
    <span v-else>
      <input
        type="range"
        @change="onChange"
        v-bind:min="constraint[0]"
        v-bind:max="constraint[1]"
        v-bind:step="constraint[2]"
        v-bind:value="value"
        />
        <span>{{ value }}</span>
    </span>
  `,
  methods: {
    onChange(event) {
      console.log(event.target)
      this.$emit('change', this.py_name, event.target.value)
    }
  },
});

window.addEventListener('load', () => {
  console.log('loaded');

  const scan = new Vue({
    el: '#app',
    data: {
      scanners: [],
      options: {},
      scanner: '',
      preview: '',
      state: 'loading',
    },
    created() {
      fetch('/devices')
        .then(res => res.json())
        .then(json => {
          console.log(this, this.scanners, json)
          this.scanners = json;
          this.state = '';
        });
    },
    methods: {
      onScannerChanged(scanner) {
        this.scanner = scanner;
        this.options = {};
      },
      onOptionChanged(name, value) {
        this.options[name] = value;
      },
      async onPreviewClick() {
        if (!this.scanner) return;
        this.state = 'scanning';
        const res = await fetch(`/device/${this.scanner}/scan`, {cache: "no-cache"});
        const blob = await res.blob();
        if (this.preview.length) {
          URL.revokeObjectURL(this.preview);
        }
        this.preview = URL.createObjectURL(blob);
        this.state = '';
      },
      async onScanClick() {
        if (!this.scanner) return;
        // this.state = 'scanning';
        const url = new URL(`${window.location.protocol}//${window.location.host}/device/${this.scanner}/scan`);

        for (const [key, value] of Object.entries(this.options)) {
          url.searchParams.append(key, value);
        }

        const res = await fetch(url, {cache: "no-cache"});
        const blob = await res.blob();
        if (this.preview.length) {
          URL.revokeObjectURL(this.preview);
        }
        this.preview = URL.createObjectURL(blob);
        this.state = '';
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style = 'display: none';
        a.href = this.preview;
        a.download = `scan_${(new Date).toISOString()}.jpeg`
        a.click();
      },
      onResetClick() {
        const scanner = this.scanner;
        this.scanner = '';
        setTimeout(() => this.scanner = scanner, 100);
      },
    }
  });
});
