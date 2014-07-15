var doc_query = querystring.parse(get_url_query(document.location+'')),
fb_key = doc_query ? doc_query.key : null;
$(function(){
  var formbuilder,
  save_request,
  app_name = storage.getItem(config.storageAppNameKey),
  app_dir = get_app_dir(app_name);

  
  if(fb_key)
  {
    s3_load_json_data(fb_key, function(err, obj)
      {
        if(err && err.code != 'NoSuchKey')
          notifyUserError(err);
        init_formbuilder(obj || {
          fields: []
        });
      });
  }
  
  function init_formbuilder(data)
  {
    formbuilder = new Formbuilder({
      selector: '.fb-main',
      bootstrapData: data.fields
    });
    formbuilder.on('save', function(payload)
      {
        save_data(payload);
      })
  }

  $('#open-btn').click(function()
    {
      openPublicationDialog({
        app_dir: app_dir,
        extension: '.form.json'
      }, function(err, res)
         {
           if(err)
             return notifyUserError(err);
           if(res)
             document.location = 'formbuilder.html?key=' + res.key;
         });
    });
  function save_data(obj, cb)
  {
    if(save_request)
      save_request.abort();
    save_request = s3_save_json_data(fb_key, obj, function(err)
      {
        save_request = null;
        if(err)
        {
          if(cb)
            cb(err);
          else
            notifyUserError(err);
          return;
        }
        cb && cb();
      });
  }

});
function s3_load_json_data(key, cb)
{
  awsS3.getObject({
    Bucket: config.s3Bucket,
    Key: key
  }, function(err, res)
     {
       if(err)
         cb && cb(err);
       else
         try {
           cb && cb(undefined, JSON.parse(res.Body.toString()));
         } catch(e) {
           cb && cb(new Error(
             sprintf("Couldn't parse formbuilder file in %s", key)));
         }
     });
}
function s3_save_json_data(key, obj, cb)
{
  return awsS3.putObject({
    Bucket: config.s3Bucket,
    Key: key,
    Body: typeof obj == 'string' ? obj : JSON.stringify(obj),
    ContentType: 'application/json'
  }, function(err)
     {
       cb && cb(err);
     });
}
