(function TableReader_closure(window){

var TableReader = function(options)
{
  if(typeof options == 'object')
    $.extend(this, options);
},
p = TableReader.prototype;

p.load = function(table_url, callback)
{
  var self = this;
  function end(err)
  {
    self.initTable();
    callback && callback(err);
  }
  $.ajax({
    url: table_url,
    success: function(data)
    { 
      var rows, cols = [],
      is_dict = true;
      try {
        if(is_dict)
        {
          rows = d3.csv.parse(data);
          if(rows.length > 0)
          {
            var row = rows[0];
            for(var key in row)
            {
              cols.push(key);
            }
          }
        }
        else
        {
          rows = d3.csv.parseRows(data);
          if(rows.length > 0)
          {
            var row = rows[0];
            for(var i = 0; i < row.length; ++i)
            {
              cols.push(i+'');
            }
          }
        }
      } catch(e1) {
        return end(e1);
      }
      self.rows = rows;
      self.cols = cols;
      self.isDict = is_dict;
      end();
    },
    error: function(xhr, err, err_text)
    {
      var errmsg = sprintf(_("Request for table has failed: %s"), 
                        err_text);
      self.rows = null;
      self.cols = null;
      end(errmsg);
    }
  });
}

p.initTable = function()
{
  var self = this,
  $el = $(self.element);
  if(self.rows)
  {
    $el.show();
    $el.pivotUI(self.rows, {});
  }
  else
  {
    $el.hide();
  }
}

window.TableReader = TableReader;

})(window)
