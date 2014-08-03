var default_template;
initialize_reader(function(app_data, csv_url, csv_url_dir, 
                           external_b, doc_query)
  {
    if(!csv_url)
      return;
    default_template = $('#csvreader').html();
    load_csv(csv_url, csv_url_dir, function(err)
      {
        if(err)
          notifyError(err);
      });
  });

function load_csv(csv_url, csv_url_dir, cb)
{
  var csvreader = $('#csvreader');
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
      dic_b = typeof $('#csvtable').data('dic') == 'string';
      try {
        if(dic_b)
          rows = d3.csv.parse(csv_data);
        else
          rows = d3.csv.parseRows(csv_data);
      } catch(e1) {
        return cb(e1);
      }
      var ctx = {
        rows: rows
      };
      if(dic_b)
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
        ctx.columns = cols;
      }
      csvreader.dhtml('item_init', ctx, { recursive: true });
      cb();
    });
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
