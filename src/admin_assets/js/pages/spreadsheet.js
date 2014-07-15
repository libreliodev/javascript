var doc_query = querystring.parse(get_url_query(document.location+'')),
csv_key = doc_query ? doc_query.key : null;
$(function(){
  var autosaveNotification,
  save_request,
  app_name = storage.getItem(config.storageAppNameKey),
  app_dir = get_app_dir(app_name),
  $console = $('#status-msg'),
  startCols = 8, minSpareRows = 1, $spreadsheet, spreadsheet;

  if(csv_key)
  {
    init_spreadsheet();
    load_data(csv_key);
  }
  function init_spreadsheet()
  {
    $spreadsheet = $("#spreadsheet").handsontable({
      startCols: startCols,
      rowHeaders: true,
      colHeaders: true,
      minSpareRows: minSpareRows,
      contextMenu: true,
      afterChange: function(change, source)
      {
        if (source === 'loadData')
          return; //don't save this change
        if($('#autosave_b').is(':checked'))
        {
          clearTimeout(autosaveNotification);
          if(save_request)
            save_request.abort();
          save_request = spreadsheet_save_on_s3(csv_key, spreadsheet.getData(), 
                                                function(err)
            {
              save_request = null;
              if(err)
                $console.text(err);
              else
              {
                $console.text('Autosaved (' + change.length + ' ' +
                              'cell' + (change.length > 1 ? 's' : '') + ')');
                autosaveNotification = setTimeout(function()
                  {
                    $console.text('Changes will be autosaved');
                  }, 1000);
              }
            });
        }
      }
    });
    spreadsheet = $spreadsheet.data('handsontable');
  }

  $('#clear-btn').click(function()
    {
      clear_data();
    });
  $('#open-btn').click(function()
    {
      openPublicationDialog({
        app_dir: app_dir,
        extension: '.csv'
      }, function(err, res)
         {
           if(err)
             return notifyUserError(err);
           if(res)
             document.location = 'spreadsheet.html?key=' + res.key;
         });
    });
  $('#save-btn').click(function()
    {
      if(!csv_key)
        return;
      if(save_request)
        save_request.abort();
      save_request = spreadsheet_save_on_s3(csv_key, spreadsheet.getData(), 
                                            function(err)
        {
          save_request = null;
          if(err)
            $console.text(err);
          else
            $console.text('Saved successfully');
        });
    });
  $('#load-btn').click(function()
    {
      load_data(csv_key);
    });
  function load_data(key, cb)
  {
    $console.text('Loading...');
    spreadsheet_load_from_s3(key, function(err, res)
      {
        if(err && err.code != 'NoSuchKey')
        {
          $console.text(err);
          return cb && cb(err);
        }
        else if(res)
        {
          try {
            spreadsheet.loadData(res);
          } catch(e) {
            err = _("Couldn't read spreadsheet data");
            $console.text(err);
          }
        }
        else
          clear_data();
        $console.text('Ready!');
        cb && cb(err, res);
      });
  }
  function clear_data()
  {
    var data = [];
    for(var i = 0; i < minSpareRows; ++i)
    {
      data.push([]);
      var a = data[i];
      for(var j = 0; j < startCols; ++j)
        a.push(null);
    }
    spreadsheet.loadData(data);
  }
  function spreadsheet_save_on_s3(key, data, cb)
  {
    var csv_str = d3.csv.format(data);
    return awsS3.putObject({
      Bucket: config.s3Bucket,
      Key: key,
      Body: csv_str
    }, function(err, res)
       {
         cb && cb(err);
       });
  }
  function spreadsheet_load_from_s3(key, cb)
  {
    return awsS3.getObject({
      Bucket: config.s3Bucket,
      Key: key
    }, function(err, res)
       {
         if(err)
           return cb && cb(err);
         try {
           cb(undefined, d3.csv.parseRows(res.Body.toString()));
         }catch(e) {
           cb && cb(new Error(
             sprintf(_("Couldn't parse spreadsheet file in %s"), key)));
         }
       });
  }
});
