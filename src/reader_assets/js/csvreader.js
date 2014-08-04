var default_template, csvreader, csvfilters, gcsv;
initialize_reader(function()
  {
    csvfilters = $('#csvfilters').dhtml('list_init');
  },
                  function(app_data, csv_url, csv_url_dir, 
                           external_b, doc_query)
  {
    if(!csv_url)
      return;
    csvreader = $('#csvreader');
    default_template = csvreader.html();
    load_csv(csv_url, csv_url_dir, function(err, csv)
      {
        if(err)
          return notifyError(err);
        initiate_filters(csv);
        initiate_sortable_columns(csv);
        update_csvreader(csv);
      });
  });
function initiate_sortable_columns(csv)
{
  var cols_info = csv.columns_info;

  $(cols_info).bind('update-elements', function()
    {
      // insert sortable extra elements (icons)
      for(var i in cols_info)
        update_th(cols_info[i]);
    });
  function update_th(col)
  {
    var $th = col.$th,
    sort_info = col.sort_info,
    sort_b = col.key && csv.sorted_key === col.key;
    if(col.sortable)
    {
      $th.toggleClass('sortable', true)
        .toggleClass('sorted', sort_b)
        .click(function()
          {
            var order = sort_info.SortOrder;
            sort_info.SortOrder = order == 'desc' ? null :
              (order == 'asec' ? 'desc' : 'asec');
            var pcol = cols_info[csv.sorted_key];
            if(pcol && pcol !== col)
              pcol.SortOrder = null;
            if(sort_info.SortOrder)
            {
              csv.sorted_key = col.key;
              csv.order = col.key + ' ' + sort_info.SortOrder;
            }
            else
            {
              csv.sorted_key = undefined;
              csv.order = undefined;
            }
            update_csvreader(csv);
            return false;
          });
    }
    if(sort_b)
    {
      $th.append('<i class="sort-icon glyphicon ' +  
              (sort_info.SortOrder == 'asec' ? 
               'glyphicon-chevron-up' : 'glyphicon-chevron-down') + '"></i>');
    }
  }
}
function initiate_filters(csv)
{
  csvfilters.html('');
  var cols_info = csv.columns_info,
  items = [];
  for(var key in cols_info)
  {
    var col_info = cols_info[key],
    filter_info = col_info.filter_info;
    if(!filter_info)
      continue;
    var type = filter_info.Type,
    deflt = filter_info.Default;
    try {
      var item = csvfilters.dhtml('list_new_item', type),
      ctx = {
        key: key,
        name: col_info.name
      };
      csvfilters.append(item);
      item.data('key', key);
      switch(type)
      {
      case 'Range':
        if(typeof deflt == 'object')
          ctx = $.extend(false, {}, deflt, ctx);
        break;
      case 'MultipleChoice':
        var options = ([]).concat(filter_info.Options),
        checked_opts = {},
        allchoice = filter_info.AllChoice;
        switch(typeof deflt)
        {
        case 'string':
          if(deflt == '*')
            if(typeof allchoice == 'string' && allchoice)
              checked_opts[allchoice] = '1';
            else
              for(var i = 0; i < options.length; ++i)
                checked_opts[options[i]] = '1';
          break;
        case 'object':
          if($.isArray(deflt))
            for(var i = 0; i < deflt.length; ++i)
              checked_opts[deflt[i]] = '1';
          break;
        }
        if(typeof allchoice == 'string' && allchoice)
          options.unshift(allchoice);
        
        ctx.checked_options = checked_opts;
        ctx.options = options;
        break;
      }
      item.dhtml('item_update', ctx, { recursive: true });
      item.find('select').change(update_filters);
      item.find('input').bind('input', update_filters);
      items.push(item);
    } catch(err) {
      console.log(err);
    }
  }
  csv.rowFilters = get_filters();
  function update_filters()
  {
    csv.rowFilters = get_filters();
    update_csvreader(csv);
  }
  function get_filters()
  {
    var filters = [];
    for(var i = 0, l = items.length; i < l; ++i)
    {
      var item = items[i],
      type = item.data('id'),
      key = item.data('key');
      switch(type)
      {
      case 'Range':
        var from = parseFloat(item.find('input[name=From]').val()),
        to = parseFloat(item.find('input[name=To]').val());
        if(!isNaN(from))
        {
          var obj = {};
          obj[key] = { gte: from };
          filters.push(obj);
        }
        if(!isNaN(to))
        {
          var obj = {};
          obj[key] = { lte: to };
          filters.push(obj);
        }
        break;
      case 'MultipleChoice':
        var opts = item.find('select').val(),
        filter_info = cols_info[key].filter_info;
        if(opts.indexOf(filter_info.AllChoice) == -1)
          filters.push(filter_create_isin(key, opts));
        break;
      }
    }
    if(filters.length === 0)
      return;
    return filters;
  }
}
function load_csv(csv_url, csv_url_dir, cb)
{
  request_csv_data(csv_url, csv_url_dir, function(err, data_obj)
    {
      if(err)
        cb(err);
      // insert template
      if(data_obj.template)
        csvreader.html(data_obj.template);
      else
        csvreader.html(default_template);
      
      var csv_data = data_obj.csv_data,
      rows,
      dict_b = typeof $('#csvtable').data('dict') == 'string';
      try {
        if(dict_b)
          rows = d3.csv.parse(csv_data);
        else
          rows = d3.csv.parseRows(csv_data);
      } catch(e1) {
        return cb(e1);
      }
      var ret = {
        rows: rows,
        template: data_obj.template || default_template
      };
      if(dict_b)
      {
        var cols,
        fl_end = csv_data.indexOf('\r');
        if(fl_end == -1)
          fl_end = csv_data.indexOf('\n');
        var fl = csv_data.substr(0, fl_end + 1);
        try {
          cols = d3.csv.parseRows(fl)[0] || [];
        } catch(e2g) {
          cols = [];
        }
        ret.columns = cols;
      }

      // initialize rows database
      var dbrows;
      if(dict_b)
      {
        dbrows = [];
        for(var i = 0, l = rows.length; i < l; ++i)
        {
          var row = rows[i],
          row_obj = $.extend(false, {}, row);
          row_obj.__row = row;
          dbrows.push(row_obj);
        }
      }
      else
      {
        dbrows = [];
        for(var i = 0, l = rows.length; i < l; ++i)
        {
          var row = rows[i],
          row_obj = {
            __row: row
          };
          for(var c = 0, cl = row.length; c < cl; ++c)
            row_obj[c+''] = row[c];
          dbrows.push(row_obj);
        }
      }
      ret.rowsDB = TAFFY(dbrows);

      ret.columns_info = get_columns_info();

      cb(undefined, ret);
    });
}

