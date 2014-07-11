$(function(){
  var autosaveNotification,
  save_request,
  app_name = storage.getItem(config.storageAppNameKey),
  app_dir = get_app_dir(app_name),
  $console = $('#status-msg'),
  startCols = 8, minSpareRows = 1,
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
        save_request = spreadsheet_save_on_s3(app_dir + 
                                                  '/sample-spreadsheet.json', 
                                                  spreadsheet.getData(), 
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
  }),
  spreadsheet = $spreadsheet.data('handsontable');

  load_data();
  $('#clear-btn').click(function()
    {
      clear_data();
      return false;
    });
  $('#save-btn').click(function()
    {
      if(save_request)
        save_request.abort();
      save_request = spreadsheet_save_on_s3(app_dir + 
                                            '/sample-spreadsheet.json', 
                                            spreadsheet.getData(), 
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
      load_data();
    });
  function load_data(cb)
  {
    $console.text('Loading...');
    spreadsheet_load_from_s3(app_dir + '/sample-spreadsheet.json', 
                             function(err, res)
      {
        if(err && err.code != 'NoSuchKey')
          $console.text(err);
        else if(res)
        {
          try {
            spreadsheet.loadData(res);
          } catch(e) {
            err = _("Couldn't read spreadsheet data");
            $console.text(text);
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
    return awsS3.putObject({
      Bucket: config.s3Bucket,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json'
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
           cb(undefined, JSON.parse(res.Body.toString()));
         }catch(e) {
           cb && cb(new Error(
             sprintf(_("Couldn't parse spreadsheet file in %s"), key)));
         }
       });
  }
});
