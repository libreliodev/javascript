(function($, undefined){
  var arraySlice = Array.prototype.slice,
  string = 'string',
  funcStr = 'function';
  // dhtml or (dynamic html) is a series of functions for enabling
  // html contents to have dynamic elements
  var dhtml = function(method)
  {
    var func = methods[method];
    if(!func)
      throw new Error("Undefined function: " + method);
    return func.apply(this, arraySlice.call(arguments, 1));
  },
  methods = {
    list_init: list_init,
    list_new_item: list_new_item,
    list_items_update: list_items_update,
    item_update: item_update,
    eval: function(s, contexts)
    {
      if(!$.isArray(contexts))
        contexts = [ contexts ];
      contexts.push(global_ctx);
      return m_eval(s, contexts, this);
    }
  };

  function list_init()
  {
    // initialize list-items by data-id
    var self = this,
    lis = {},
    first_li;
    self.find(' > li').each(function()
      {
        var $this = $(this),
        id = $this.data('id') || 'default';
        if(!first_li)
          first_li = id;
        lis[id] = $this;
        $this.remove();
      })
      self.data('list-items', lis);
    if(!self.data('default-list-item'))
      self.attr('data-default-list-item', first_li);
    return self;
  }

  var m_parse_keys = {
    '\\': function(ctx, i)
    {
      if(i + 1 == ctx.lbs)
        return;
      ctx.escaped = true;
      ctx.onchar = function(ctx, i, c)
      {
        ctx.onchar = null;
        if(c != '\\')
        {
          ctx.cur += ctx.s[i];
          return false;
        }
      }
    },
    '(': function(ctx, i)
    {
      if(ctx.opren === 0)
        ctx.opren_idx = i;
      ctx.opren++;
      ctx.onchar = function(ctx, i, c)
      {
        if(c === '(' || c === ')')
          return;
        if(i + 1 == ctx.s.length)
          throw new Error("Expected character ')' at end: " + ctx.s);
        return false;
      }
    },
    ')': function(ctx, i)
    {
      var pren = --ctx.opren;
      if(pren === 0)
      {
        var ret = m_parse(ctx.s.substring(ctx.opren_idx + 1, i));
        if(ctx.cur)
          m_parse_var_piece(ctx);
        if(ctx.cur_var)
          ctx.cur_var.call = ret;
        else
          ctx.expr.push(ret);
        ctx.onchar = null;
      }
      else if(pren < 0)
        throw new Error("Unexpected char ')'");
    },
    '.': function(ctx, i)
    {
      if(!ctx.cur)
        throw new Error("Unexpected char '.'");
      m_parse_var_piece(ctx);
    },
    ',': function(ctx, i)
    {
      if(!ctx.cur && ctx.expr.length === 0 && ctx.lcomma_idx != i - 1)
        throw new Error("Unexpected char ','");
      ctx.lcomma_idx = i;
      if(ctx.cur)
        m_parse_var_piece(ctx);
      ctx.cur_var = null;
    },
    '\'': m_parse_char_quote,
    '"': m_parse_char_quote
  };
  var m_parse_char_quote_escape = {
    'n': '\n', 
    'r': '\r',
    't': '\t'
  };
  function m_parse_char_quote(ctx, i, c)
  {
    if(ctx.quote)
    {
      if(ctx.escape)
      {
        ctx.str += c;
        ctx.escape = false;
      }
      else if(c == '\\')
      {
        ctx.escape = !ctx.escape;
      }
      else if(ctx.quote == c)
      {
        ctx.expr.push({
          type: string,
          value: ctx.str
        });
        ctx.onchar = function(ctx, i, c)
        {
          if(c !== ',' && c !== ')')
            throw new Error("Unexpected character '" + c + "'");
          ctx.onchar = null;
        };
        delete ctx.str;
        delete ctx.quote;
        delete ctx.quote_idx;
      }
      else
        ctx.str += c;
    }
    else
    {
      ctx.quote = ctx.s[i];
      ctx.quote_idx = i;
      ctx.onchar = m_parse_char_quote;
      ctx.str = '';
    }
    return false;
  }
  function m_parse_var_piece(ctx)
  {
    if(ctx.cur_var)
      ctx.cur_var.value.push(ctx.cur);
    else
    {
      ctx.cur_var = {
        type: 'var',
        value: [ ctx.cur ]
      };
      ctx.expr.push(ctx.cur_var);
    }
    ctx.cur = '';
  }
  function m_parse(s)
  {
    var ctx = {
      s: s,
      cur: '',
      expr: [],
      opren: 0
    };
    for(var i = 0, l = s.length; i < l; ++i)
    {
      var c = s[i];
      if(ctx.onchar)
        if(ctx.onchar(ctx, i, c) === false)
          continue;
      if(m_parse_keys[c])
        m_parse_keys[c](ctx, i, c);
      else
        ctx.cur += c;
    }
    if(ctx.cur)
      m_parse_var_piece(ctx);
    return ctx.expr;
  }
  function m_eval_get_var(ctx, _var)
  {
    for(var i = 0, l = _var.length; i < l; ++i)
    {
      if(!ctx)
      {
        var err = new Error("'" + _var.slice(0, i).join('.') + "' is undefined");
        err.code = 'undefined_var';
        throw err;
      }
      ctx = ctx[_var[i]];
    }
    return ctx;
  }
  function m_eval(s, contexts, thisarg)
  {
    var exprs = m_parse(s);
    if(!exprs)
      return;
    return m_eval_subrout(exprs, contexts, thisarg)[0];
  }
  function m_eval_subrout(exprs, contexts, thisarg)
  {
    var ret = [];
    if(!$.isArray(contexts))
      contexts = [ contexts ];
    for(var i = 0, l = exprs.length; i < l; ++i)
    {
      var expr = exprs[i];
      switch(expr.type)
      {
      case 'var':
        var val = null;
        for(var c = 0, cl = contexts.length; !val && c < cl; ++c)
        {
          try {
            val = m_eval_get_var(contexts[c], expr.value);
          }catch(e) {
            if(e.code != 'undefined_var' || c + 1 == cl)
              throw e;
          }
        }
        if(expr.call)
        {
          if(!val)
            throw new Error("'" + expr.value.join('.') + 
                            "' is undefined");
          if(typeof val != funcStr)
            throw new Error("'" + expr.value.join('.') + 
                            "' is not a function");
          ret.push(val.apply(thisarg, m_eval_subrout(expr.call, contexts, thisarg)));
        }
        else
          ret.push(val);
        break;
      case string:
        ret.push(expr.value);
        break;
      }
    }
    return ret;
  }
  var global_ctx = {
    "false": false,
    "true": true,
    replace: function(a, b)
    {
      this.html(this.html().replace(a, b));
    },
    html: function(a)
    {
      this.html(a);
    },
    mul: function(a, b)
    {
      return parseFloat(a) * parseFloat(b);
    },
    add: function(a, b)
    {
      return parseFloat(a) + parseFloat(b);
    },
    mod_style: function()
    {
      var args = arguments;
      for(var i = 0, l = args.length; i < l; i += 2)
        this.css(args[i], args[i+1]||'');
    }
  };
  function list_new_item(id, contexts)
  {
    var self = this,
    lis = self.data('list-items');
    id = id || self.data('default-list-item');
    if(!lis[id])
      return null;
    var li = lis[id].clone();
    if(contexts)
      list_items_update.call(li, contexts);
    return li;
  }
  function list_items_update(contexts)
  {
    this.find('*').dhtml('item_update', contexts);
  }
  function item_update(contexts)
  {
    if(!$.isArray(contexts))
      contexts = [ contexts ];
    contexts.push(global_ctx);
    this.each(function()
      {
        var $el = $(this),
        val = $el.data('onupdate');
        if(val)
          m_eval(val, contexts, $el);
        val = m_eval($el.data('key') || '', contexts, $el);
        if(val || val === '')
          $el.text(val+'');
        var akeys = ($el.data('attr-keys') || '').split(',');
        $.each(akeys, function(i, k)
          {
            var idx = k.indexOf('='),
            attr = idx == -1 ? k : k.substr(0, idx),
            key = idx == -1 ? k : k.substr(idx + 1);
            if(!attr || !key)
              return;
            var val = m_eval(key+'', contexts, $el);
            if(val !== null || val !== undefined)
              $el.attr(attr, val+'');
          });
      });
  }
  $.fn.dhtml = dhtml;
})(jQuery);
