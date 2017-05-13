var config = {
  md_options: getConfig('md_options') || {html: true, linkify: true, typographer: true},
  md_plugins: getConfig('md_plugins') || {
    mathjax: [false, 'https://rawgit.com/gaohuazuo/markdown-it-mathjax/master/markdown-it-mathjax.js'],
    headerless_table: [false, 'https://rawgit.com/gaohuazuo/markdown-it-headerless-table/master/headerless-table.js']
  },
  md_headers: getConfig('md_headers') || {},
  active_md_headers: getConfig('active_md_headers') || [],
  html_headers: getConfig('html_headers') || {},
  active_html_headers: getConfig('active_html_headers') || []
};

function getConfig(key) {
  var value = localStorage.getItem(key);
  return value ? JSON.parse(value) : null;
}

function saveConfig() {
  if (arguments.length == 0) {
    saveConfig(config);
  } else if (arguments.length == 1) {
    for (var k in arguments[0]) {
      localStorage.setItem(k, JSON.stringify(arguments[0][k]));
    }
  } else {
    if (arguments.length % 2 != 0) {
      throw arguments;
    }
    for (var i = 0; i < arguments.length; i += 2) {
      localStorage.setItem(arguments[i], JSON.stringify(arguments[i+1]));
    }
  }
}

function dumpConfig() {
  return JSON.stringify(config);
}

function loadConfig(config_str) {
  config = JSON.parse(config_str);
}

function getActivePlugins() {
  var active_plugins = [];
  for (var name in config.md_plugins) {
    if (config.md_plugins[name][0]) {
      active_plugins.push(config.md_plugins[name][1]);
    }
  }
  return active_plugins;
}

function getMarkdownHeader() {
  var header = '';
  for (var name in config.active_md_headers) {
    header += config.md_headers[name];
  }
  return header;
}

function getHTMLHeadElements() {
  var result = [];
  var head_node = document.createElement('head');
  for (var i = 0; i < config.active_html_headers.length; i++) {
    head_node.innerHTML = config.active_html_headers[i];
    for (var j = 0; j < head_node.childNodes.length; j++) {
      result.push(head_node.childNodes[j]);
    }
  }
  return result;
}

require.config({
  paths: {
    codemirror: 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.25.2',
    'codemirror/lib': 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.25.2',
    MarkdownIt: 'https://cdnjs.cloudflare.com/ajax/libs/markdown-it/8.3.1/markdown-it',
    diffDOM: 'https://rawgit.com/gaohuazuo/diffDOM/master/diffDOM',
    domReady: 'https://cdnjs.cloudflare.com/ajax/libs/require-domReady/2.0.1/domReady'
  }
});

require(getActivePlugins(), function(){});

require(['codemirror/lib/codemirror', 'MarkdownIt', 'diffDOM', 'codemirror/mode/markdown/markdown', 'domReady'], function (CodeMirror, MarkdownIt, diffDOM) {
  (function() {
    var state = 0;
    function toSettings(elem) {
      state = 1;
      document.querySelector('#editor-view').style.display = 'none';
      document.querySelector('#settings-view').style.display = 'flex';
    }
    function toEditor(elem) {
      state = 0;
      document.querySelector('#settings-view').style.display = 'none';
      document.querySelector('#editor-view').style.display = 'flex';
    }
    document.querySelector('#settings-button').addEventListener('click', toSettings, false);
    document.querySelector('#close-button').addEventListener('click', toEditor, false);
    addEventListener('keydown', function(evt) {
      if (evt.keyCode === 27) {
        if (state) {
          toEditor();
        } else {
          toSettings();
        }
      }
    });
  })();

  var cm_editor = (function() {
    var cm_config = localStorage.getItem('cm_config');
    if (cm_config == null) {
      cm_config = {};
    }
    if (cm_config.mode == undefined) {
      cm_config.mode = 'markdown';
    }
    var cm_value = localStorage.getItem('cm_value');
    if (cm_value != null) {
      cm_config.value = cm_value;
    }
    return CodeMirror(document.querySelector("#editor"), cm_config);
  })();

  var render;
  var diff_dom = new diffDOM();
  var dom_parser = new DOMParser();

  var resetRenderer = (function() {
    var call_generation = 0;

    return function() {
      var my_generation = ++call_generation;
      render = function(){};

      var active_plugins = [];
      var plugin_options = [];
      for (var name in config.md_plugins) {
        if (config.md_plugins[name][0]) {
          active_plugins.push(config.md_plugins[name][1]);
          plugin_options.push(config.md_plugins[name][2]);
        }
      }

      require(active_plugins, function() {
        if (my_generation != call_generation) return;

        var md = MarkdownIt(config.md_options);
        for (var i = 0; i < active_plugins.length; i++) {
          arguments[i](md, plugin_options[i]);
        }

        render = function() {
          var old_html = document.querySelector("#preview > iframe").contentDocument.documentElement;
          var new_document = dom_parser.parseFromString(md.render(getMarkdownHeader() + cm_editor.getValue()), 'text/html');
          var head_elements = getHTMLHeadElements();
          var first_child = new_document.head.firstChild;
          for (var i = head_elements.length - 1; i >= 0; i--) {
            first_child = new_document.head.insertBefore(head_elements[i], first_child);
          }
          diff_dom.apply(old_html, diff_dom.diff(old_html, new_document.documentElement));
        }

        render();
      });
    };
  })();

  var save = (function() {
    var cm_last_state = cm_editor.changeGeneration();
    return function() {
      if (!cm_editor.isClean(cm_last_state)) {
        localStorage.setItem('cm_value', cm_editor.getValue());
      }
    }
  })();

  resetRenderer();

  cm_editor.on("changes", function() {
    save();
    render();
  });
});