function filter_create_isin(p, a)
{
  return function()
  {
    return a.indexOf(this[p]) != -1;
  }
}

function update_csvreader(csv)
{
  // insert template
  csvreader.html(csv.template);
  var cols_info = csv.columns_info,
  query = csv.rowsDB();
  if(csv.rowFilters)
    for(var i = 0, l = csv.rowFilters.length; i < l; ++i)
      query = query.filter(csv.rowFilters[i])
  if(csv.order)
    query = query.order(csv.order);
  var ctx = {
    columns: csv.columns,
    rows: query.get().map(function(a) { return a.__row; })
  };
  csvreader.dhtml('item_init', ctx, { recursive: true });
  
  update_csvreader_columns_element(cols_info)
}

function update_csvreader_columns_element(cols_info)
{
  var $ths = $('#csvtable thead th');
  for(var i = 0, l = $ths.length; i < l; ++i)
  {
    var $th = $ths.eq(i),
    key = $th.data('key') || i+'',
    col = cols_info[key];
    if(col)
      col.$th = $th;
  }
  $(cols_info).trigger('update-elements');
}

function get_columns_info()
{
  var ret = {},
  $ths = $('#csvtable thead th');
  for(var i = 0, l = $ths.length; i < l; ++i)
  {
    var $th = $ths.eq(i),
    key = $th.data('key') || i+'',
    col;
    ret[key] = col = {
      key: key,
      name: $th.data('name'),
      filterable: typeof $th.data('filterable') == 'string',
      sortable: typeof $th.data('sortable') == 'string',
      $th: $th
    };
    if(col.filterable)
    {
      try {
        col.filter_info = $.plist('parse', $th.find('.filter-info')) || {};
      } catch(e) {
        col.filter_info = {};
      }
    }
    if(col.sortable)
    {
      try {
        if(col.sortable)
          col.sort_info = $.plist('parse', $th.find('.sort-info')) || {};
      } catch(e2) {
        col.sort_info = {};
      }
    }
  }
  return ret;
}

function request_csv_data(csv_url, csv_url_dir, cb)
{
  var path_str = url('path', csv_url),
  tmpl_url = csv_url_dir + '/' +
    path.basename(path_str, path.extname(path_str)) + '.tmpl',
  res = {};
  async.parallel([
    function(cb)
    {
      $.ajax(tmpl_url, {
        success: function(data)
        {
          res.template = data;
          cb();
        },
        error: function(xhr, err, err_text)
        {
          console.log('try for loading tmplate failed: ' + err_text);
          cb();
        }
      });
    },
    function(cb)
    {
      $.ajax(csv_url, {
        success: function(data)
        {
          res.csv_data = data;
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
