(function TSVReader_closure(window) {

  var TSVReader = function()
  {
    var self = this;
    self.global_ctx = {
      path: path,
      url: url,
      querystringify: function()
      {
        var obj = {};
        for(var i = 0, l = arguments.length; i < l; i += 2)
        {
          var key = arguments[i],
          val = arguments[i + 1];
          if(typeof obj[key] == 'undefined')
            obj[key] = val;
          else if($.isArray(obj[key]))
            obj[key].push(val);
          else
            obj[key] = [ obj[key], val ];
        }
        return querystring.stringify(obj);
      },
      relpath: function()
      {
        // shortcut for concat(urldir,'/',path.join([arg0,[arg1,[..]]]))
        return self.tsv_urldir + '/' + 
          path.join.apply(path, Array.prototype.slice.call(arguments));
      },
      tmplrelpath: function()
      {
        return self.tmpl_urldir + '/' + 
          path.join.apply(path, Array.prototype.slice.call(arguments));
      },
      decimalFormat: function(l, v)
      {
        return icu.getDecimalFormat(l).format(parseFloat(v));
      }
    };

  };

  var p = TSVReader.prototype;
  
  p.get_tsv_element = function() { };
  p.get_columns_info = function() { return []; };
  p.row_content = function(row) { return row; };
  TSVReader.template_url = function tsvreader_template_url(tsv_url, tsv_url_dir)
  {
    if(!tsv_url_dir)
      tsv_url_dir = url_dir(tsv_url);
    var path_str = url('path', tsv_url);
    return tsv_url_dir + '/' +
      path.basename(path_str, path.extname(path_str)) + '.tmpl';
  }

  p.load = function tsv_load(tsv_url, tmpl_url, cb)
  {
    var self = this,
    global_ctx = self.global_ctx;
    self.tsv_url = tsv_url;
    self.tmpl_url = tmpl_url;
    
    request_tsv_data.call(self, tsv_url, tmpl_url, function(err, data_obj)
      {
        if(err)
          return cb(err);
        var tsvinit_ctx = {
          ready_after_load: function()
          {
            var $el = this,
            next, loaded;
            $el.bind('load', function()
              {
                if(next)
                  next();
                else
                  loaded = true;
              });
            parallel_ready.push(function(cb)
              {
                if(loaded)
                  cb();
                else
                  next = cb;
              });
          }
        }, parallel_ready = [],
        tsvreader = $(self.get_tsv_element());
        
        // insert template
        tsvreader.html(data_obj.template);
        var tsvinit = tsvreader.find('.tsvinit');
        try {
          tsvinit.dhtml('item_init', [ tsvinit_ctx, global_ctx ],
                        { recursive: true });
        } catch(err) {
          console.error(err);
        }
      
        var tsv_data = data_obj.tsv_data,
        rows,
        dict_b = self.isDict;
        try {
          if(dict_b)
            rows = d3.tsv.parse(tsv_data);
          else
            rows = d3.tsv.parseRows(tsv_data);
        } catch(e1) {
          return cb(e1);
        }
        var blocks = blocks_get(tsvreader),
        ret = {
          rows: rows,
          blocks: blocks,
          template: tsvreader.html()
        };
        if(dict_b)
        {
          var cols,
          fl_end = tsv_data.indexOf('\r');
          if(fl_end == -1)
            fl_end = tsv_data.indexOf('\n');
          var fl = tsv_data.substr(0, fl_end + 1);
          try {
            cols = d3.tsv.parseRows(fl)[0] || [];
          } catch(e2g) {
            cols = [];
          }
          ret.columns = cols;
        }

        var cols_info = ret.columns_info = self.get_columns_info();
        function col_value(key, val)
        {
          var col = cols_info[key];
          if(col && col.sort_info && col.sort_info.DataType)
            switch(col.sort_info.DataType)
          {
          case 'integer':
            val = parseInt(val);
            break;
          case 'real':
            val = parseFloat(val);
            break;
          }
          return val;
        }
        // initialize rows database
        var dbrows;
        if(dict_b)
        {
          dbrows = [];
          for(var i = 0, l = rows.length; i < l; ++i)
          {
            var row = rows[i],
            row_obj = {};
            row = self.row_content(row);
            rows[i] = row;
            for(var c in row)
              row_obj[c] = col_value(c, row[c]);
            row_obj.__row = row;
            row.__index = i;
            dbrows.push(row_obj);
          }
        }
        else
        {
          dbrows = [];
          for(var i = 0, l = rows.length; i < l; ++i)
          {
            var row = rows[i];
            row = self.row_content(row);
            rows[i] = row;

            var row_obj = {
              __row: row
            };
            row.__index = i;
            for(var c = 0, cl = row.length; c < cl; ++c)
              row_obj[c+''] = col_value(c, row[c]);
            dbrows.push(row_obj);
          }
        }
        ret.rowsDB = TAFFY(dbrows);

        async.parallel(parallel_ready, function(err)
          {
            if(!err)
            {
              for(var key in ret)
                self[key] = ret[key];
            }
            cb(err);
          });
      });
  }

  p.update_table = function update_tsvreader(tsvtable, tsv_ctx, offset, limit)
  {
    var tsv = this;

    // save/restore original data
    if(tsvtable._html_data)
    {
      try {
        var el = tsvtable,
        parentEl = el.parentNode,
        attrs = el.attributes,
        id = el.id;
        tsvtable = $('<div/>').html(el._html_data)[0];
        tsvtable._html_data = el._html_data;
        tsvtable.id = id;
        for(var i = 0; i < attrs.length; ++i)
        {
          var attr = attrs[i];
          tsvtable.setAttribute(attr.name, attr.value);
        }
        parentEl.replaceChild(tsvtable, el);
      } catch(e) {
        console.error(e);
        return;
      }
    }
    else
    {
      tsvtable._html_data = tsvtable.innerHTML;
    }
    var $tsvtable = $(tsvtable),
    cols_info = tsv.columns_info,
    query = tsv.rowsDB();
    if(tsv.rowFilters)
      for(var i = 0, l = tsv.rowFilters.length; i < l; ++i)
        query = query.filter(tsv.rowFilters[i])
    if(tsv.order)
      query = query.order(tsv.order);
    tsv_ctx.columns = tsv.columns;
    function slice(a)
    {
      if(!offset && !limit)
        return a;
      if(a.length > offset)
      {
        return a.slice(offset || 0, 
                       a.length - offset > limit ? offset + limit : undefined);
      }
      return [];
    }
    tsv_ctx.rows = slice(query.get()).map(function(a) { return a.__row; });
    tsv.update_table_ctx = tsv_ctx;
    blocks_put($tsvtable, tsv.blocks);
    try {
      $tsvtable.dhtml('item_init', [ tsv_ctx, tsv.global_ctx ], { 
        recursive: true,
        foreach_cache_get: foreach_cache_get,
        foreach_cache_set: foreach_cache_set
      });
    } catch(err) {
      console.error(err);
    }

  }
  function foreach_cache_get(forexpr, i, v, c)
  {
    if(forexpr[0].value.length == 1 && forexpr[0].value[0] == 'rows')
    {
      // cache row element
      return v['__' + c + 'cache'];
    }
  }
  function foreach_cache_set(forexpr, i, v, c, cache)
  {
    if(forexpr[0].value.length == 1 && forexpr[0].value[0] == 'rows')
    {
      // cache row element
      v['__' + c + 'cache'] = cache;
    }
  }

  function request_tsv_data(tsv_url, tmpl_url, cb)
  {
    var res = {},
    self = this,
    global_ctx = self.global_ctx;
    async.parallel([
      function(cb)
      {
        var urls = [ tmpl_url, self.default_template_url ];
        request_for_tmpl(urls.shift(), function(err, data)
          {
            if(err)
            {
              if(urls.length > 0)
                request_for_tmpl(urls.shift(), arguments.callee);
              else
                cb(err);
              return;
            }
            res.template = data;
            cb();
          });
        function request_for_tmpl(url, cb)
        {
          if(!url)
          {
            return cb(_("No url for template!"));
          }
          // load template file
          $.ajax(url, {
            success: function(data)
            {
              self.tmpl_urldir = global_ctx.tmpl_urldir = url_dir(url);
              cb(undefined, data);
            },
            error: function(xhr, err, err_text)
            {
              var err = sprintf(_("Request for template has failed: %s"), 
                                err_text);
              cb(err);
            }
          });
        }
      },
      function(cb)
      {
        $.ajax(tsv_url, {
          success: function(data)
          {
            self.tsv_urldir = global_ctx.urldir = url_dir(tsv_url);
            res.tsv_data = data;
            cb();
          },
          error: function(xhr, e, err_text)
          {
            var err = sprintf(_("Request has failed: %s"), err_text);
            cb(err);
          }
        });
      }
    ], function(err)
       {
         cb(err, res); 
       });
  }

  function blocks_get(el)
  {
    var ret = {};
    el.find('*').each(function()
      {
        var $this = $(this),
        block_name;
        if((block_name = $this.data('init-block')))
        {
          ret[block_name] = $this.html();
          $this.remove();
        }
      });
    return ret;
  }
  function blocks_put(el, blocks, used_blocks)
  {
    used_blocks = used_blocks || [];
    el.find('*').each(function()
      {
        var $this = $(this),
        block_name;
        if((block_name = $this.data('block')))
        {
          if(used_blocks.indexOf(block_name) != -1)
            throw new Error(block_name + ' has made endless loop');
          $this.html(blocks[block_name] || '');
          var tmp = used_blocks.concat();
          tmp.push(block_name);
          blocks_put($this, blocks, tmp);
        }
      });
  }

  window.TSVReader = TSVReader;
})(window);
